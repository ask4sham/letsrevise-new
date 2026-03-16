/**
 * Autopilot Prompt Quality Feedback — analytics for approval/rejection outcomes.
 * Uses TopicFlashcard, TopicQuizQuestion, ExamQuestion with metadata.generatedBy === "autopilot".
 * No changes to generation or approval logic.
 */
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");

const AUTOPILOT_META = "metadata.generatedBy";
const AUTOPILOT_VALUE = "autopilot";
const REVIEW_DECISION = "metadata.reviewDecision";
const REVIEW_REASON = "metadata.reviewReason";
const DEFAULT_DAYS = 30;

/** Normalized rejection reason codes. Original free-text is preserved. */
const REASON_CODES = [
  "missing_accuracy",
  "weak_explanation",
  "duplicate_content",
  "poor_exam_alignment",
  "unclear_question",
  "other",
];

/**
 * Normalize free-text rejection reason to a code.
 * Keeps original reason; does not modify storage.
 */
function normalizeRejectionReason(reason) {
  if (!reason || typeof reason !== "string") return "other";
  const r = reason.toLowerCase().trim();
  if (r.includes("accuracy") || r.includes("incorrect") || r.includes("wrong")) return "missing_accuracy";
  if (r.includes("explanation") || r.includes("unclear explanation")) return "weak_explanation";
  if (r.includes("duplicate") || r.includes("repetitive") || r.includes("same as")) return "duplicate_content";
  if (r.includes("exam") || r.includes("alignment") || r.includes("spec") || r.includes("syllabus")) return "poor_exam_alignment";
  if (r.includes("unclear") || r.includes("ambiguous") || r.includes("confusing") || r.includes("question")) return "unclear_question";
  return "other";
}

/**
 * Build date filter from days param.
 */
function dateFilter(days) {
  const d = typeof days === "number" && days > 0 ? days : DEFAULT_DAYS;
  const since = new Date();
  since.setDate(since.getDate() - d);
  return { createdAt: { $gte: since } };
}

/**
 * Base query for autopilot-generated items.
 */
