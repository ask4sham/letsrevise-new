/**
 * Autopilot Readiness Diagnostics — shows admins which topics are ready for automation.
 * Diagnostics only; no generation changes. Deterministic and explainable.
 */
const curriculumGapDetectionService = require("./curriculumGapDetectionService");
const contentCoverageService = require("./contentCoverageService");
const adminTaxonomyService = require("./adminTaxonomyService");
const ContentNode = require("../models/ContentNode");
const SpecStatement = require("../models/SpecStatement");
const { taxonomyCanonicalKey } = require("../utils/contentCanonicalKey");
const { normalizeSpecKey } = require("../config/featureFlags");

const HIGH_ISSUE_THRESHOLD = 3;
const AUTOPILOT_ACTIONS = ["generate_flashcards", "generate_quiz", "generate_exam_questions"];

function getSpecVariants(specKey) {
  const normalized = normalizeSpecKey(specKey);
  const withUnderscores = normalized.replace(/-/g, "_");
  return [...new Set([normalized, withUnderscores])];
}

/**
 * Check if topic has SpecStatements (needed by generators).
 */
async function hasSpecStatementsForTopic(specKey, topicKey) {
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  const specVariants = getSpecVariants(specKey);
  const count = await SpecStatement.countDocuments({
    specKey: { $in: specVariants },
    topicKey: topicOnly,
  });
  return count > 0;
}

/**
 * Check if topic graph node exists (read-only; does not create).
 */
async function hasTopicNode(specKey, topicKey) {
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  const spec = (specKey || "").trim();
  const canonical = taxonomyCanonicalKey(spec, topicOnly);
  if (!canonical) return false;
  const node = await ContentNode.findOne({ canonicalKey: canonical }).lean();
  return !!node;
}

/**
 * Check if topic exists as leaf in taxonomy (not main topic or section).
 */
async function isLeafTopic(specKey, topicKey) {
  const taxonomy = await adminTaxonomyService.getMergedTaxonomyBySpecKey(specKey);
  if (!taxonomy?.units) return false;
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  const lower = (topicOnly || "").toLowerCase();
  for (const u of taxonomy.units) {
    const found = (u.topics || []).find((t) => (t.key || "").toLowerCase() === lower);
    if (found) return true;
  }
  return false;
}

/**
 * Build readiness flags from gap, coverage, and extra checks.
 */
function buildReadinessFlags(topicGap, topicCoverage, extra = {}) {
  const counts = topicGap?.counts || topicCoverage || {};
  const openIssues = counts.openIssues ?? counts.issueCount ?? 0;
  const lowIssues = openIssues < HIGH_ISSUE_THRESHOLD;
  const hasSpecStatements = !!extra.hasSpecStatements;
  const hasTopicNode = !!extra.hasTopicNode;
  const isLeaf = extra.isLeafTopic !== false;

  const baseOk = hasSpecStatements && lowIssues && hasTopicNode && isLeaf;
  return {
    hasSpecStatements,
    lowIssues,
    hasTopicNode,
    canGenerateFlashcards: baseOk,
    canGenerateQuiz: baseOk,
    canGenerateExamQuestions: baseOk,
  };
}

/**
 * Build human-readable summary from readiness.
 */
function buildReadinessSummary(readiness) {
  const flags = readiness.readinessFlags || {};
  const blockers = readiness.blockers || [];
  const available = readiness.autopilotActionsAvailable || [];

  if (blockers.length > 0 && available.length === 0) {
    return `This topic is blocked: ${blockers[0]}.`;
  }
  if (available.length === 0) {
    return "This topic has no autopilot actions available.";
  }
  const actionLabels = {
    generate_flashcards: "flashcards",
    generate_quiz: "quizzes",
    generate_exam_questions: "exam questions",
  };
  const availableLabels = available.map((a) => actionLabels[a] || a);
  if (blockers.length > 0) {
    return `This topic is autopilot-ready for ${availableLabels.join(" and ")}, but ${blockers[0].toLowerCase()}.`;
  }
  return `This topic is autopilot-ready for ${availableLabels.join(", ")}.`;
}

