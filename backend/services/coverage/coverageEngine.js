/**
 * PR-009: Coverage engine — computes per-topic coverage metrics.
 * Deterministic: spec statements, knowledge docs, retrieval score, weak-evidence enquiries.
 */
const SpecStatement = require("../../models/SpecStatement");
const KnowledgeDocument = require("../../models/KnowledgeDocument");
const Lesson = require("../../models/Lesson");
const EnquiryLog = require("../../models/EnquiryLog");
const TopicSummaryLog = require("../../models/TopicSummaryLog");
const { normalizeSpecKey } = require("../../config/featureFlags");

const STATUS_ORDER = { NO_SPEC: 0, EMPTY: 1, THIN: 2, OK: 3, STRONG: 4 };

function clamp(val, lo, hi) {
  return Math.max(lo, Math.min(hi, val));
}

/**
 * Compute retrieval readiness score (0–100) and status.
 */
function computeScoreAndStatus(specStatementsTotal, knowledgeDocsSpec, knowledgeDocsLesson) {
  if (specStatementsTotal === 0) {
    return { score: 0, status: "NO_SPEC" };
  }
  const knowledgeDocsTotal = knowledgeDocsSpec + knowledgeDocsLesson;
  if (knowledgeDocsTotal === 0) {
    return { score: 0, status: "EMPTY" };
  }

  const specIndexedRatio = Math.min(1, knowledgeDocsSpec / specStatementsTotal);
  const lessonPresence = knowledgeDocsLesson > 0 ? 1 : 0;
  const lessonDensity = clamp(knowledgeDocsLesson / 8, 0, 1);
  const score = Math.round(50 * specIndexedRatio + 25 * lessonPresence + 25 * lessonDensity);

  let status = "OK";
  if (score < 40) status = "THIN";
  else if (score >= 70) status = "STRONG";

  return { score, status };
}

/**
 * Get spec variants for querying (handles AQA_GCSE_BIOLOGY and aqa-gcse-biology).
 */
function getSpecVariants(specKey) {
  const normalized = normalizeSpecKey(specKey);
  const withUnderscores = normalized.replace(/-/g, "_");
  return [...new Set([normalized, withUnderscores])];
}

/**
 * Compute coverage for all topics under a spec.
 * @param {{ specKey: string, windowDays?: number }} opts
 * @returns {Promise<Array<{
 *   topicKey: string,
 *   specStatementsTotal: number,
 *   knowledgeDocsSpec: number,
 *   knowledgeDocsLesson: number,
 *   knowledgeDocsTotal: number,
 *   score: number,
 *   status: string,
 *   enquiriesTotal: number,
 *   enquiriesWeakEvidence: number,
 *   weakRate: number,
 *   topWeakQuestions: Array<{ question: string, count: number }>,
 * }>>}
 */