function baseQuery(filters = {}) {
  const { specKey, topicKey, days } = filters;
  const q = { [AUTOPILOT_META]: AUTOPILOT_VALUE };
  if (days) Object.assign(q, dateFilter(days));

  const topicEscaped = (topicKey || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const specPattern = specKey ? (specKey || "").replace(/-/g, "[-_]") : null;

  if (specKey || topicKey) {
    const patterns = [];
    if (specPattern) {
      patterns.push({ topicKey: new RegExp(`^${specPattern}`, "i") });
      patterns.push({ topicKey: new RegExp(`^${specPattern}:`, "i") });
    }
    if (topicEscaped) {
      patterns.push({ topicKey: new RegExp(topicEscaped, "i") });
    }
    if (specPattern && topicEscaped) {
      patterns.push({ topicKey: new RegExp(`^${specPattern}.*${topicEscaped}`, "i") });
    }
    if (patterns.length > 0) q.$or = patterns;
  }
  return q;
}

/**
 * Count approved (status published) and rejected (isArchived) for a model.
 */
async function countByModel(Model, q) {
  const [approved, rejected] = await Promise.all([
    Model.countDocuments({ ...q, status: "published" }),
    Model.countDocuments({ ...q, isArchived: true }),
  ]);
  return { approved, rejected, reviewed: approved + rejected };
}

/**
 * Get feedback summary.
 */
async function getAutopilotFeedbackSummary(filters = {}) {
  const q = baseQuery(filters);
  const fcQ = { ...q };
  const qqQ = { ...q };
  const eqQ = { ...q };

  const [fc, qq, eq] = await Promise.all([
    countByModel(TopicFlashcard, fcQ),
    countByModel(TopicQuizQuestion, qqQ),
    countByModel(ExamQuestion, eqQ),
  ]);

  const totals = {
    reviewedItems: fc.reviewed + qq.reviewed + eq.reviewed,
    approvedItems: fc.approved + qq.approved + eq.approved,
    rejectedItems: fc.rejected + qq.rejected + eq.rejected,
    approvalRate: 0,
  };
  if (totals.reviewedItems > 0) {
    totals.approvalRate = Math.round((totals.approvedItems / totals.reviewedItems) * 100);
  }

  const byType = {
    flashcard: { ...fc, approvalRate: fc.reviewed > 0 ? Math.round((fc.approved / fc.reviewed) * 100) : 0 },
    quizQuestion: { ...qq, approvalRate: qq.reviewed > 0 ? Math.round((qq.approved / qq.reviewed) * 100) : 0 },
    examQuestion: { ...eq, approvalRate: eq.reviewed > 0 ? Math.round((eq.approved / eq.reviewed) * 100) : 0 },
  };

  const rejectionPatterns = await getAutopilotRejectionPatterns(filters);
  const weakTopics = await getWeakTopics(filters);

  return {
    totals,
    byType,
    rejectionPatterns,
    weakTopics,
  };
}

/**
 * Get feedback by spec.
 */
async function getAutopilotFeedbackBySpec(specKey, filters = {}) {
  return getAutopilotFeedbackSummary({ ...filters, specKey });
}

/**
 * Get feedback by topic.
 */
async function getAutopilotFeedbackByTopic(specKey, topicKey, filters = {}) {
  const topicFull = topicKey && topicKey.includes(":") ? topicKey : `${specKey || ""}:${topicKey || ""}`.replace(/^:/, "");
  return getAutopilotFeedbackSummary({ ...filters, specKey, topicKey: topicFull });
}

/**
 * Get rejection patterns (normalized reason codes with counts).
 */
async function getAutopilotRejectionPatterns(filters = {}) {
  const q = baseQuery(filters);
  const baseRejected = { ...q, isArchived: true, [REVIEW_REASON]: { $exists: true, $ne: null, $ne: "" } };

  const [fcDocs, qqDocs, eqDocs] = await Promise.all([
    TopicFlashcard.find(baseRejected).select(REVIEW_REASON).lean(),
    TopicQuizQuestion.find(baseRejected).select(REVIEW_REASON).lean(),
    ExamQuestion.find(baseRejected).select(REVIEW_REASON).lean(),
  ]);

  const byCode = {};
  for (const code of REASON_CODES) byCode[code] = 0;

  for (const doc of [...fcDocs, ...qqDocs, ...eqDocs]) {
    const reason = doc.metadata?.reviewReason;
    const code = normalizeRejectionReason(reason);
    byCode[code] = (byCode[code] || 0) + 1;
  }

  const patterns = Object.entries(byCode)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return patterns;
}

/**
 * Get weak topics (low approval rate, ranked by reviewed count).
 */
async function getWeakTopics(filters = {}) {
  const { limit = 20 } = filters;
  const q = baseQuery(filters);
  const reviewedMatch = { $and: [q, { $or: [{ status: "published" }, { isArchived: true }] }] };

  const fcAgg = await TopicFlashcard.aggregate([
    { $match: reviewedMatch },
    { $group: { _id: "$topicKey", approved: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } }, rejected: { $sum: { $cond: ["$isArchived", 1, 0] } } } },
  ]);
  const qqAgg = await TopicQuizQuestion.aggregate([
    { $match: reviewedMatch },
    { $group: { _id: "$topicKey", approved: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } }, rejected: { $sum: { $cond: ["$isArchived", 1, 0] } } } },
  ]);
  const eqAgg = await ExamQuestion.aggregate([
    { $match: reviewedMatch },
    { $group: { _id: "$topicKey", approved: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } }, rejected: { $sum: { $cond: ["$isArchived", 1, 0] } } } },
  ]);

  const byTopic = {};
  for (const row of [...fcAgg, ...qqAgg, ...eqAgg]) {
    const key = row._id || "";
    if (!key) continue;
    if (!byTopic[key]) byTopic[key] = { specKey: "", topicKey: key, approved: 0, rejected: 0 };
    byTopic[key].approved += row.approved || 0;
    byTopic[key].rejected += row.rejected || 0;
  }

  for (const key of Object.keys(byTopic)) {
    const t = byTopic[key];
    if (key.includes(":")) t.specKey = key.split(":")[0];
    t.reviewedItems = t.approved + t.rejected;
    t.approvalRate = t.reviewedItems > 0 ? Math.round((t.approved / t.reviewedItems) * 100) : 0;
  }

  const list = Object.values(byTopic)
    .filter((t) => t.reviewedItems >= 1)
    .sort((a, b) => {
      const rateA = a.approvalRate;
      const rateB = b.approvalRate;
      if (rateA !== rateB) return rateA - rateB;
      return b.reviewedItems - a.reviewedItems;
    })
    .slice(0, limit || 20);

  return list;
}

