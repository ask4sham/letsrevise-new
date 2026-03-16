/**
 * Topic Intelligence Service — aggregates all topic signals into a unified Command Center view.
 * Orchestration only; no logic duplication. Calls existing services.
 */
const contentCoverageService = require("./contentCoverageService");
const curriculumGapDetectionService = require("./curriculumGapDetectionService");
const autopilotReadinessService = require("./autopilotReadinessService");
const topicEvidenceService = require("./topicEvidenceService");
const evidenceReviewWorklistService = require("./evidenceReviewWorklistService");
const studentTopicEvidenceService = require("./studentTopicEvidenceService");
const autopilotOutcomesService = require("./autopilotOutcomesService");
const autopilotFeedbackService = require("./autopilotFeedbackService");
const autopilotGatingService = require("./autopilotGatingService");
const adminTaxonomyService = require("./adminTaxonomyService");
const SpecStatement = require("../models/SpecStatement");
const TopicFlashcard = require("../models/TopicFlashcard");
const ExamQuestion = require("../models/ExamQuestion");
const { queryCandidates } = require("../utils/topicKey");

/**
 * Resolve topic-only key (unprefixed) for services that expect it.
 */
function topicOnly(topicKey) {
  return (topicKey || "").split(":").pop() || topicKey || "";
}

/**
 * Resolve topic-full key (specKey:topicKey) when needed.
 */
function topicFull(specKey, topicKey) {
  const to = topicOnly(topicKey);
  if ((topicKey || "").includes(":")) return topicKey;
  return specKey ? `${specKey}:${to}`.replace(/^:/, "") : to;
}

/**
 * Extract taxonomy path from merged taxonomy for a topic.
 */
function findTopicInTaxonomy(taxonomy, topicOnlyKey) {
  if (!taxonomy?.units) return null;
  const slug = (topicOnlyKey || "").toLowerCase();
  for (const unit of taxonomy.units) {
    for (const t of unit.topics || []) {
      const key = (t.key || t.topicKey || "").toLowerCase();
      if (key === slug) {
        return {
          subject: taxonomy.subject || "",
          spec: taxonomy.specKey || taxonomy.examBoard || "",
          mainTopic: unit.unit || unit.unitKey || "",
          section: null,
          topic: t.topic || t.key || topicOnlyKey,
        };
      }
    }
  }
  return null;
}

/**
 * Build recommended actions from topic intelligence.
 * Simple, explainable rules. Returns prioritized list.
 */
function buildTopicRecommendedActions(topicIntelligence) {
  const actions = [];
  const gap = topicIntelligence?.gapAnalysis || {};
  const evidenceHealth = topicIntelligence?.evidenceHealth || {};
  const evidenceReview = topicIntelligence?.evidenceReview || {};
  const learning = topicIntelligence?.learningEvidence || {};
  const autopilot = topicIntelligence?.autopilot || {};
  const readiness = topicIntelligence?.readiness || {};

  const priorityScore = gap.priorityScore ?? 0;
  const health = evidenceHealth.evidenceHealth || "unknown";
  const approvalRate = evidenceHealth.approvalRate ?? null;
  const masteryScore = learning.masteryScore ?? null;
  const runs = autopilot.runs ?? 0;
  const gateStatus = evidenceReview.gateStatus || readiness?.blockers?.length ? "block" : "allow";

  // High gap priority → generate content
  if (priorityScore >= 30) {
    const gapFlags = gap.gapFlags || {};
    if (gapFlags.missingLesson) {
      actions.push({ action: "create_lesson", label: "Create lesson", reason: "No lesson exists for this topic." });
    }
    if (gapFlags.lowFlashcards) {
      actions.push({ action: "generate_flashcards", label: "Generate flashcards", reason: "Flashcard coverage is low." });
    }
    if (gapFlags.lowQuizzes && !actions.some((a) => a.action === "generate_flashcards")) {
      actions.push({ action: "generate_quiz", label: "Generate quiz", reason: "Quiz coverage is low." });
    }
  }

  // Evidence health weak → review content
  if (health === "weak") {
    actions.push({ action: "review_content", label: "Review content", reason: "Evidence health is weak; review lesson content." });
  }

  // Low approval rate → inspect rejections
  if (approvalRate !== null && approvalRate < 60) {
    actions.push({ action: "inspect_rejections", label: "Inspect rejections", reason: "Autopilot approval rate is low; inspect rejection reasons." });
  }

  // Low mastery score → revise explanation
  if (masteryScore !== null && masteryScore < 65) {
    actions.push({ action: "revise_explanation", label: "Revise explanation", reason: "Student mastery is low; consider revising explanations." });
  }

  // Zero autopilot runs → run autopilot
  if (runs === 0 && readiness?.ready) {
    actions.push({ action: "run_autopilot", label: "Run autopilot", reason: "No autopilot runs yet; topic is ready." });
  }

  // Mapping problems (blockers mention mapping/graph)
  const blockers = readiness?.blockers || [];
  const reasons = evidenceReview.reasons || [];
  const hasMappingProblem = [...blockers, ...reasons].some(
    (r) => r && (r.includes("mapping") || r.includes("graph") || r.includes("Topic graph") || r.includes("taxonomy"))
  );
  if (hasMappingProblem) {
    actions.push({ action: "fix_taxonomy_mapping", label: "Fix taxonomy mapping", reason: "Topic mapping or graph issues detected." });
  }

  // Gate blocked or review_required → open evidence review
  if (gateStatus === "block" || gateStatus === "review_required") {
    actions.push({ action: "open_evidence_review", label: "Open evidence review", reason: "Topic requires evidence review." });
  }

  // Dedupe by action, keep first occurrence (priority order)
  const seen = new Set();
  return actions.filter((a) => {
    if (seen.has(a.action)) return false;
    seen.add(a.action);
    return true;
  });
}

