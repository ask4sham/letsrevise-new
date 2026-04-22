/**
 * Curriculum Autopilot — safe automation layer for gap-driven content generation.
 * Uses curriculumGapDetectionService, contentCoverageService, contentGraphService.
 * Only Topic leaf nodes receive generated content. Main Topic and Section remain grouping only.
 */
const mongoose = require("mongoose");
const curriculumGapDetectionService = require("./curriculumGapDetectionService");
const contentCoverageService = require("./contentCoverageService");
const contentGraphService = require("./contentGraphService");
const autopilotGenerationAdapters = require("./autopilotGenerationAdapters");
const autopilotGatingService = require("./autopilotGatingService");
const topicEvidenceService = require("./topicEvidenceService");
const studentTopicEvidenceService = require("./studentTopicEvidenceService");
const autopilotFeedbackService = require("./autopilotFeedbackService");
const { queryCandidates } = require("../utils/topicKey");

/** Safe Mode thresholds — all must pass for auto-publish */
const SAFE_MODE_EVIDENCE_HEALTH = "strong";
const SAFE_MODE_APPROVAL_RATE = 85;
const SAFE_MODE_PROMPT_PACK_APPROVAL = 80;
const SAFE_MODE_MASTERY_SCORE = 70;
const SAFE_MODE_OPEN_ISSUES = 0;
const SAFE_MODE_GATE_STATUS = "allow";
/** Minimum evidence sample sizes — prevent early/weak auto-publish */
const SAFE_MODE_MIN_AUTOPILOT_RUNS = 3;
const SAFE_MODE_MIN_REVIEWED_ITEMS = 10;
const SAFE_MODE_MIN_QUIZ_ATTEMPTS = 20;
const Lesson = require("../models/Lesson");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const AutopilotRun = require("../models/AutopilotRun");
const { getCurrentAutopilotPromptPack, getAutopilotPromptPackById, resolvePromptPackForRun } = require("./autopilotPromptMetadata");
const adminTaxonomyService = require("./adminTaxonomyService");

const FLASHCARD_THRESHOLD = 5;
const QUIZ_THRESHOLD = 3;
const EXAM_THRESHOLD = 2;
const HIGH_ISSUE_THRESHOLD = 3;

const AUTOPILOT_ACTIONS = ["generate_flashcards", "generate_quiz", "generate_exam_questions"];

/**
 * Decide which autopilot actions to run based on gap.
 * Rules v1:
 * - If flashcards < 5 → include generate_flashcards
 * - If quizzes < 3 → include generate_quiz
 * - If examQuestions < 2 → include generate_exam_questions
 * - If open issues >= 3 → skip all generation, requires_review = true
 * - create_lesson: DO NOT auto-create; recommend only
 */
function decideAutopilotActions(gap, requestedActions) {
  const counts = gap?.counts || {};
  const openIssues = counts.openIssues ?? 0;
  if (openIssues >= HIGH_ISSUE_THRESHOLD) {
    return { actions: [], requiresReview: true };
  }
  const actions = [];
  const allowed = requestedActions && requestedActions.length > 0
    ? requestedActions.filter((a) => AUTOPILOT_ACTIONS.includes(a))
    : AUTOPILOT_ACTIONS;
  const flashcards = counts.flashcards ?? 0;
  const quizzes = counts.quizzes ?? 0;
  const examQuestions = counts.examQuestions ?? 0;
  if (allowed.includes("generate_flashcards") && flashcards < FLASHCARD_THRESHOLD) {
    actions.push("generate_flashcards");
  }
  if (allowed.includes("generate_quiz") && quizzes < QUIZ_THRESHOLD) {
    actions.push("generate_quiz");
  }
  if (allowed.includes("generate_exam_questions") && examQuestions < EXAM_THRESHOLD) {
    actions.push("generate_exam_questions");
  }
  return { actions, requiresReview: false };
}

/**
 * Compute Safe Mode: whether generated content can be auto-published.
 * All conditions must be true: evidenceHealth strong, approvalRate >= 85, promptPackApproval >= 80,
 * masteryScore >= 70, openIssues === 0, gateStatus === "allow",
 * plus minimum evidence sample: autopilotRuns >= 3, reviewedItems >= 10, quizAttempts >= 20.
 * Returns { safeModeActivated, evidenceSample }.
 */