const PROMPT_PACK_ID = "metadata.promptPackId";
const PROMPT_PACK_VERSION = "metadata.promptPackVersion";

/**
 * Base query for items WITH prompt pack metadata (excludes legacy).
 */
function baseQueryWithPromptPack(filters = {}) {
  const q = baseQuery(filters);
  q[PROMPT_PACK_ID] = { $exists: true, $ne: null, $ne: "" };
  return q;
}

/**
 * Get feedback aggregated by prompt pack.
 * Legacy items without prompt metadata are excluded.
 */
async function getFeedbackByPromptPack(filters = {}) {
  const q = baseQueryWithPromptPack(filters);
  const reviewedMatch = { $and: [q, { $or: [{ status: "published" }, { isArchived: true }] }] };

  const fcAgg = await TopicFlashcard.aggregate([
    { $match: reviewedMatch },
    { $group: { _id: { id: `$metadata.promptPackId`, version: `$metadata.promptPackVersion` }, approved: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } }, rejected: { $sum: { $cond: ["$isArchived", 1, 0] } } } },
  ]);
  const qqAgg = await TopicQuizQuestion.aggregate([
    { $match: reviewedMatch },
    { $group: { _id: { id: `$metadata.promptPackId`, version: `$metadata.promptPackVersion` }, approved: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } }, rejected: { $sum: { $cond: ["$isArchived", 1, 0] } } } },
  ]);
  const eqAgg = await ExamQuestion.aggregate([
    { $match: reviewedMatch },
    { $group: { _id: { id: `$metadata.promptPackId`, version: `$metadata.promptPackVersion` }, approved: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } }, rejected: { $sum: { $cond: ["$isArchived", 1, 0] } } } },
  ]);

  const byPack = {};
  for (const row of [...fcAgg, ...qqAgg, ...eqAgg]) {
    const id = row._id?.id || "unknown";
    const version = row._id?.version || "unknown";
    const key = `${id}::${version}`;
    if (!byPack[key]) byPack[key] = { promptPackId: id, promptPackVersion: version, approved: 0, rejected: 0 };
    byPack[key].approved += row.approved || 0;
    byPack[key].rejected += row.rejected || 0;
  }

  const promptPacks = Object.values(byPack).map((p) => {
    const reviewed = p.approved + p.rejected;
    return {
      promptPackId: p.promptPackId,
      promptPackVersion: p.promptPackVersion,
      reviewedItems: reviewed,
      approvedItems: p.approved,
      rejectedItems: p.rejected,
      approvalRate: reviewed > 0 ? Math.round((p.approved / reviewed) * 100) : 0,
    };
  });
  promptPacks.sort((a, b) => (b.reviewedItems || 0) - (a.reviewedItems || 0));
  return { promptPacks };
}

/**
 * Alias for getFeedbackByPromptPack. Returns same shape as spec.
 */
async function getPromptPackComparison(filters = {}) {
  return getFeedbackByPromptPack(filters);
}

/**
 * Get experiment performance (delegates to outcomes service).
 * @param {string} experimentId
 */
async function getExperimentPerformance(experimentId) {
  const autopilotOutcomesService = require("./autopilotOutcomesService");
  return autopilotOutcomesService.getExperimentPerformance(experimentId);
}

module.exports = {
  getAutopilotFeedbackSummary,
  getAutopilotFeedbackBySpec,
  getAutopilotFeedbackByTopic,
  getAutopilotRejectionPatterns,
  getFeedbackByPromptPack,
  getPromptPackComparison,
  getExperimentPerformance,
  normalizeRejectionReason,
  REASON_CODES,
};
