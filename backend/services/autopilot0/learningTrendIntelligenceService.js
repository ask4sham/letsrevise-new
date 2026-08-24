/**
 * Autopilot 0 — Learning Trend Intelligence Observer V1.
 * L0 read-only: topic-level mastery trend from LearningEvidenceEvent only.
 */
const LearningEvidenceEvent = require("../../models/LearningEvidenceEvent");
const adminTaxonomyService = require("../adminTaxonomyService");
const { assertValidSpecKey } = require("../../utils/specTopicValidation");
const { normalizeSpecKey } = require("../../config/featureFlags");
const {
  computeMasteryFromCounts,
  hasCalculableMastery,
  buildTopicAliasMap,
  resolveCanonicalTopicKey,
} = require("./revisionIntelligenceService");

const VERSION = "autopilot0-learning-trend-intelligence-v1";
const LEVEL = "L0";

/** Policy constants — not empirically proven trend cutoffs. */
const LOOKBACK_DAYS = 90;
const WINDOW_DAYS = 45;
const MIN_PAIRED_STUDENTS = 10;
const MIN_EARLIER_ATTEMPTS = 10;
const MIN_RECENT_ATTEMPTS = 10;
const IMPROVING_THRESHOLD_PP = 10;
const DECLINING_THRESHOLD_PP = -10;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const QUIZ_EXAM_EVENT_TYPES = ["quiz_attempt", "exam_question_attempt"];

const TREND_PRIORITY = {
  DECLINING: 1,
  IMPROVING: 2,
  STABLE: 3,
};

function pairedStudentSampleBand(pairedCount) {
  if (pairedCount < MIN_PAIRED_STUDENTS) return null;
  if (pairedCount <= 19) return "10-19";
  return "20+";
}

function computeWindowCutoffs(now) {
  const reference = now instanceof Date ? now : new Date(now);
  const recentStart = new Date(reference.getTime() - WINDOW_DAYS * MS_PER_DAY);
  const earlierStart = new Date(reference.getTime() - LOOKBACK_DAYS * MS_PER_DAY);
  return {
    generatedAt: reference.toISOString(),
    earlierStart,
    earlierEnd: recentStart,
    recentStart,
    recentEnd: reference,
  };
}

function classifyEventWindow(createdAt, cutoffs) {
  const ts = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (Number.isNaN(ts)) return null;
  if (ts < cutoffs.earlierStart.getTime()) return null;
  if (ts < cutoffs.recentStart.getTime()) return "earlier";
  if (ts <= cutoffs.recentEnd.getTime()) return "recent";
  return null;
}