async function computeSafeMode(specKey, topicOnly, gate, promptPackId, promptPackVersion) {
  const evidenceSample = { autopilotRuns: 0, reviewedItems: 0, quizAttempts: 0 };
  if (gate?.gateStatus !== SAFE_MODE_GATE_STATUS) {
    return { safeModeActivated: false, evidenceSample };
  }
  const topicFull = (topicOnly || "").includes(":") ? topicOnly : `${specKey}:${(topicOnly || "").trim()}`;
  const [evidence, learning, feedbackByPack] = await Promise.all([
    topicEvidenceService.getTopicEvidence(specKey, topicOnly),
    studentTopicEvidenceService.getTopicLearningEvidence(specKey, topicOnly),
    autopilotFeedbackService.getFeedbackByPromptPack({ specKey, topicKey: topicFull, days: 90 }),
  ]);
  const evidenceHealth = evidence?.derivedMetrics?.evidenceHealth;
  const approvalRate = evidence?.derivedMetrics?.approvalRate ?? null;
  const openIssues = evidence?.evidenceCounts?.lessonIssues;
  const masteryScore = learning?.derivedMetrics?.masteryScore ?? null;
  const autopilotRuns = Number(evidence?.evidenceCounts?.autopilotRuns) || 0;
  const reviewedItems =
    (Number(evidence?.evidenceCounts?.autopilotApprovals) || 0) + (Number(evidence?.evidenceCounts?.autopilotRejections) || 0);
  const quizAttempts = Number(learning?.quizStats?.attempts) || 0;

  evidenceSample.autopilotRuns = autopilotRuns;
  evidenceSample.reviewedItems = reviewedItems;
  evidenceSample.quizAttempts = quizAttempts;

  let promptPackApproval = null;
  if (promptPackId && promptPackVersion) {
    const pack = (feedbackByPack?.promptPacks || []).find(
      (p) => (p.promptPackId || "").toLowerCase() === (promptPackId || "").toLowerCase() &&
        (p.promptPackVersion || "").toLowerCase() === (promptPackVersion || "").toLowerCase()
    );
    promptPackApproval = pack?.approvalRate ?? null;
  }

  const safeModeActivated =
    evidenceHealth === SAFE_MODE_EVIDENCE_HEALTH &&
    (approvalRate ?? 0) >= SAFE_MODE_APPROVAL_RATE &&
    (promptPackApproval ?? 0) >= SAFE_MODE_PROMPT_PACK_APPROVAL &&
    (masteryScore ?? 0) >= SAFE_MODE_MASTERY_SCORE &&
    (openIssues ?? 999) === SAFE_MODE_OPEN_ISSUES &&
    gate?.gateStatus === SAFE_MODE_GATE_STATUS &&
    autopilotRuns >= SAFE_MODE_MIN_AUTOPILOT_RUNS &&
    reviewedItems >= SAFE_MODE_MIN_REVIEWED_ITEMS &&
    quizAttempts >= SAFE_MODE_MIN_QUIZ_ATTEMPTS;

  return { safeModeActivated, evidenceSample };
}

/**
 * Execute a single autopilot action. In dryRun, returns planned result without writing.
 */