/**
 * Get single topic autopilot readiness.
 */
async function getTopicAutopilotReadiness(specKey, topicKey) {
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  const gap = await curriculumGapDetectionService.detectSingleTopicGap(specKey, topicOnly);
  if (!gap) return null;

  const coverage = await contentCoverageService.getTopicCoverage(specKey, topicOnly);
  const [hasSpecStatements, hasTopicNodeVal, isLeafTopicVal] = await Promise.all([
    hasSpecStatementsForTopic(specKey, topicOnly),
    hasTopicNode(specKey, topicOnly),
    isLeafTopic(specKey, topicOnly),
  ]);

  const extra = { hasSpecStatements, hasTopicNode: hasTopicNodeVal, isLeafTopic: isLeafTopicVal };
  const readinessFlags = buildReadinessFlags(gap, coverage, extra);

  const blockers = [];
  if (!hasSpecStatements) blockers.push("Missing specification statements");
  if (!readinessFlags.lowIssues) blockers.push("High open issue count");
  if (!hasTopicNode) blockers.push("Topic graph node missing");
  if (!isLeafTopicVal) blockers.push("Topic is not a leaf topic");

  const requiresReview = (gap.counts?.openIssues ?? 0) >= HIGH_ISSUE_THRESHOLD;

  const autopilotActionsAvailable = [];
  if (readinessFlags.canGenerateFlashcards && (gap.counts?.flashcards ?? 0) < 5) {
    autopilotActionsAvailable.push("generate_flashcards");
  }
  if (readinessFlags.canGenerateQuiz && (gap.counts?.quizzes ?? 0) < 3) {
    autopilotActionsAvailable.push("generate_quiz");
  }
  if (readinessFlags.canGenerateExamQuestions && (gap.counts?.examQuestions ?? 0) < 2) {
    autopilotActionsAvailable.push("generate_exam_questions");
  }

  const recommendedActions = [];
  if (blockers.length > 0) {
    if (!hasSpecStatements) recommendedActions.push("Add SpecStatements for this topic");
    if (!readinessFlags.lowIssues) recommendedActions.push("Resolve open lesson issues");
    if (!hasTopicNodeVal) recommendedActions.push("Rebuild topic graph");
  }
  if (autopilotActionsAvailable.length > 0) {
    recommendedActions.push("Run Autopilot");
  }

  const ready = autopilotActionsAvailable.length > 0 && blockers.length === 0;

  const readiness = {
    specKey: specKey || "",
    topicKey: topicOnly,
    topicTitle: gap.topicTitle || topicOnly,
    ready,
    requiresReview,
    counts: gap.counts || {},
    readinessFlags,
    blockers,
    recommendedActions,
    autopilotActionsAvailable,
    summary: "",
  };
  readiness.summary = buildReadinessSummary(readiness);
  return readiness;
}

/**
 * Get spec-level autopilot readiness (all topics).
 */
async function getSpecAutopilotReadiness(specKey) {
  const gaps = await curriculumGapDetectionService.detectTopicGaps(specKey);
  const topics = [];
  for (const gap of gaps) {
    const tk = gap.topicKey || "";
    if (!tk) continue;
    const r = await getTopicAutopilotReadiness(specKey, tk);
    if (r) topics.push(r);
  }

  const readyTopics = topics.filter((t) => t.ready).length;
  const blockedTopics = topics.filter((t) => !t.ready && t.blockers?.length > 0).length;
  const requiresReviewTopics = topics.filter((t) => t.requiresReview).length;

  return {
    specKey,
    summary: {
      totalTopics: topics.length,
      readyTopics,
      blockedTopics,
      requiresReviewTopics,
    },
    topics,
  };
}

module.exports = {
  getTopicAutopilotReadiness,
  getSpecAutopilotReadiness,
  buildReadinessFlags,
  buildReadinessSummary,
  hasSpecStatementsForTopic,
  hasTopicNode,
};
