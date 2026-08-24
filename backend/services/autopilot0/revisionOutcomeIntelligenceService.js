/**
 * Autopilot 0 — Revision Outcome Intelligence Observer V1.
 * L0 read-only: earlier weak topic + later observed outcome from LearningEvidenceEvent only.
 * Observed outcome only — no causal claims about revision or recommendations.
 */
const LearningEvidenceEvent = require("../../models/LearningEvidenceEvent");
const adminTaxonomyService = require("../adminTaxonomyService");
const { assertValidSpecKey } = require("../../utils/specTopicValidation");
const { normalizeSpecKey } = require("../../config/featureFlags");
const { buildTopicAliasMap } = require("./revisionIntelligenceService");
const {
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
  mergeAggregatedRowsByCanonicalTopic,
  buildTopicWindowMaps,
  masteryFromCountRow,
  classifyTrendLabel,
  medianInteger,
  aggregateLearningEvidenceCounts,
} = require("./learningTrendIntelligenceService");

const VERSION = "autopilot0-revision-outcome-intelligence-v1";
const LEVEL = "L0";
const WEAK_MASTERY_THRESHOLD = 70;

const OUTCOME_PRIORITY = {
  WEAK_AND_DECLINING: 1,
  WEAK_AND_STABLE: 2,
  WEAK_AND_IMPROVING: 3,
  NO_LONGER_WEAK: 4,
};

function classifyTopicOutcome(recentAverageMastery, trendLabel) {
  if (recentAverageMastery >= WEAK_MASTERY_THRESHOLD) {
    return "NO_LONGER_WEAK";
  }
  if (trendLabel === "IMPROVING") return "WEAK_AND_IMPROVING";
  if (trendLabel === "DECLINING") return "WEAK_AND_DECLINING";
  return "WEAK_AND_STABLE";
}

function averageInteger(values) {
  if (!values.length) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round(sum / values.length);
}

function computeTopicOutcome(canonicalTopicKey, topicData) {
  const earlierStudentIds = new Set(topicData.earlierByStudent.keys());
  const recentStudentIds = new Set(topicData.recentByStudent.keys());

  let earlierAttempts = 0;
  let recentAttempts = 0;
  const deltas = [];
  const earlierMasteries = [];
  const recentMasteries = [];

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
    earlierMasteries.push(earlierMastery);
    recentMasteries.push(recentMastery);
  }

  const pairedCount = deltas.length;
  const baseResult = {
    eligible: false,
    earlierAttempts,
    recentAttempts,
    pairedCount,
    notWeakEarlier: false,
  };

  if (
    pairedCount < MIN_PAIRED_STUDENTS ||
    earlierAttempts < MIN_EARLIER_ATTEMPTS ||
    recentAttempts < MIN_RECENT_ATTEMPTS
  ) {
    return baseResult;
  }

  const earlierAverageMastery = averageInteger(earlierMasteries);
  const recentAverageMastery = averageInteger(recentMasteries);

  if (earlierAverageMastery === null || earlierAverageMastery >= WEAK_MASTERY_THRESHOLD) {
    return { ...baseResult, notWeakEarlier: true };
  }

  const medianDelta = medianInteger(deltas);
  const trendLabel = classifyTrendLabel(medianDelta);
  const outcome = classifyTopicOutcome(recentAverageMastery, trendLabel);

  return {
    eligible: true,
    topicKey: canonicalTopicKey,
    earlierAverageMastery,
    recentAverageMastery,
    medianDeltaPercentagePoints: medianDelta,
    outcome,
    pairedStudentSampleBand: pairedStudentSampleBand(pairedCount),
    pairedCount,
    earlierAttempts,
    recentAttempts,
    notWeakEarlier: false,
  };
}

function sortTopicOutcomes(rows) {
  return [...rows].sort((a, b) => {
    const priA = OUTCOME_PRIORITY[a.outcome] || 99;
    const priB = OUTCOME_PRIORITY[b.outcome] || 99;
    if (priA !== priB) return priA - priB;

    if (a.outcome === "WEAK_AND_DECLINING" && b.outcome === "WEAK_AND_DECLINING") {
      if (a.medianDeltaPercentagePoints !== b.medianDeltaPercentagePoints) {
        return a.medianDeltaPercentagePoints - b.medianDeltaPercentagePoints;
      }
    }
    if (a.outcome === "WEAK_AND_IMPROVING" && b.outcome === "WEAK_AND_IMPROVING") {
      if (a.medianDeltaPercentagePoints !== b.medianDeltaPercentagePoints) {
        return b.medianDeltaPercentagePoints - a.medianDeltaPercentagePoints;
      }
    }

    return String(a.topicKey).localeCompare(String(b.topicKey));
  });
}

function computeOverallStatus(outcomes) {
  if (outcomes.length === 0) return "UNKNOWN";
  const allNoLongerWeak = outcomes.every((row) => row.outcome === "NO_LONGER_WEAK");
  return allNoLongerWeak ? "GREEN" : "AMBER";
}

/**
 * @param {{ specKey: string, limit?: number, now?: Date|string|number }} opts
 */
async function buildRevisionOutcomeIntelligence(opts = {}) {
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

  const eligibleOutcomes = [];
  let insufficientEvidenceTopicCount = 0;

  for (const topicData of topicMaps.values()) {
    const result = computeTopicOutcome(topicData.canonicalTopicKey, topicData);
    if (!result.eligible) {
      if (
        !result.notWeakEarlier &&
        (result.pairedCount > 0 || result.earlierAttempts > 0 || result.recentAttempts > 0)
      ) {
        insufficientEvidenceTopicCount += 1;
      }
      continue;
    }
    eligibleOutcomes.push({
      topicKey: result.topicKey,
      earlierAverageMastery: result.earlierAverageMastery,
      recentAverageMastery: result.recentAverageMastery,
      medianDeltaPercentagePoints: result.medianDeltaPercentagePoints,
      outcome: result.outcome,
      pairedStudentSampleBand: result.pairedStudentSampleBand,
    });
  }

  const topicOutcomes = sortTopicOutcomes(eligibleOutcomes).slice(0, limit);
  const eligibleOutcomeCount = eligibleOutcomes.length;
  const overallStatus = computeOverallStatus(eligibleOutcomes);

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
      weakMasteryThreshold: WEAK_MASTERY_THRESHOLD,
      improvingThresholdPercentagePoints: IMPROVING_THRESHOLD_PP,
      decliningThresholdPercentagePoints: DECLINING_THRESHOLD_PP,
    },
    topicOutcomes,
    summary: {
      overallStatus,
      humanReviewRequired: overallStatus !== "GREEN",
    },
    eligibleOutcomeCount,
    insufficientEvidenceTopicCount,
  };
}

module.exports = {
  VERSION,
  LEVEL,
  WEAK_MASTERY_THRESHOLD,
  OUTCOME_PRIORITY,
  classifyTopicOutcome,
  averageInteger,
  computeTopicOutcome,
  sortTopicOutcomes,
  computeOverallStatus,
  buildRevisionOutcomeIntelligence,
};