async function executeAutopilotAction({ specKey, topicKey, action, dryRun, adminUserId, promptPack, initialStatus = "draft" }) {
  const result = { type: action, status: "skipped", reason: null, createdCount: 0 };
  if (dryRun) {
    result.status = "planned";
    result.reason = "dry_run";
    return result;
  }
  if (!adminUserId) {
    result.reason = "adminUserId required";
    return result;
  }
  const topic = (topicKey || "").includes(":") ? topicKey : `${specKey}:${(topicKey || "").trim()}`;
  try {
    if (action === "generate_flashcards") {
      const r = await autopilotGenerationAdapters.generateFlashcardsForTopic({
        specKey,
        topicKey: topic,
        count: FLASHCARD_THRESHOLD,
        adminUserId,
        promptPack,
      });
      if (r.status === "generated") {
        result.status = "generated";
        result.createdCount = r.createdCount ?? 0;
        result.ids = r.ids;
      } else {
        result.reason = r.reason || "generation_not_available";
      }
    } else if (action === "generate_quiz") {
      const r = await autopilotGenerationAdapters.generateQuizForTopic({
        specKey,
        topicKey: topic,
        count: QUIZ_THRESHOLD,
        adminUserId,
        promptPack,
        initialStatus,
      });
      if (r.status === "generated") {
        result.status = "generated";
        result.createdCount = r.createdCount ?? 0;
        result.ids = r.ids;
      } else {
        result.reason = r.reason || "generation_not_available";
      }
    } else if (action === "generate_exam_questions") {
      const r = await autopilotGenerationAdapters.generateExamQuestionsForTopic({
        specKey,
        topicKey: topic,
        count: EXAM_THRESHOLD,
        adminUserId,
        promptPack,
        initialStatus,
      });
      if (r.status === "generated") {
        result.status = "generated";
        result.createdCount = r.createdCount ?? 0;
        result.ids = r.ids;
      } else {
        result.reason = r.reason || "generation_not_available";
      }
    } else {
      result.reason = "unsupported_action";
    }
  } catch (e) {
    result.status = "failed";
    result.reason = e?.message || "generation_error";
  }
  return result;
}

/**
 * Map coverage from contentCoverageService to snapshot shape for storage.
 */
function toCoverageSnapshot(coverage) {
  if (!coverage) return null;
  return {
    score: coverage.coverageScore ?? null,
    status: coverage.status ?? null,
    counts: {
      lessons: coverage.lessonCount ?? null,
      flashcards: coverage.flashcardCount ?? null,
      quizzes: coverage.quizCount ?? null,
      examQuestions: coverage.examQuestionCount ?? null,
      openIssues: coverage.issueCount ?? null,
    },
  };
}

/**
 * Rebuild graph for topic and recompute coverage after autopilot generation.
 */
async function refreshTopicAfterAutopilot({ specKey, topicKey }) {
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  const candidates = queryCandidates(specKey, topicOnly);
  const topicNode = await contentGraphService.resolveTopicNode(specKey, topicOnly);
  if (!topicNode) return { graphRebuilt: false };
  const lessons = await Lesson.find({ topicKey: { $in: candidates } }).lean();
  const flashcards = await TopicFlashcard.find({
    topicKey: { $in: candidates },
    isArchived: { $ne: true },
  }).lean();
  const quizQuestions = await TopicQuizQuestion.find({
    topicKey: { $in: candidates },
    isArchived: { $ne: true },
  }).lean();
  const examQuestions = await ExamQuestion.find({
    topicKey: { $in: candidates },
  }).lean();
  for (const l of lessons) await contentGraphService.linkLessonToTopic(l);
  for (const fc of flashcards) await contentGraphService.linkFlashcardToTopic(fc);
  for (const q of quizQuestions) await contentGraphService.linkQuizQuestionToTopic(q);
  for (const eq of examQuestions) await contentGraphService.linkQuestionToTopic(eq);
  const coverage = await contentCoverageService.getTopicCoverage(specKey, topicOnly);
  return {
    graphRebuilt: true,
    updatedCoverage: coverage
      ? {
          lessonCount: coverage.lessonCount,
          flashcardCount: coverage.flashcardCount,
          quizCount: coverage.quizCount,
          examQuestionCount: coverage.examQuestionCount,
          issueCount: coverage.issueCount,
          coverageScore: coverage.coverageScore,
          status: coverage.status,
          weakAreas: coverage.weakAreas,
        }
      : null,
  };
}

/**
 * Compute run status from topic results.
 */
function computeRunStatus(topicResults, topLevelError) {
  if (topLevelError) return "failed";
  const hasFailed = topicResults.some((tr) =>
    (tr.executedActions || []).some((a) => a.status === "failed")
  );
  const hasGenerated = topicResults.some((tr) =>
    (tr.executedActions || []).some((a) => a.status === "generated")
  );
  const hasPlanned = topicResults.some((tr) =>
    (tr.executedActions || []).some((a) => a.status === "planned")
  );
  if (hasFailed && hasGenerated) return "partial";
  if (hasFailed) return "failed";
  if (hasGenerated || hasPlanned) return "completed";
  return "failed";
}

/**
 * Save autopilot run to audit trail. Never throws; logs errors safely.
 */
