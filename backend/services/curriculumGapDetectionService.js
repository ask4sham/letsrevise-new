/**
 * Curriculum Gap Detection — identifies weak curriculum areas from Content Graph + coverage.
 * Rules-based; no LLM dependency. Deterministic output.
 * Does NOT auto-modify lessons or banks; recommendations only.
 */
const contentCoverageService = require("./contentCoverageService");
const contentGraphService = require("./contentGraphService");
const adminTaxonomyService = require("./adminTaxonomyService");
const mongoose = require("mongoose");
const LessonIssueReport = require("../models/LessonIssueReport");
const { parseTopicKey } = require("../utils/topicKey");

// Priority scoring v1 (tunable)
const SCORE_NO_LESSON = 40;
const SCORE_LOW_FLASHCARDS = 15; // < 5
const SCORE_LOW_QUIZZES = 15; // < 3
const SCORE_LOW_EXAM = 20; // < 2
const SCORE_HIGH_ISSUES = 15; // >= 3 open issues
const SCORE_UNRESOLVED_MAPPINGS = 10;
const SCORE_WEAK_COVERAGE = 20; // < 40
const SCORE_PARTIAL_COVERAGE = 8; // 40–69

const FLASHCARD_THRESHOLD = 5;
const QUIZ_THRESHOLD = 3;
const EXAM_THRESHOLD = 2;
const HIGH_ISSUE_THRESHOLD = 3;

/**
 * Compute gap flags from counts and coverage.
 */
function computeGapFlags(counts, coverageScore, unresolvedMappings = false) {
  const lessons = counts?.lessons ?? 0;
  const flashcards = counts?.flashcards ?? 0;
  const quizzes = counts?.quizzes ?? 0;
  const examQuestions = counts?.examQuestions ?? 0;
  const openIssues = counts?.openIssues ?? 0;

  return {
    missingLesson: lessons < 1,
    lowFlashcards: flashcards < FLASHCARD_THRESHOLD,
    lowQuizzes: quizzes < QUIZ_THRESHOLD,
    lowExamQuestions: examQuestions < EXAM_THRESHOLD,
    highIssueRate: openIssues >= HIGH_ISSUE_THRESHOLD,
    unresolvedMappings: !!unresolvedMappings,
  };
}

/**
 * Compute priority score (higher = more urgent).
 */
function computePriorityScore(gapFlags, coverageScore) {
  let score = 0;
  if (gapFlags.missingLesson) score += SCORE_NO_LESSON;
  if (gapFlags.lowFlashcards) score += SCORE_LOW_FLASHCARDS;
  if (gapFlags.lowQuizzes) score += SCORE_LOW_QUIZZES;
  if (gapFlags.lowExamQuestions) score += SCORE_LOW_EXAM;
  if (gapFlags.highIssueRate) score += SCORE_HIGH_ISSUES;
  if (gapFlags.unresolvedMappings) score += SCORE_UNRESOLVED_MAPPINGS;
  if (coverageScore < 40) score += SCORE_WEAK_COVERAGE;
  else if (coverageScore >= 40 && coverageScore < 70) score += SCORE_PARTIAL_COVERAGE;
  return score;
}

/**
 * Build human-readable recommendations (no duplicates).
 */
function buildGapRecommendations(gap) {
  const recs = new Set();
  const flags = gap.gapFlags || {};
  const counts = gap.counts || {};

  if (flags.missingLesson) recs.add("Create a core lesson for this topic.");
  if (flags.lowFlashcards) recs.add("Generate at least 5 flashcards to improve recall coverage.");
  if (flags.lowQuizzes) recs.add("Add quiz questions to improve practice coverage.");
  if (flags.lowExamQuestions) recs.add("Add exam-style questions to improve assessment readiness.");
  if (flags.highIssueRate) recs.add("Review linked lessons due to high open issue volume.");
  if (flags.unresolvedMappings) recs.add("Review taxonomy/content mappings for unresolved legacy topic keys.");

  return [...recs];
}

/**
 * Build suggested actions for the gap.
 */