/**
 * Get draft library counts for a topic (flashcards and exam questions with generatorMode: draft_library).
 */
async function getDraftLibraryCounts(specKey, topicOnly) {
  const candidates = queryCandidates(specKey, topicOnly);
  if (candidates.length === 0) return { flashcards: 0, examQuestions: 0, lastGeneratedAt: null };
  const baseQuery = { topicKey: { $in: candidates }, status: "draft", "metadata.generatorMode": "draft_library" };
  const [fcCount, eqCount, fcLatest, eqLatest] = await Promise.all([
    TopicFlashcard.countDocuments(baseQuery),
    ExamQuestion.countDocuments(baseQuery),
    TopicFlashcard.findOne(baseQuery).sort({ "metadata.generatedAt": -1, createdAt: -1 }).select("metadata.generatedAt createdAt").lean(),
    ExamQuestion.findOne(baseQuery).sort({ "metadata.generatedAt": -1, createdAt: -1 }).select("metadata.generatedAt createdAt").lean(),
  ]);
  const dates = [fcLatest?.metadata?.generatedAt, fcLatest?.createdAt, eqLatest?.metadata?.generatedAt, eqLatest?.createdAt].filter(Boolean);
  const lastGeneratedAt = dates.length > 0 ? new Date(Math.max(...dates.map((d) => new Date(d).getTime()))).toISOString() : null;
  return { flashcards: fcCount, examQuestions: eqCount, lastGeneratedAt };
}

/**
 * Get Topic Command Center — unified operational view for a topic.
 * Aggregates: curriculum, coverage, gap, readiness, evidence, learning, autopilot, prompt packs.
 */
