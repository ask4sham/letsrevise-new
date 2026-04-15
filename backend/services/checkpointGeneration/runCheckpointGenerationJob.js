/**
 * Core pipeline for a single CheckpointGenerationJob document (worker calls this).
 */
const Lesson = require("../../models/Lesson");
const { extractLessonContent } = require("./extractLessonContent");
const { validateAndNormalizeCheckpointPayload } = require("./validateCheckpointPayload");
const { validateCheckpointQuality, combineScores } = require("./checkpointQualityValidation");
const { applyCheckpointItemsToLesson } = require("./applyDraftToLesson");
const { generateLessonCheckpointDraft } = require("../llm/provider");

function addLog(job, msg) {
  if (!job.logs) job.logs = [];
  job.logs.push({ at: new Date(), msg: String(msg).slice(0, 2000) });
}

/**
 * @param {import("mongoose").Document} job CheckpointGenerationJob
 */
async function runCheckpointGenerationJob(job) {
  addLog(job, "Loading lesson");
  const lesson = await Lesson.findById(job.lessonId);
  if (!lesson) {
    throw new Error("Lesson not found");
  }

  const extracted = extractLessonContent(lesson);
  if (!extracted.summary.pageCount) {
    throw new Error("Lesson has no pages — skip checkpoint generation");
  }

  addLog(job, `Extracted ${extracted.summary.pageCount} pages, ${extracted.summary.charCount} chars`);

  const specKey = job.specKey || lesson.specKey || "";
  const topicKey = job.topicKey || lesson.topicKey || "";

  addLog(job, "Calling LLM for checkpoint draft");
  const gen = await generateLessonCheckpointDraft({
    lessonTitle: lesson.title,
    specKey,
    topicKey,
    subject: lesson.subject,
    level: lesson.level,
    extracted,
  });

  const rawItems = gen.checkpointItems || [];
  const structural = validateAndNormalizeCheckpointPayload(rawItems, {
    pages: lesson.pages || [],
  });
  const { items, issues: structuralIssues, qualityScore: structuralScore } = structural;

  let qualityReport = null;
  let combinedScore = structuralScore;
  if (items.length > 0) {
    qualityReport = validateCheckpointQuality(items, extracted, { level: lesson.level });
    combinedScore = combineScores(structuralScore, qualityReport.qualityScore);
  }

  job.resultPayload = {
    items,
    rawItemCount: rawItems.length,
    extractedSummary: extracted.summary,
    structuralScore,
    quality: qualityReport,
    combinedScore,
    failReasons: qualityReport?.failReasons || [],
  };
  job.validationIssues = [
    ...structuralIssues,
    ...(qualityReport?.issues || []).map((i) => ({
      severity: i.severity,
      code: i.code,
      message: `[quality] ${i.message}`,
      pageId: i.pageId,
    })),
  ];
  job.qualityScore = combinedScore;
  job.usage = {
    promptTokens: gen.usage?.promptTokens || 0,
    completionTokens: gen.usage?.completionTokens || 0,
    totalTokens: gen.usage?.totalTokens || 0,
    model: gen.usage?.model || "",
    estimatedUsd: null,
  };

  const legacyThreshold = parseFloat(process.env.CHECKPOINT_GEN_AUTO_APPLY_MIN_SCORE || "0.88");
  const hasStructuralErrors = structuralIssues.some((i) => i.severity === "error");

  if (items.length === 0) {
    job.reviewStatus = "pending_review";
    addLog(job, "No valid items after validation — teacher must review or regenerate");
    lesson.checkpointDraft = {
      jobId: job._id,
      status: "pending_review",
      qualityScore: combinedScore,
      generatedAt: new Date(),
      itemCounts: { mcq: 0, shortExplain: 0 },
    };
    await lesson.save();
    return;
  }

  /** Auto-merge only when structural + quality gates pass and tier is auto_publish */
  const autoApplyAllowed =
    !hasStructuralErrors &&
    qualityReport?.passed === true &&
    qualityReport.tier === "auto_publish" &&
    combinedScore >= legacyThreshold;

  if (autoApplyAllowed) {
    const { updatedPages } = applyCheckpointItemsToLesson(lesson, items, { onlyIfCheckpointEmpty: true });
    job.reviewStatus = updatedPages > 0 ? "auto_applied" : "pending_review";
    addLog(
      job,
      updatedPages > 0
        ? `Auto-applied ${updatedPages} checkpoints (combined=${combinedScore}, tier=${qualityReport.tier})`
        : `Quality OK but no empty checkpoints merged — pending_review (combined=${combinedScore})`
    );
  } else {
    job.reviewStatus = "pending_review";
    addLog(
      job,
      `Pending review (combined=${combinedScore}, tier=${qualityReport?.tier || "n/a"}, structuralErrors=${hasStructuralErrors}, qualityPassed=${qualityReport?.passed})`
    );
  }

  const mcq = items.filter((i) => i.type === "mcq").length;
  const shortExplain = items.filter((i) => i.type === "shortExplain").length;
  lesson.checkpointDraft = {
    jobId: job._id,
    status: job.reviewStatus === "auto_applied" ? "auto_applied" : "pending_review",
    qualityScore: combinedScore,
    generatedAt: new Date(),
    itemCounts: { mcq, shortExplain },
  };

  await lesson.save();
}

module.exports = { runCheckpointGenerationJob, addLog };