function buildSuggestedActions(gap) {
  const actions = [];
  const flags = gap.gapFlags || {};
  const counts = gap.counts || {};

  if (flags.missingLesson) {
    actions.push({
      type: "create_lesson",
      label: "Create lesson",
      reason: "No lesson exists for this topic.",
    });
  }
  if (flags.lowFlashcards) {
    actions.push({
      type: "generate_flashcards",
      label: "Generate flashcards",
      reason: `Only ${counts.flashcards ?? 0} flashcards; need at least ${FLASHCARD_THRESHOLD}.`,
    });
  }
  if (flags.lowQuizzes) {
    actions.push({
      type: "generate_quiz",
      label: "Generate quiz questions",
      reason: `Only ${counts.quizzes ?? 0} quiz questions; need at least ${QUIZ_THRESHOLD}.`,
    });
  }
  if (flags.lowExamQuestions) {
    actions.push({
      type: "generate_exam_questions",
      label: "Generate exam questions",
      reason: `Only ${counts.examQuestions ?? 0} exam questions; need at least ${EXAM_THRESHOLD}.`,
    });
  }
  if (flags.highIssueRate) {
    actions.push({
      type: "review_content",
      label: "Review content",
      reason: `${counts.openIssues ?? 0} open issues on linked lessons.`,
    });
  }
  if (flags.unresolvedMappings) {
    actions.push({
      type: "fix_mapping",
      label: "Fix mapping",
      reason: "Unresolved legacy topic key mappings detected.",
    });
  }

  return actions;
}

/**
 * Rules-based summary paragraph (no LLM).
 */
function generateTopicGapSummary(gap) {
  const status = gap.coverageStatus || "weak";
  const score = gap.coverageScore ?? 0;
  const c = gap.counts || {};
  const lessons = c.lessons ?? 0;
  const flashcards = c.flashcards ?? 0;
  const quizzes = c.quizzes ?? 0;
  const examQuestions = c.examQuestions ?? 0;
  const issues = c.openIssues ?? 0;

  const parts = [];
  if (status === "strong") {
    parts.push("This topic has strong coverage.");
  } else if (status === "partial") {
    parts.push("This topic has partial coverage.");
  } else {
    parts.push("This topic has weak coverage.");
  }

  if (lessons >= 1) parts.push(`It has ${lessons} lesson${lessons !== 1 ? "s" : ""}`);
  else parts.push("no lessons");

  if (flashcards >= FLASHCARD_THRESHOLD) parts.push("good flashcard support");
  else if (flashcards > 0) parts.push(`${flashcards} flashcards (need at least ${FLASHCARD_THRESHOLD})`);
  else parts.push("no flashcards");

  if (quizzes >= QUIZ_THRESHOLD) parts.push("good quiz support");
  else if (quizzes > 0) parts.push(`${quizzes} quiz questions (need at least ${QUIZ_THRESHOLD})`);
  else parts.push("no quiz questions");

  if (examQuestions >= EXAM_THRESHOLD) parts.push("good exam question coverage");
  else if (examQuestions > 0) parts.push(`${examQuestions} exam questions (need at least ${EXAM_THRESHOLD})`);
  else parts.push("no exam questions");

  if (issues >= HIGH_ISSUE_THRESHOLD) parts.push(`High open issue count (${issues}).`);

  const recs = gap.recommendations || [];
  if (recs.length > 0) {
    parts.push("Priority should be " + recs[0].toLowerCase().replace(/\.$/, "") + ".");
  }

  return parts.join(". ").replace(/\s+/g, " ").trim() + ".";
}

/**
 * Get lesson IDs for a topic (for issue count).
 */
async function getLessonIdsForTopic(specKey, topicKey) {
  const graph = await contentGraphService.getTopicGraph(specKey, topicKey);
  if (!graph || !graph.linkedNodes) return [];
  const lessonNodes = graph.linkedNodes.filter((n) => n.nodeType === "lesson" && n.lessonId);
  return lessonNodes.map((n) => n.lessonId).filter(Boolean);
}

/**
 * Get open issue count for lessons in a topic.
 */