async function saveAutopilotRun(payload) {
  try {
    await AutopilotRun.create(payload);
  } catch (e) {
    console.error("[autopilot] saveAutopilotRun failed:", e?.message || e);
  }
}

/**
 * Resolve prompt pack from optional id/version. Returns { pack, error }.
 */
function resolvePromptPack(promptPackId, promptPackVersion) {
  if (!promptPackId && !promptPackVersion) {
    return { pack: getCurrentAutopilotPromptPack(), error: null };
  }
  const { pack, error } = getAutopilotPromptPackById(promptPackId, promptPackVersion);
  if (error) return { pack: null, error };
  return { pack: { promptPackId: pack.promptPackId, promptPackVersion: pack.promptPackVersion, generatorMode: pack.generatorMode }, error: null };
}

/**
 * Run autopilot for a single topic.
 * @param {{ specKey, topicKey, actions?, dryRun?, adminUserId?, promptPackId?, promptPackVersion? }}
 */
async function runTopicAutopilot({ specKey, topicKey, actions, dryRun = false, adminUserId, promptPackId, promptPackVersion }) {
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  const topicFullForGroup = (topicKey || "").includes(":") ? topicKey : `${specKey}:${(topicOnly || "").trim()}`;
  if (await adminTaxonomyService.topicIsGroupInMerged(specKey, topicFullForGroup)) {
    const errResult = {
      specKey,
      topicKey: topicOnly,
      topicTitle: topicOnly,
      dryRun,
      gapSummary: null,
      plannedActions: [],
      executedActions: [],
      graphRebuilt: false,
      updatedCoverage: null,
      requiresReview: true,
      gateStatus: "block",
      gateReasons: ["Topic is a group folder; select a leaf sub-topic."],
      allowedActions: [],
      blockedActions: autopilotGatingService.ALL_ACTIONS,
      error: "Topic is a group",
    };
    saveAutopilotRun({
      runType: "topic",
      specKey,
      topicKey: topicOnly,
      dryRun,
      triggeredByUserId: adminUserId || null,
      status: "failed",
      errorMessage: "Topic is a group",
      topicResults: [],
    }).catch(() => {});
    return errResult;
  }
  let resolvedPack;
  let experimentIdRes = null;

  if (promptPackId || promptPackVersion) {
    const { pack, error } = resolvePromptPack(promptPackId, promptPackVersion);
    if (error) throw new Error(error);
    resolvedPack = pack;
  } else {
    const topicFull = (topicKey || "").includes(":") ? topicKey : `${specKey}:${(topicOnly || "").trim()}`;
    const r = await resolvePromptPackForRun({ specKey, topicKey: topicFull, requestedPack: null });
    if (r.error) throw new Error(r.error);
    resolvedPack = r.pack;
    experimentIdRes = r.experimentId || null;
  }

  const promptPackIdRes = resolvedPack.promptPackId;
  const promptPackVersionRes = resolvedPack.promptPackVersion;

  const gap = await curriculumGapDetectionService.detectSingleTopicGap(specKey, topicOnly);
  if (!gap) {
    const errResult = {
      specKey,
      topicKey: topicOnly,
      topicTitle: topicOnly,
      dryRun,
      gapSummary: null,
      plannedActions: [],
      executedActions: [],
      graphRebuilt: false,
      updatedCoverage: null,
      requiresReview: false,
      gateStatus: "block",
      gateReasons: ["Topic not found."],
      allowedActions: [],
      blockedActions: autopilotGatingService.ALL_ACTIONS,
      error: "Topic not found",
    };
    saveAutopilotRun({
      runType: "topic",
      specKey,
      topicKey: topicOnly,
      dryRun,
      triggeredByUserId: adminUserId || null,
      status: "failed",
      errorMessage: "Topic not found",
      topicResults: [],
    }).catch(() => {});
    return errResult;
  }

  const gate = await autopilotGatingService.getAutopilotGate(specKey, topicOnly);
  const { actions: gapPlannedActions, requiresReview: gapRequiresReview } = decideAutopilotActions(gap, actions);
  let plannedActions = gapPlannedActions;
  let requiresReview = gapRequiresReview;

  if (gate.gateStatus === "block" || gate.gateStatus === "review_required") {
    plannedActions = [];
    requiresReview = true;
  } else if (gate.gateStatus === "limited") {
    plannedActions = gapPlannedActions.filter((a) => gate.allowedActions.includes(a));
  }

  const gapSummary = {
    counts: gap.counts,
    coverageScore: gap.coverageScore,
    coverageStatus: gap.coverageStatus,
    gapFlags: gap.gapFlags,
    priorityScore: gap.priorityScore,
  };

  let coverageBefore = null;
  try {
    const cov = await contentCoverageService.getTopicCoverage(specKey, topicOnly);
    coverageBefore = toCoverageSnapshot(cov);
  } catch (e) {
    console.warn("[autopilot] coverageBefore snapshot failed:", e?.message || e);
  }

  let safeModeActivated = false;
  let safeModeEvidenceSample = { autopilotRuns: 0, reviewedItems: 0, quizAttempts: 0 };
  if (!dryRun && !requiresReview) {
    const safeModeResult = await computeSafeMode(specKey, topicOnly, gate, promptPackIdRes, promptPackVersionRes);
    safeModeActivated = safeModeResult.safeModeActivated;
    safeModeEvidenceSample = safeModeResult.evidenceSample || safeModeEvidenceSample;
  }
  const initialStatus = safeModeActivated ? "published" : "draft";

  const executedActions = [];
  let graphRebuilt = false;
  let updatedCoverage = null;
  const executedTypes = new Set();
  if (requiresReview) {
    const skipReason =
      gate.gateStatus === "block"
        ? gate.reasons?.[0] || "Autopilot blocked for this topic."
        : gate.gateStatus === "review_required"
        ? gate.reasons?.[0] || "Review required; no automatic execution."
        : "Skipped due to high issue count; review content first";
    executedActions.push({
      type: "all",
      status: "skipped",
      reason: skipReason,
    });
  } else {
    for (const action of plannedActions) {
      if (executedTypes.has(action)) continue;
      executedTypes.add(action);
      const result = await executeAutopilotAction({
        specKey,
        topicKey: topicOnly,
        action,
        dryRun,
        adminUserId,
        promptPack: resolvedPack,
        initialStatus,
      });
      executedActions.push(result);
    }
    if (!dryRun && executedActions.some((r) => r.status === "generated")) {
      const refresh = await refreshTopicAfterAutopilot({ specKey, topicKey: topicOnly });
      graphRebuilt = refresh.graphRebuilt;
      updatedCoverage = refresh.updatedCoverage;
    }
  }

  let coverageAfter = null;
  let coverageLift = null;
  if (dryRun) {
    coverageAfter = coverageBefore;
    coverageLift = 0;
  } else if (updatedCoverage) {
    coverageAfter = toCoverageSnapshot(updatedCoverage);
    coverageLift = (coverageAfter?.score ?? 0) - (coverageBefore?.score ?? 0);
  } else {
    coverageAfter = coverageBefore;
    coverageLift = 0;
  }

  const result = {
    specKey,
    topicKey: topicOnly,
    topicTitle: gap.topicTitle || topicOnly,
    dryRun,
    gapSummary,
    plannedActions,
    executedActions,
    graphRebuilt,
    updatedCoverage,
    requiresReview,
    coverageBefore,
    coverageAfter,
    coverageLift,
    promptPackId: promptPackIdRes,
    promptPackVersion: promptPackVersionRes,
    experimentId: experimentIdRes,
    gateStatus: gate.gateStatus,
    gateReasons: gate.reasons,
    allowedActions: gate.allowedActions,
    blockedActions: gate.blockedActions,
    gateSummary: gate.summary,
    safeModeActivated,
    safeModeEvidenceSample,
  };
  const topicResults = [
    {
      topicKey: topicOnly,
      topicTitle: gap.topicTitle || topicOnly,
      requiresReview,
      plannedActions,
      executedActions: executedActions.map((a) => ({
        type: a.type,
        status: a.status === "planned" ? "planned" : a.status,
        createdCount: a.createdCount ?? null,
        reason: a.reason ?? null,
        promptPackId: promptPackIdRes || undefined,
        promptPackVersion: promptPackVersionRes || undefined,
      })),
      updatedCoverage: updatedCoverage ? { score: updatedCoverage.coverageScore, status: updatedCoverage.status } : undefined,
      coverageBefore: coverageBefore || undefined,
      coverageAfter: coverageAfter || undefined,
      coverageLift: coverageLift != null ? coverageLift : undefined,
    },
  ];
  const status = computeRunStatus(topicResults, false);
  const genFlash = executedActions.filter((a) => a.type === "generate_flashcards" && a.status === "generated").reduce((s, a) => s + (a.createdCount || 0), 0);
  const genQuiz = executedActions.filter((a) => a.type === "generate_quiz" && a.status === "generated").reduce((s, a) => s + (a.createdCount || 0), 0);
  const genExam = executedActions.filter((a) => a.type === "generate_exam_questions" && a.status === "generated").reduce((s, a) => s + (a.createdCount || 0), 0);
  const validReviewerId = adminUserId && mongoose.Types.ObjectId.isValid(adminUserId) ? adminUserId : null;
  saveAutopilotRun({
    runType: "topic",
    specKey,
    topicKey: topicOnly,
    dryRun,
    triggeredByUserId: validReviewerId,
    status,
    requestedActions: actions || undefined,
    plannedTopicCount: 1,
    executedTopicCount: requiresReview ? 0 : 1,
    skippedTopicCount: requiresReview ? 1 : 0,
    failedTopicCount: executedActions.some((a) => a.status === "failed") ? 1 : 0,
    summary: {
      generatedFlashcards: genFlash || null,
      generatedQuizzes: genQuiz || null,
      generatedExamQuestions: genExam || null,
      skippedActions: executedActions.filter((a) => a.status === "skipped" || a.status === "planned").length || null,
      failedActions: executedActions.filter((a) => a.status === "failed").length || null,
    },
    topicResults,
    promptPackId: promptPackIdRes || null,
    promptPackVersion: promptPackVersionRes || null,
    safeModeActivated: safeModeActivated || false,
    safeModeEvidenceSample: safeModeEvidenceSample || undefined,
  }).catch(() => {});
  return result;
}