async function getTopicCommandCenter(specKey, topicKey) {
  const to = topicOnly(topicKey);
  const tf = topicFull(specKey, topicKey);

  const [
    taxonomy,
    specStatements,
    coverage,
    gap,
    readiness,
    evidence,
    reviewItem,
    learning,
    autopilotOutcome,
    feedbackByTopic,
    feedbackByPromptPack,
    outcomesByPromptPack,
    gate,
    draftLibraryCounts,
  ] = await Promise.all([
    adminTaxonomyService.getMergedTaxonomyBySpecKey(specKey),
    SpecStatement.find({ specKey: specKey || "", topicKey: to }).select("statementCode statementText tier").sort({ statementCode: 1 }).lean(),
    contentCoverageService.getTopicCoverage(specKey, to),
    curriculumGapDetectionService.detectSingleTopicGap(specKey, to),
    autopilotReadinessService.getTopicAutopilotReadiness(specKey, to),
    topicEvidenceService.getTopicEvidence(specKey, to),
    evidenceReviewWorklistService.getEvidenceReviewItem(specKey, to),
    studentTopicEvidenceService.getTopicLearningEvidence(specKey, to),
    autopilotOutcomesService.getAutopilotOutcomeByTopic(specKey, tf, { days: 90 }),
    autopilotFeedbackService.getAutopilotFeedbackByTopic(specKey, tf, { days: 90 }),
    autopilotFeedbackService.getFeedbackByPromptPack({ specKey, topicKey: tf, days: 90 }),
    autopilotOutcomesService.getOutcomesByPromptPack({ specKey, topicKey: tf, days: 90 }),
    autopilotGatingService.getAutopilotGate(specKey, to),
    getDraftLibraryCounts(specKey, to),
  ]);

  const topicTitle =
    evidence?.topicTitle ||
    gap?.topicTitle ||
    findTopicInTaxonomy(taxonomy, to)?.topic ||
    to.replace(/-/g, " ");

  const taxonomyPath = findTopicInTaxonomy(taxonomy, to) || {
    subject: taxonomy?.subject || "",
    spec: taxonomy?.specKey || specKey || "",
    mainTopic: "",
    section: null,
    topic: topicTitle,
  };

  const coverageData = coverage
    ? {
        lessons: coverage.lessonCount ?? 0,
        flashcards: coverage.flashcardCount ?? 0,
        quizzes: coverage.quizCount ?? 0,
        examQuestions: coverage.examQuestionCount ?? 0,
        coverageScore: coverage.coverageScore ?? 0,
      }
    : { lessons: 0, flashcards: 0, quizzes: 0, examQuestions: 0, coverageScore: 0 };

  const gapData = gap
    ? {
        priorityScore: gap.priorityScore ?? 0,
        gapStatus: gap.coverageStatus || "weak",
      }
    : { priorityScore: 0, gapStatus: "weak" };

  const readinessData = readiness
    ? {
        ready: !!readiness.ready,
        blockers: readiness.blockers || [],
        availableActions: readiness.autopilotActionsAvailable || readiness.recommendedActions || [],
      }
    : { ready: false, blockers: ["Topic not found"], availableActions: [] };

  const evidenceHealthData = evidence
    ? {
        evidenceHealth: evidence.derivedMetrics?.evidenceHealth ?? "unknown",
        openIssues: evidence.evidenceCounts?.lessonIssues ?? 0,
        teacherRevisions: evidence.evidenceCounts?.teacherRevisions ?? 0,
        approvalRate: evidence.derivedMetrics?.approvalRate ?? null,
      }
    : { evidenceHealth: "unknown", openIssues: 0, teacherRevisions: 0, approvalRate: null };

  const evidenceReviewData = reviewItem
    ? {
        gateStatus: reviewItem.gateStatus || gate?.gateStatus || "allow",
        reasons: reviewItem.reasons || gate?.reasons || [],
        priorityScore: reviewItem.priorityScore ?? 0,
      }
    : {
        gateStatus: gate?.gateStatus || "allow",
        reasons: gate?.reasons || [],
        priorityScore: 0,
      };

  const learningData = learning
    ? {
        masteryScore: learning.derivedMetrics?.masteryScore ?? null,
        difficultyLevel: learning.derivedMetrics?.difficultyLevel ?? "unknown",
        quizAccuracy: learning.quizStats?.accuracy ?? null,
        examAccuracy: learning.examStats?.accuracy ?? null,
        flashcardDifficulty: learning.flashcardStats?.averageDifficulty ?? null,
        lessonCompletions: learning.lessonStats?.completions ?? 0,
      }
    : {
        masteryScore: null,
        difficultyLevel: "unknown",
        quizAccuracy: null,
        examAccuracy: null,
        flashcardDifficulty: null,
        lessonCompletions: 0,
      };

  const totals = autopilotOutcome?.totals || {};
  const topLift = (autopilotOutcome?.topCoverageLiftTopics || []).find(
    (t) => (t.topicKey || "").toLowerCase().includes(to.toLowerCase())
  );
  const lastRun = totals.runs > 0 ? await getLastRunDate(specKey, tf) : null;

  const autopilotData = {
    runs: totals.runs ?? 0,
    lastRunDate: lastRun,
    generatedFlashcards: totals.generatedFlashcards ?? 0,
    generatedQuizzes: totals.generatedQuizzes ?? 0,
    generatedExamQuestions: totals.generatedExamQuestions ?? 0,
    avgCoverageLift: topLift?.trueCoverageLift ?? topLift?.estimatedCoverageLift ?? null,
  };

  const feedbackPacks = feedbackByPromptPack?.promptPacks || [];
  const outcomesPacks = outcomesByPromptPack?.promptPacks || [];
  const packMap = new Map();
  for (const p of feedbackPacks) {
    const key = `${p.promptPackId}::${p.promptPackVersion}`;
    packMap.set(key, {
      promptPackId: p.promptPackId,
      promptPackVersion: p.promptPackVersion,
      approvalRate: p.approvalRate ?? null,
      runs: 0,
      avgCoverageLift: null,
    });
  }
  for (const p of outcomesPacks) {
    const key = `${p.promptPackId}::${p.promptPackVersion}`;
    const existing = packMap.get(key);
    if (existing) {
      existing.runs = p.runs ?? 0;
      existing.avgCoverageLift = p.avgCoverageLift ?? null;
    } else {
      packMap.set(key, {
        promptPackId: p.promptPackId,
        promptPackVersion: p.promptPackVersion,
        approvalRate: null,
        runs: p.runs ?? 0,
        avgCoverageLift: p.avgCoverageLift ?? null,
      });
    }
  }
  const promptPackPerformance = Array.from(packMap.values());

  const packApprovals = promptPackPerformance.map((p) => p.approvalRate ?? 0);
  const bestPromptPackApproval = packApprovals.length > 0 ? Math.max(...packApprovals) : 0;
  const autopilotRuns = Number(evidence?.evidenceCounts?.autopilotRuns) || 0;
  const reviewedItems =
    (Number(evidence?.evidenceCounts?.autopilotApprovals) || 0) + (Number(evidence?.evidenceCounts?.autopilotRejections) || 0);
  const quizAttempts = Number(learning?.quizStats?.attempts) || 0;
  const openIssues = evidenceHealthData.openIssues;
  const SAFE_MODE_MIN_AUTOPILOT_RUNS = 3;
  const SAFE_MODE_MIN_REVIEWED_ITEMS = 10;
  const SAFE_MODE_MIN_QUIZ_ATTEMPTS = 20;
  const safeModeEnabled =
    evidenceHealthData.evidenceHealth === "strong" &&
    (evidenceHealthData.approvalRate ?? 0) >= 85 &&
    bestPromptPackApproval >= 80 &&
    (learningData.masteryScore ?? 0) >= 70 &&
    (openIssues ?? 999) === 0 &&
    evidenceReviewData.gateStatus === "allow" &&
    autopilotRuns >= SAFE_MODE_MIN_AUTOPILOT_RUNS &&
    reviewedItems >= SAFE_MODE_MIN_REVIEWED_ITEMS &&
    quizAttempts >= SAFE_MODE_MIN_QUIZ_ATTEMPTS;

  const safeMode = {
    enabled: safeModeEnabled,
    evidenceSample: { autopilotRuns, reviewedItems, quizAttempts },
    thresholds: {
      autopilotRuns: SAFE_MODE_MIN_AUTOPILOT_RUNS,
      reviewedItems: SAFE_MODE_MIN_REVIEWED_ITEMS,
      quizAttempts: SAFE_MODE_MIN_QUIZ_ATTEMPTS,
    },
  };

  const draftLibraryData = draftLibraryCounts || { flashcards: 0, examQuestions: 0, lastGeneratedAt: null };

  const topicIntelligence = {
    specKey: specKey || "",
    topicKey: tf,
    topicTitle,
    taxonomy: taxonomyPath,
    draftLibrary: draftLibraryData,
    curriculum: {
      specStatementsCount: (specStatements || []).length,
      specStatements: (specStatements || []).map((s) => ({
        statementCode: s.statementCode,
        statementText: s.statementText,
        tier: s.tier,
      })),
    },
    coverage: coverageData,
    gapAnalysis: gapData,
    readiness: readinessData,
    evidenceHealth: evidenceHealthData,
    evidenceReview: evidenceReviewData,
    learningEvidence: learningData,
    autopilot: autopilotData,
    promptPackPerformance,
    safeMode,
  };

  topicIntelligence.recommendedActions = buildTopicRecommendedActions(topicIntelligence);

  return topicIntelligence;
}

async function getLastRunDate(specKey, topicKey) {
  const AutopilotRun = require("../models/AutopilotRun");
  const topicEscaped = (topicKey || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const specPattern = specKey ? (specKey || "").replace(/-/g, "[-_]") : null;
  const q = {};
  if (specPattern) q.specKey = new RegExp(`^${specPattern}`, "i");
  if (topicEscaped) q.topicKey = new RegExp(topicEscaped, "i");
  const run = await AutopilotRun.findOne(q).sort({ createdAt: -1 }).select("createdAt").lean();
  return run?.createdAt ? new Date(run.createdAt).toISOString() : null;
}

module.exports = {
  getTopicCommandCenter,
  buildTopicRecommendedActions,
  topicOnly,
  topicFull,
};
