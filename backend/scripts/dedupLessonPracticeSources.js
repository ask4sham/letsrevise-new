/**
 * One-off maintenance: deduplicate lesson practice sources.
 * Removes lesson.assessment.questions when they substantially overlap with lesson.examQuestions.
 * Default: dry run. Use --apply to persist. Optional --specKey to filter by topicKey prefix.
 *
 * Usage:
 *   node backend/scripts/dedupLessonPracticeSources.js
 *   node backend/scripts/dedupLessonPracticeSources.js --specKey AQA_GCSE_BIOLOGY
 *   node backend/scripts/dedupLessonPracticeSources.js --apply
 *   node backend/scripts/dedupLessonPracticeSources.js --apply --specKey AQA_GCSE_BIOLOGY
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const Lesson = require("../models/Lesson");

const OVERLAP_THRESHOLD = 0.6;

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = !apply;
  let specKey = null;
  const idx = args.indexOf("--specKey");
  if (idx !== -1 && args[idx + 1]) {
    specKey = String(args[idx + 1]).trim();
  }
  return { dryRun, apply, specKey };
}

function normalizeQuestionText(text) {
  if (text == null || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,?!;:'"()[\]{}\-\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compute overlap count: embedded questions that match examQuestions by ID or by normalized text.
 * @param {Array} examQuestions - lesson.examQuestions (may be populated with questionId.question)
 * @param {Array} assessmentQuestions - lesson.assessment.questions
 * @returns {{ overlapCount: number, assessmentCount: number }}
 */
function computeOverlap(examQuestions, assessmentQuestions) {
  const examRefs = Array.isArray(examQuestions) ? examQuestions : [];
  const assessQ = Array.isArray(assessmentQuestions) ? assessmentQuestions : [];
  if (assessQ.length === 0) return { overlapCount: 0, assessmentCount: 0 };

  const examIdSet = new Set(examRefs.map((r) => (r.questionId ? String(r.questionId) : null)).filter(Boolean));

  // Build set of normalized exam question texts (from populated questionId.question if present)
  const examNormalizedTexts = new Set();
  for (const r of examRefs) {
    const q = r.questionId;
    if (q && (q.question != null || q.questionText != null)) {
      const t = normalizeQuestionText(q.question || q.questionText);
      if (t) examNormalizedTexts.add(t);
    }
  }

  let overlapCount = 0;
  for (const q of assessQ) {
    const idMatch = q.questionBankId != null && examIdSet.has(String(q.questionBankId));
    if (idMatch) {
      overlapCount += 1;
      continue;
    }
    const text = normalizeQuestionText(q.question);
    if (text && examNormalizedTexts.has(text)) overlapCount += 1;
  }

  return { overlapCount, assessmentCount: assessQ.length };
}

function run() {
  const { dryRun, apply, specKey } = parseArgs();

  const query = {};
  if (specKey) {
    const escaped = specKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/_/g, "[_\\-]");
    query.topicKey = new RegExp("^" + escaped + "[:\\s]", "i");
  }

  return (async () => {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/letsrevise";
    await mongoose.connect(uri);

    console.log("Scanning lessons...");
    if (specKey) console.log("Spec filter:", specKey);
    console.log("Mode:", dryRun ? "DRY RUN" : "APPLY");
    console.log("");

    const lessons = await Lesson.find(query)
      .select("_id title topicKey examQuestions assessment")
      .populate({ path: "examQuestions.questionId", model: "ExamQuestion", select: "question questionText" })
      .lean();

    let lessonsWithBothSources = 0;
    let lessonsDeduplicated = 0;
    let lessonsSkippedLowOverlap = 0;
    const rows = [];

    for (const lesson of lessons) {
      const examRefs = lesson.examQuestions || [];
      const assess = lesson.assessment?.questions;
      const examCount = examRefs.length;
      const assessCount = Array.isArray(assess) ? assess.length : 0;

      if (examCount === 0 || !Array.isArray(assess) || assessCount === 0) {
        if (examCount > 0 && assessCount > 0) {
          // defensive: should not happen given above
        }
        continue;
      }

      lessonsWithBothSources += 1;
      const { overlapCount, assessmentCount: n } = computeOverlap(examRefs, assess);
      const overlapRatio = n === 0 ? 0 : overlapCount / n;

      let action = "NO_ACTION";
      if (overlapRatio >= OVERLAP_THRESHOLD) {
        action = dryRun ? "CLEARED" : "CLEARED";
        lessonsDeduplicated += 1;
        if (apply) {
          const doc = await Lesson.findById(lesson._id);
          if (doc && doc.assessment && Array.isArray(doc.assessment.questions)) {
            doc.assessment.questions = [];
            doc.markModified("assessment");
            await doc.save();
            console.log("[APPLY] Cleared embedded assessment for lesson:", lesson._id, lesson.title || "(no title)");
          }
        }
      } else {
        lessonsSkippedLowOverlap += 1;
        action = "SKIPPED";
      }

      rows.push({
        lessonId: String(lesson._id),
        title: (lesson.title || "").slice(0, 60),
        topicKey: lesson.topicKey || "",
        examQuestions: examCount,
        assessmentQuestions: assessCount,
        overlapRatio: overlapRatio.toFixed(2),
        action,
      });
    }

    const lessonsScanned = lessons.length;
    const reportDate = new Date().toISOString().slice(0, 10);
    const reportFilename = `DEDUP_LESSON_PRACTICE_${reportDate}.md`;
    const reportsDir = path.resolve(__dirname, "../../reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const reportPath = path.join(reportsDir, reportFilename);

    const md = [
      "# Lesson Practice Source Deduplication Report",
      "",
      "| Field | Value |",
      "|-------|-------|",
      "| **Run date** | " + new Date().toISOString() + " |",
      "| **Mode** | " + (dryRun ? "DRY RUN" : "APPLY") + " |",
      "| **Spec filter** | " + (specKey || "—") + " |",
      "",
      "## Summary",
      "",
      "| Metric | Count |",
      "|--------|-------|",
      "| Lessons scanned | " + lessonsScanned + " |",
      "| Lessons with both sources | " + lessonsWithBothSources + " |",
      "| Lessons deduplicated | " + lessonsDeduplicated + " |",
      "| Lessons skipped (low overlap) | " + lessonsSkippedLowOverlap + " |",
      "",
      "## Changes",
      "",
      "| Lesson ID | Title | TopicKey | examQuestions | assessmentQuestions | overlapRatio | Action |",
      "|-----------|-------|----------|---------------|---------------------|--------------|--------|",
      ...rows.map(
        (r) =>
          "| " +
          r.lessonId +
          " | " +
          (r.title || "").replace(/\|/g, "\\|") +
          " | " +
          (r.topicKey || "").replace(/\|/g, "\\|") +
          " | " +
          r.examQuestions +
          " | " +
          r.assessmentQuestions +
          " | " +
          r.overlapRatio +
          " | " +
          r.action +
          " |"
      ),
      "",
    ].join("\n");

    fs.writeFileSync(reportPath, md, "utf8");

    console.log("");
    console.log("Lessons scanned:", lessonsScanned);
    console.log("Lessons with both sources:", lessonsWithBothSources);
    console.log(dryRun ? "Lessons to deduplicate:" : "Lessons deduplicated:", lessonsDeduplicated);
    console.log("Lessons skipped (low overlap):", lessonsSkippedLowOverlap);
    console.log("");
    console.log("Report written to:");
    console.log(reportPath);

    await mongoose.disconnect();
  })();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