async function getOpenIssueCountForTopic(lessonIds) {
  if (!lessonIds || lessonIds.length === 0) return 0;
  const ids = lessonIds.map((id) => new mongoose.Types.ObjectId(id));
  return LessonIssueReport.countDocuments({ lessonId: { $in: ids }, status: "open" });
}

/**
 * Resolve topic title from taxonomy.
 */
async function getTopicTitle(specKey, topicKey) {
  const taxonomy = await adminTaxonomyService.getMergedTaxonomyBySpecKey(specKey);
  if (!taxonomy?.units) return topicKey || "";
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  for (const u of taxonomy.units) {
    const t = (u.topics || []).find((tp) => (tp.key || "").toLowerCase() === (topicOnly || "").toLowerCase());
    if (t) return t.topic || t.key || topicOnly;
  }
  return topicOnly;
}

/**
 * Build a single topic gap object.
 * Unresolved mappings: not persisted in backfill; set false. Can be extended later.
 */
async function buildTopicGap(specKey, topicKey, topicTitle, coverage, lessonIds, unresolvedMappings = false) {
  const openIssues = lessonIds.length
    ? await getOpenIssueCountForTopic(lessonIds.map((id) => id.toString()))
    : (coverage?.issueCount ?? 0);

  const counts = {
    lessons: coverage?.lessonCount ?? 0,
    flashcards: coverage?.flashcardCount ?? 0,
    quizzes: coverage?.quizCount ?? 0,
    examQuestions: coverage?.examQuestionCount ?? 0,
    openIssues,
  };

  const coverageScore = coverage?.coverageScore ?? 0;
  const coverageStatus = coverage?.status || "weak";
  const weakAreas = Array.isArray(coverage?.weakAreas) ? [...new Set(coverage.weakAreas)] : [];

  const gapFlags = computeGapFlags(counts, coverageScore, unresolvedMappings);
  const priorityScore = computePriorityScore(gapFlags, coverageScore);

  const gap = {
    specKey: specKey || "",
    topicKey: topicKey || "",
    topicTitle: topicTitle || topicKey || "",
    counts,
    coverageScore,
    coverageStatus,
    weakAreas,
    gapFlags,
    priorityScore,
    recommendations: [],
    suggestedActions: [],
  };

  gap.recommendations = buildGapRecommendations(gap);
  gap.suggestedActions = buildSuggestedActions(gap);
  gap.summaryParagraph = generateTopicGapSummary(gap);

  return gap;
}

/**
 * Detect topic gaps for a spec. Returns ranked array of gap objects.
 */
async function detectTopicGaps(specKey, options = {}) {
  const specCoverage = await contentCoverageService.getSpecCoverage(specKey);
  if (!specCoverage || !specCoverage.topics) return [];

  const gaps = [];
  for (const t of specCoverage.topics) {
    const s = t.specKey || specKey;
    const topicKey = t.topicKey || "";
    if (!s || !topicKey) continue;

    const lessonIds = await getLessonIdsForTopic(s, topicKey);
    const title = await getTopicTitle(s, topicKey);
    const gap = await buildTopicGap(s, topicKey, title, t, lessonIds, false);
    gap.unit = t.unit;
    gap.unitKey = t.unitKey;
    gaps.push(gap);
  }

  return rankTopicGaps(gaps);
}

/**
 * Detect single topic gap.
 */
async function detectSingleTopicGap(specKey, topicKey) {
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  const coverage = await contentCoverageService.getTopicCoverage(specKey, topicOnly);
  if (!coverage) return null;

  const lessonIds = await getLessonIdsForTopic(specKey, topicOnly);
  const title = await getTopicTitle(specKey, topicOnly);
  const gap = await buildTopicGap(specKey, topicOnly, title, coverage, lessonIds, false);
  gap.summaryParagraph = generateTopicGapSummary(gap);
  return gap;
}

/**
 * Rank gaps by priority score descending.
 */
function rankTopicGaps(gaps) {
  if (!Array.isArray(gaps)) return [];
  return [...gaps].sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
}

module.exports = {
  detectTopicGaps,
  detectSingleTopicGap,
  rankTopicGaps,
  buildGapRecommendations,
  generateTopicGapSummary,
  computePriorityScore,
  computeGapFlags,
};