/**
 * Run autopilot for a spec. Fetches ranked gaps, runs on matching topics.
 * @param {{ specKey, limit?, dryRun?, minPriorityScore?, adminUserId?, promptPackId?, promptPackVersion? }}
 */
async function runSpecAutopilot({ specKey, limit = 20, dryRun = false, minPriorityScore = 0, adminUserId, promptPackId, promptPackVersion }) {
  const hasExplicitPack = !!(promptPackId || promptPackVersion);
  if (hasExplicitPack) {
    const { pack, error } = resolvePromptPack(promptPackId, promptPackVersion);
    if (error) throw new Error(error);
  }

  const gaps = await curriculumGapDetectionService.detectTopicGaps(specKey);
  const filtered = gaps.filter((g) => (g.priorityScore ?? 0) >= minPriorityScore && !(g.gapFlags?.highIssueRate));
  const toProcess = limit > 0 ? filtered.slice(0, limit) : filtered;
  const results = [];
  for (const gap of toProcess) {
    const topicKey = gap.topicKey || "";
    if (!topicKey) continue;
    const result = await runTopicAutopilot({
      specKey,
      topicKey,
      actions: undefined,
      dryRun,
      adminUserId,
      promptPackId: hasExplicitPack ? promptPackId : undefined,
      promptPackVersion: hasExplicitPack ? promptPackVersion : undefined,
    });
    results.push(result);
  }
  const specSummary = {
    generated: results.filter((r) => r.executedActions?.some((a) => a.status === "generated")).length,
    skipped: results.filter((r) => r.requiresReview || r.executedActions?.every((a) => a.status === "skipped" || a.status === "planned")).length,
    failed: results.filter((r) => r.executedActions?.some((a) => a.status === "failed")).length,
  };
  const anySafeMode = results.some((r) => r.safeModeActivated === true);
  const topicResults = results.map((r) => ({
    topicKey: r.topicKey,
    topicTitle: r.topicTitle,
    requiresReview: r.requiresReview,
    plannedActions: r.plannedActions,
    executedActions: (r.executedActions || []).map((a) => ({
      type: a.type,
      status: a.status === "planned" ? "planned" : a.status,
      createdCount: a.createdCount ?? null,
      reason: a.reason ?? null,
      promptPackId: (r.promptPackId || a.promptPackId) || undefined,
      promptPackVersion: (r.promptPackVersion || a.promptPackVersion) || undefined,
    })),
    updatedCoverage: r.updatedCoverage ? { score: r.updatedCoverage.coverageScore, status: r.updatedCoverage.status } : undefined,
    coverageBefore: r.coverageBefore || undefined,
    coverageAfter: r.coverageAfter || undefined,
    coverageLift: r.coverageLift != null ? r.coverageLift : undefined,
  }));
  const hasFailed = specSummary.failed > 0;
  const hasGenerated = specSummary.generated > 0;
  const status = hasFailed && hasGenerated ? "partial" : hasFailed ? "failed" : "completed";
  const genFlash = results.reduce(
    (s, r) =>
      s +
      (r.executedActions || [])
        .filter((a) => a.type === "generate_flashcards" && a.status === "generated")
        .reduce((sum, a) => sum + (a.createdCount || 0), 0),
    0
  );
  const genQuiz = results.reduce(
    (s, r) =>
      s +
      (r.executedActions || [])
        .filter((a) => a.type === "generate_quiz" && a.status === "generated")
        .reduce((sum, a) => sum + (a.createdCount || 0), 0),
    0
  );
  const genExam = results.reduce(
    (s, r) =>
      s +
      (r.executedActions || [])
        .filter((a) => a.type === "generate_exam_questions" && a.status === "generated")
        .reduce((sum, a) => sum + (a.createdCount || 0), 0),
    0
  );
  const firstTopicSample = results[0]?.safeModeEvidenceSample || { autopilotRuns: null, reviewedItems: null, quizAttempts: null };
  const validReviewerId = adminUserId && mongoose.Types.ObjectId.isValid(adminUserId) ? adminUserId : null;
  saveAutopilotRun({
    runType: "spec",
    specKey,
    topicKey: null,
    dryRun,
    triggeredByUserId: validReviewerId,
    status,
    minPriorityScore: minPriorityScore || null,
    limit: limit || null,
    plannedTopicCount: toProcess.length,
    executedTopicCount: results.length,
    skippedTopicCount: specSummary.skipped,
    failedTopicCount: specSummary.failed,
    summary: {
      generatedFlashcards: genFlash || null,
      generatedQuizzes: genQuiz || null,
      generatedExamQuestions: genExam || null,
      skippedActions: results.reduce(
        (s, r) => s + (r.executedActions || []).filter((a) => a.status === "skipped" || a.status === "planned").length,
        0
      ) || null,
      failedActions: results.reduce(
        (s, r) => s + (r.executedActions || []).filter((a) => a.status === "failed").length,
        0
      ) || null,
    },
    topicResults,
    promptPackId: (results[0]?.promptPackId) || null,
    promptPackVersion: (results[0]?.promptPackVersion) || null,
    experimentId: (results[0]?.experimentId) || null,
    safeModeActivated: anySafeMode || false,
    safeModeEvidenceSample: firstTopicSample,
  }).catch(() => {});
  return {
    specKey,
    dryRun,
    totalProcessed: results.length,
    results,
    summary: specSummary,
  };
}

/**
 * Preview planned actions for a spec (no writes).
 */
async function previewSpecAutopilot(specKey, limit = 20, minPriorityScore = 0) {
  const gaps = await curriculumGapDetectionService.detectTopicGaps(specKey);
  const filtered = gaps.filter((g) => (g.priorityScore ?? 0) >= minPriorityScore);
  const toProcess = limit > 0 ? filtered.slice(0, limit) : filtered;
  const previews = [];
  for (const gap of toProcess) {
    const { actions, requiresReview } = decideAutopilotActions(gap);
    previews.push({
      specKey,
      topicKey: gap.topicKey,
      topicTitle: gap.topicTitle,
      plannedActions: requiresReview ? [] : actions,
      requiresReview,
      counts: gap.counts,
      priorityScore: gap.priorityScore,
    });
  }
  return { specKey, previews };
}

module.exports = {
  runTopicAutopilot,
  runSpecAutopilot,
  decideAutopilotActions,
  executeAutopilotAction,
  refreshTopicAfterAutopilot,
  previewSpecAutopilot,
  computeSafeMode,
};