function medianInteger(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function classifyTrendLabel(medianDelta) {
  if (medianDelta >= IMPROVING_THRESHOLD_PP) return "IMPROVING";
  if (medianDelta <= DECLINING_THRESHOLD_PP) return "DECLINING";
  return "STABLE";
}

function emptyCountRow() {
  return {
    quizAttempts: 0,
    quizCorrect: 0,
    examAttempts: 0,
    examCorrect: 0,
  };
}

function mergeCountRows(target, source) {
  target.quizAttempts += source.quizAttempts;
  target.quizCorrect += source.quizCorrect;
  target.examAttempts += source.examAttempts;
  target.examCorrect += source.examCorrect;
}

function masteryFromCountRow(row) {
  const mastery = computeMasteryFromCounts(
    row.quizAttempts,
    row.quizCorrect,
    row.examAttempts,
    row.examCorrect
  );
  if (!hasCalculableMastery(row.quizAttempts, row.examAttempts, mastery)) return null;
  return mastery;
}

function mergeAggregatedRowsByCanonicalTopic(rows, specKey, aliasToCanonical) {
  const merged = new Map();

  for (const row of rows) {
    const canonicalTopicKey = resolveCanonicalTopicKey(specKey, row.topicKey, aliasToCanonical);
    if (!canonicalTopicKey) continue;

    const userKey = String(row.userId);
    const mergeKey = `${userKey}::${canonicalTopicKey}::${row.window}`;
    if (!merged.has(mergeKey)) {
      merged.set(mergeKey, {
        userId: userKey,
        canonicalTopicKey,
        window: row.window,
        ...emptyCountRow(),
      });
    }
    mergeCountRows(merged.get(mergeKey), row);
  }

  return [...merged.values()];
}

function buildTopicWindowMaps(mergedRows) {
  const byTopic = new Map();

  for (const row of mergedRows) {
    if (!byTopic.has(row.canonicalTopicKey)) {
      byTopic.set(row.canonicalTopicKey, {
        canonicalTopicKey: row.canonicalTopicKey,
        earlierByStudent: new Map(),
        recentByStudent: new Map(),
      });
    }
    const topic = byTopic.get(row.canonicalTopicKey);
    const target = row.window === "earlier" ? topic.earlierByStudent : topic.recentByStudent;
    if (!target.has(row.userId)) {
      target.set(row.userId, emptyCountRow());
    }
    mergeCountRows(target.get(row.userId), row);
  }

  return byTopic;
}

function computeTopicTrend(canonicalTopicKey, topicData) {
  const deltas = [];
  const earlierStudentIds = new Set(topicData.earlierByStudent.keys());
  const recentStudentIds = new Set(topicData.recentByStudent.keys());

  let earlierAttempts = 0;
  let recentAttempts = 0;

  for (const counts of topicData.earlierByStudent.values()) {
    earlierAttempts += counts.quizAttempts + counts.examAttempts;
  }
  for (const counts of topicData.recentByStudent.values()) {
    recentAttempts += counts.quizAttempts + counts.examAttempts;
  }

  for (const studentId of earlierStudentIds) {
    if (!recentStudentIds.has(studentId)) continue;
    const earlierMastery = masteryFromCountRow(topicData.earlierByStudent.get(studentId));
    const recentMastery = masteryFromCountRow(topicData.recentByStudent.get(studentId));
    if (earlierMastery === null || recentMastery === null) continue;
    deltas.push(recentMastery - earlierMastery);
  }

  if (
    deltas.length < MIN_PAIRED_STUDENTS ||
    earlierAttempts < MIN_EARLIER_ATTEMPTS ||
    recentAttempts < MIN_RECENT_ATTEMPTS
  ) {
    return { eligible: false, earlierAttempts, recentAttempts, pairedCount: deltas.length };
  }

  const medianDelta = medianInteger(deltas);
  return {
    eligible: true,
    topicKey: canonicalTopicKey,
    trend: classifyTrendLabel(medianDelta),
    medianDeltaPercentagePoints: medianDelta,
    pairedStudentSampleBand: pairedStudentSampleBand(deltas.length),
    earlierAttempts,
    recentAttempts,
    pairedCount: deltas.length,
  };
}

function sortTopicTrends(rows) {
  return [...rows].sort((a, b) => {
    const priA = TREND_PRIORITY[a.trend] || 99;
    const priB = TREND_PRIORITY[b.trend] || 99;
    if (priA !== priB) return priA - priB;

    if (a.trend === "DECLINING" && b.trend === "DECLINING") {
      if (a.medianDeltaPercentagePoints !== b.medianDeltaPercentagePoints) {
        return a.medianDeltaPercentagePoints - b.medianDeltaPercentagePoints;
      }
    }
    if (a.trend === "IMPROVING" && b.trend === "IMPROVING") {
      if (a.medianDeltaPercentagePoints !== b.medianDeltaPercentagePoints) {
        return b.medianDeltaPercentagePoints - a.medianDeltaPercentagePoints;
      }
    }

    return String(a.topicKey).localeCompare(String(b.topicKey));
  });
}

async function aggregateLearningEvidenceCounts(specKey, cutoffs) {
  const rows = await LearningEvidenceEvent.aggregate([
    {
      $match: {
        specKey,
        eventType: { $in: QUIZ_EXAM_EVENT_TYPES },
        correct: { $type: "bool" },
        createdAt: {
          $gte: cutoffs.earlierStart,
          $lte: cutoffs.recentEnd,
        },
      },
    },
    {
      $addFields: {
        window: {
          $cond: [{ $lt: ["$createdAt", cutoffs.recentStart] }, "earlier", "recent"],
        },
      },
    },
    {
      $group: {
        _id: { userId: "$userId", topicKey: "$topicKey", window: "$window" },
        quizAttempts: {
          $sum: { $cond: [{ $eq: ["$eventType", "quiz_attempt"] }, 1, 0] },
        },
        quizCorrect: {
          $sum: {
            $cond: [
              {
                $and: [{ $eq: ["$eventType", "quiz_attempt"] }, { $eq: ["$correct", true] }],
              },
              1,
              0,
            ],
          },
        },
        examAttempts: {
          $sum: { $cond: [{ $eq: ["$eventType", "exam_question_attempt"] }, 1, 0] },
        },
        examCorrect: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$eventType", "exam_question_attempt"] },
                  { $eq: ["$correct", true] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return rows.map((row) => {
    const id = row._id || {};
    return {
      userId: row.userId ?? id.userId,
      topicKey: row.topicKey ?? id.topicKey,
      window: row.window ?? id.window,
      quizAttempts: row.quizAttempts || 0,
      quizCorrect: row.quizCorrect || 0,
      examAttempts: row.examAttempts || 0,
      examCorrect: row.examCorrect || 0,
    };
  });
}

/**
 * @param {{ specKey: string, limit?: number, now?: Date|string|number }} opts
 */
async function buildLearningTrendIntelligence(opts = {}) {
  const specKey = normalizeSpecKey(opts.specKey);
  if (!specKey) {
    const err = new Error("specKey is required");
    err.code = "INVALID_SPEC_KEY";
    throw err;
  }

  assertValidSpecKey(specKey);

  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const cutoffs = computeWindowCutoffs(opts.now ?? new Date());

  const taxonomy = await adminTaxonomyService.getMergedTaxonomyBySpecKey(specKey);
  if (!taxonomy) {
    const err = new Error(`Unknown specKey: ${specKey}`);
    err.code = "INVALID_SPEC_KEY";
    throw err;
  }

  const { aliasToCanonical } = buildTopicAliasMap(specKey, taxonomy);

  const rawRows = await aggregateLearningEvidenceCounts(specKey, cutoffs);
  const mergedRows = mergeAggregatedRowsByCanonicalTopic(rawRows, specKey, aliasToCanonical);
  const topicMaps = buildTopicWindowMaps(mergedRows);

  const eligibleTrends = [];
  let insufficientEvidenceTopicCount = 0;

  for (const topicData of topicMaps.values()) {
    const result = computeTopicTrend(topicData.canonicalTopicKey, topicData);
    if (!result.eligible) {
      if (result.pairedCount > 0 || result.earlierAttempts > 0 || result.recentAttempts > 0) {
        insufficientEvidenceTopicCount += 1;
      }
      continue;
    }
    eligibleTrends.push({
      topicKey: result.topicKey,
      trend: result.trend,
      medianDeltaPercentagePoints: result.medianDeltaPercentagePoints,
      pairedStudentSampleBand: result.pairedStudentSampleBand,
    });
  }

  const topicTrends = sortTopicTrends(eligibleTrends).slice(0, limit);
  const eligibleTopicCount = eligibleTrends.length;

  const hasDeclining = eligibleTrends.some((row) => row.trend === "DECLINING");
  const overallStatus = hasDeclining
    ? "AMBER"
    : eligibleTopicCount > 0
    ? "GREEN"
    : "UNKNOWN";

  return {
    version: VERSION,
    level: LEVEL,
    generatedAt: cutoffs.generatedAt,
    cohort: {
      specKey,
      cohortScope: "SPEC_ONLY",
      tierSupported: false,
      tier: null,
    },
    windows: {
      lookbackDays: LOOKBACK_DAYS,
      windowDays: WINDOW_DAYS,
    },
    policy: {
      minPairedStudents: MIN_PAIRED_STUDENTS,
      minEarlierAttempts: MIN_EARLIER_ATTEMPTS,
      minRecentAttempts: MIN_RECENT_ATTEMPTS,
      improvingThresholdPercentagePoints: IMPROVING_THRESHOLD_PP,
      decliningThresholdPercentagePoints: DECLINING_THRESHOLD_PP,
    },
    topicTrends,
    summary: {
      overallStatus,
      humanReviewRequired: overallStatus !== "GREEN",
    },
    eligibleTopicCount,
    insufficientEvidenceTopicCount,
  };
}

module.exports = {
  VERSION,
  LEVEL,
  LOOKBACK_DAYS,
  WINDOW_DAYS,
  MIN_PAIRED_STUDENTS,
  MIN_EARLIER_ATTEMPTS,
  MIN_RECENT_ATTEMPTS,
  IMPROVING_THRESHOLD_PP,
  DECLINING_THRESHOLD_PP,
  QUIZ_EXAM_EVENT_TYPES,
  pairedStudentSampleBand,
  computeWindowCutoffs,
  classifyEventWindow,
  medianInteger,
  classifyTrendLabel,
  mergeAggregatedRowsByCanonicalTopic,
  buildTopicWindowMaps,
  computeTopicTrend,
  masteryFromCountRow,
  sortTopicTrends,
  aggregateLearningEvidenceCounts,
  buildLearningTrendIntelligence,
};
