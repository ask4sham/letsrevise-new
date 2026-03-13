/**
 * Content Coverage Service — computes topic/spec/lesson coverage from content graph.
 * Coverage scoring v1: lesson=+30, >=5 flashcards=+20, >=3 quiz=+20, >=2 exam=+20, issue penalty up to -10.
 */
const contentGraphService = require("./contentGraphService");
const adminTaxonomyService = require("./adminTaxonomyService");
const LessonIssueReport = require("../models/LessonIssueReport");
const { parseTopicKey } = require("../utils/topicKey");
const mongoose = require("mongoose");

/** Scoring weights (v1) */
const SCORE_LESSON = 30;
const SCORE_FLASHCARD_THRESHOLD = 5;
const SCORE_FLASHCARD_BONUS = 20;
const SCORE_QUIZ_THRESHOLD = 3;
const SCORE_QUIZ_BONUS = 20;
const SCORE_EXAM_THRESHOLD = 2;
const SCORE_EXAM_BONUS = 20;
const ISSUE_PENALTY_MAX = 10;

/**
 * Compute coverage score and status from counts.
 * @param {{ lessonCount: number, flashcardCount: number, quizCount: number, examQuestionCount: number }} counts
 * @param {number} issuePenalty - Penalty 0–10 from open lesson issues
 * @returns {{ score: number, status: 'weak'|'partial'|'strong', weakAreas: string[] }}
 */
function computeCoverageScore(counts, issuePenalty = 0) {
  let score = 0;
  const weakAreas = [];

  if ((counts.lessonCount || 0) >= 1) score += SCORE_LESSON;
  else weakAreas.push("lessons");

  if ((counts.flashcardCount || 0) >= SCORE_FLASHCARD_THRESHOLD) score += SCORE_FLASHCARD_BONUS;
  else weakAreas.push("flashcards");

  if ((counts.quizCount || 0) >= SCORE_QUIZ_THRESHOLD) score += SCORE_QUIZ_BONUS;
  else weakAreas.push("quiz");

  if ((counts.examQuestionCount || 0) >= SCORE_EXAM_THRESHOLD) score += SCORE_EXAM_BONUS;
  else weakAreas.push("exam");

  const penalty = Math.min(issuePenalty, ISSUE_PENALTY_MAX);
  score = Math.max(0, score - penalty);
  if (penalty > 0) weakAreas.push("issues");

  let status = "weak";
  if (score >= 70) status = "strong";
  else if (score >= 40) status = "partial";

  return { score, status, weakAreas };
}

/**
 * Get issue penalty for lessons linked to a topic (open issue count, max 10).
 */
async function getIssuePenaltyForLessons(lessonIds) {
  if (!lessonIds || lessonIds.length === 0) return 0;
  const ids = lessonIds.map((id) => new mongoose.Types.ObjectId(id));
  const openCount = await LessonIssueReport.countDocuments({
    lessonId: { $in: ids },
    status: "open",
  });
  return Math.min(openCount, ISSUE_PENALTY_MAX);
}

/**
 * Get topic coverage: counts, score, status, weakAreas.
 */
async function getTopicCoverage(specKey, topicKey) {
  const summary = await contentGraphService.getCoverageSummary(specKey, topicKey);
  if (!summary) return null;

  const lessonIds = await getLessonIdsForTopic(specKey, topicKey);
  const openIssueCount = lessonIds.length
    ? await LessonIssueReport.countDocuments({
        lessonId: { $in: lessonIds.map((id) => new mongoose.Types.ObjectId(id)) },
        status: "open",
      })
    : 0;
  const issuePenalty = Math.min(openIssueCount, ISSUE_PENALTY_MAX);
  const { score, status, weakAreas } = computeCoverageScore(summary, issuePenalty);

  return {
    specKey: specKey || parseTopicKey(topicKey || "").specKey,
    topicKey: topicKey || parseTopicKey(topicKey || "").topicKey,
    lessonCount: summary.lessonCount,
    flashcardCount: summary.flashcardCount,
    quizCount: summary.quizCount,
    examQuestionCount: summary.examQuestionCount,
    issueCount: openIssueCount,
    coverageScore: score,
    status,
    weakAreas,
  };
}

/**
 * Helper: get lesson IDs linked to a topic via graph.
 */
async function getLessonIdsForTopic(specKey, topicKey) {
  const graph = await contentGraphService.getTopicGraph(specKey, topicKey);
  if (!graph || !graph.linkedNodes) return [];
  const lessonNodes = graph.linkedNodes.filter((n) => n.nodeType === "lesson" && n.lessonId);
  return lessonNodes.map((n) => n.lessonId).filter(Boolean);
}

/**
 * Normalize coverage to stable shape with counts object.
 */
function normalizeCoverageResponse(cov) {
  if (!cov) return null;
  return {
    specKey: cov.specKey || "",
    topicKey: cov.topicKey || "",
    counts: {
      lessons: cov.lessonCount ?? 0,
      flashcards: cov.flashcardCount ?? 0,
      quizzes: cov.quizCount ?? 0,
      examQuestions: cov.examQuestionCount ?? 0,
      openIssues: cov.issueCount ?? 0,
    },
    score: cov.coverageScore ?? 0,
    status: cov.status || "weak",
    weakAreas: Array.isArray(cov.weakAreas) ? [...new Set(cov.weakAreas)] : [],
  };
}

/**
 * Get spec-level coverage: all topics with their coverage. Parallelized.
 */
async function getSpecCoverage(specKey) {
  const taxonomy = await adminTaxonomyService.getMergedTaxonomyBySpecKey(specKey);
  if (!taxonomy || !Array.isArray(taxonomy.units)) return null;

  const topicEntries = [];
  for (const unit of taxonomy.units) {
    for (const t of unit.topics || []) {
      const key = t.key || t.topicKey;
      if (!key) continue;
      const topicKey = key.includes(":") ? key : `${specKey}:${key}`;
      topicEntries.push({ topicKey, unit: unit.unit, unitKey: unit.unitKey });
    }
  }

  const results = await Promise.all(
    topicEntries.map(({ topicKey, unit, unitKey }) =>
      getTopicCoverage(specKey, topicKey).then((cov) => (cov ? { ...cov, unit, unitKey } : null))
    )
  );

  const topics = results.filter(Boolean);

  return {
    specKey,
    topics,
    totalTopics: topics.length,
  };
}

/**
 * Get lesson coverage: linked topics and their coverage for this lesson.
 */
async function getLessonCoverage(lessonId) {
  const graph = await contentGraphService.getLessonGraph(lessonId);
  if (!graph || !graph.lesson) return null;

  const topicCoverages = [];
  for (const tn of graph.topicNodes || []) {
    const specKey = tn.specKey || graph.lesson?.specKey;
    const topicKey = tn.topicKey || tn.canonicalKey;
    if (!specKey || !topicKey) continue;
    const cov = await getTopicCoverage(specKey, topicKey);
    if (cov) topicCoverages.push(cov);
  }

  return {
    lessonId,
    lesson: graph.lesson,
    lessonNode: graph.lessonNode,
    topicCoverages,
  };
}

module.exports = {
  getTopicCoverage,
  getSpecCoverage,
  getLessonCoverage,
  computeCoverageScore,
  normalizeCoverageResponse,
};