async function computeCoverage({ specKey, windowDays = 14 }) {
  const spec = normalizeSpecKey(specKey);
  if (!spec) return [];
  const specVariants = getSpecVariants(spec);
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  // 1) Union of topicKeys from SpecStatement, KnowledgeDocument, Lesson, EnquiryLog, TopicSummaryLog
  const [specTopics, kdTopics, lessonTopics, enquiryTopics, summaryTopics] = await Promise.all([
    SpecStatement.aggregate([
      { $match: { specKey: { $in: specVariants } } },
      { $group: { _id: "$topicKey" } },
      { $project: { topicKey: "$_id", _id: 0 } },
    ]),
    KnowledgeDocument.aggregate([
      { $match: { specKey: { $in: specVariants } } },
      { $group: { _id: "$topicKey" } },
      { $project: { topicKey: "$_id", _id: 0 } },
    ]),
    Lesson.aggregate([
      {
        $match: {
          topicKey: {
            $regex: new RegExp(
              "^(" + specVariants.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + "):"
            ),
          },
        },
      },
      { $group: { _id: "$topicKey" } },
      { $project: { topicKey: "$_id", _id: 0 } },
    ]),
    EnquiryLog.aggregate([
      { $match: { specKey: { $in: specVariants }, topicKey: { $exists: true, $ne: null, $ne: "" }, createdAt: { $gte: since } } },
      { $group: { _id: "$topicKey" } },
      { $project: { topicKey: "$_id", _id: 0 } },
    ]),
    TopicSummaryLog.aggregate([
      { $match: { specKey: { $in: specVariants }, createdAt: { $gte: since } } },
      { $group: { _id: "$topicKey" } },
      { $project: { topicKey: "$_id", _id: 0 } },
    ]),
  ]);

  const topicKeySet = new Set();
  for (const r of specTopics) if (r.topicKey) topicKeySet.add(String(r.topicKey).trim());
  for (const r of kdTopics) if (r.topicKey) topicKeySet.add(String(r.topicKey).trim());
  for (const r of lessonTopics) if (r.topicKey) topicKeySet.add(String(r.topicKey).trim());
  for (const r of enquiryTopics) if (r.topicKey) topicKeySet.add(String(r.topicKey).trim());
  for (const r of summaryTopics) if (r.topicKey) topicKeySet.add(String(r.topicKey).trim());

  const topicKeys = Array.from(topicKeySet).filter(Boolean);
  if (topicKeys.length === 0) return [];

  // 2) SpecStatement counts by topicKey
  const specCounts = await SpecStatement.aggregate([
    { $match: { specKey: { $in: specVariants }, topicKey: { $in: topicKeys } } },
    { $group: { _id: "$topicKey", count: { $sum: 1 } } },
  ]);
  const specMap = new Map(specCounts.map((r) => [r._id, r.count]));

  // 3) KnowledgeDocument counts by topicKey and sourceType
  const kdCounts = await KnowledgeDocument.aggregate([
    { $match: { specKey: { $in: specVariants }, topicKey: { $in: topicKeys } } },
    { $group: { _id: { topicKey: "$topicKey", sourceType: "$sourceType" }, count: { $sum: 1 } } },
  ]);
  const kdSpecMap = new Map();
  const kdLessonMap = new Map();
  for (const r of kdCounts) {
    const tk = r._id.topicKey;
    if (r._id.sourceType === "specStatement") kdSpecMap.set(tk, (kdSpecMap.get(tk) || 0) + r.count);
    else if (r._id.sourceType === "lessonBlock") kdLessonMap.set(tk, (kdLessonMap.get(tk) || 0) + r.count);
  }

  // 4) EnquiryLog: total, weak, top weak questions (last windowDays)
  const enquiryTotals = await EnquiryLog.aggregate([
    {
      $match: {
        specKey: { $in: specVariants },
        topicKey: { $in: topicKeys },
        createdAt: { $gte: since },
      },
    },
    { $group: { _id: "$topicKey", total: { $sum: 1 } } },
  ]);

  const enquiryWeak = await EnquiryLog.aggregate([
    {
      $match: {
        specKey: { $in: specVariants },
        topicKey: { $in: topicKeys },
        createdAt: { $gte: since },
        "response.warnings": "Insufficient trusted sources",
      },
    },
    { $group: { _id: "$topicKey", weak: { $sum: 1 }, questions: { $push: "$question" } } },
  ]);

  const enquiryTotalMap = new Map(enquiryTotals.map((r) => [r._id, r.total]));
  const enquiryWeakMap = new Map();
  const topWeakQuestionsMap = new Map();
  for (const r of enquiryWeak) {
    enquiryWeakMap.set(r._id, r.weak);
    // Top 10 by count (group same question)
    const qCounts = {};
    for (const q of r.questions || []) {
      const k = String(q || "").trim().slice(0, 200);
      if (k) qCounts[k] = (qCounts[k] || 0) + 1;
    }
    const sorted = Object.entries(qCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([question, count]) => ({ question, count }));
    topWeakQuestionsMap.set(r._id, sorted);
  }

  // 4b) TopicSummaryLog: total, weak, by mode (PR-028)
  const summaryTotals = await TopicSummaryLog.aggregate([
    {
      $match: {
        specKey: { $in: specVariants },
        topicKey: { $in: topicKeys },
        createdAt: { $gte: since },
      },
    },
    { $group: { _id: "$topicKey", total: { $sum: 1 } } },
  ]);

  const summaryWeak = await TopicSummaryLog.aggregate([
    {
      $match: {
        specKey: { $in: specVariants },
        topicKey: { $in: topicKeys },
        createdAt: { $gte: since },
        $or: [
          { "response.confidenceLevel": "weak" },
          { "response.warnings": { $regex: /insufficient/i } },
        ],
      },
    },
    { $group: { _id: "$topicKey", weak: { $sum: 1 } } },
  ]);

  const summaryByModeAgg = await TopicSummaryLog.aggregate([
    {
      $match: {
        specKey: { $in: specVariants },
        topicKey: { $in: topicKeys },
        createdAt: { $gte: since },
      },
    },
    { $group: { _id: { topicKey: "$topicKey", mode: "$mode" }, count: { $sum: 1 } } },
  ]);

  const summaryTotalMap = new Map(summaryTotals.map((r) => [r._id, r.total]));
  const summaryWeakMap = new Map(summaryWeak.map((r) => [r._id, r.weak]));
  const summaryByModeMap = new Map();
  for (const r of summaryByModeAgg) {
    const tk = r._id.topicKey;
    const mode = r._id.mode || "overview";
    if (!summaryByModeMap.has(tk)) summaryByModeMap.set(tk, { overview: 0, lessonPlan: 0, revisionSheet: 0, examFocus: 0 });
    const obj = summaryByModeMap.get(tk);
    if (["overview", "lessonPlan", "revisionSheet", "examFocus"].includes(mode)) obj[mode] = r.count;
  }

  // 5) Build rows
  const rows = [];
  for (const topicKey of topicKeys) {
    const specStatementsTotal = specMap.get(topicKey) || 0;
    const knowledgeDocsSpec = kdSpecMap.get(topicKey) || 0;
    const knowledgeDocsLesson = kdLessonMap.get(topicKey) || 0;
    const knowledgeDocsTotal = knowledgeDocsSpec + knowledgeDocsLesson;
    const { score, status } = computeScoreAndStatus(specStatementsTotal, knowledgeDocsSpec, knowledgeDocsLesson);

    const enquiriesTotal = enquiryTotalMap.get(topicKey) || 0;
    const enquiriesWeakEvidence = enquiryWeakMap.get(topicKey) || 0;
    const weakRate = enquiriesTotal > 0 ? Math.round((enquiriesWeakEvidence / enquiriesTotal) * 1000) / 1000 : 0;
    const topWeakQuestions = topWeakQuestionsMap.get(topicKey) || [];

    const summariesTotal = summaryTotalMap.get(topicKey) || 0;
    const weakSummariesTotal = summaryWeakMap.get(topicKey) || 0;
    const summariesByMode = summaryByModeMap.get(topicKey) || { overview: 0, lessonPlan: 0, revisionSheet: 0, examFocus: 0 };

    rows.push({
      topicKey,
      specStatementsTotal,
      knowledgeDocsSpec,
      knowledgeDocsLesson,
      knowledgeDocsTotal,
      score,
      status,
      enquiriesTotal,
      enquiriesWeakEvidence,
      weakRate,
      topWeakQuestions,
      summariesTotal,
      weakSummariesTotal,
      summariesByMode,
      demandScore: 0, // set below after we have maxDemandRaw
    });
  }

  // 5b) Demand score: demandRaw = enquiriesTotal + (summariesTotal * 2), normalize 0–100
  let maxDemandRaw = 0;
  for (const r of rows) {
    const raw = r.enquiriesTotal + r.summariesTotal * 2;
    if (raw > maxDemandRaw) maxDemandRaw = raw;
  }
  for (const r of rows) {
    const raw = r.enquiriesTotal + r.summariesTotal * 2;
    r.demandScore = maxDemandRaw > 0 ? clamp(Math.round((100 * raw) / maxDemandRaw), 0, 100) : 0;
  }

  // 6) Sort: status severity, then score asc, then topicKey
  rows.sort((a, b) => {
    const sa = STATUS_ORDER[a.status] ?? 5;
    const sb = STATUS_ORDER[b.status] ?? 5;
    if (sa !== sb) return sa - sb;
    if (a.score !== b.score) return a.score - b.score;
    return String(a.topicKey).localeCompare(String(b.topicKey));
  });

  return rows;
}

module.exports = { computeCoverage, computeScoreAndStatus, getSpecVariants };
