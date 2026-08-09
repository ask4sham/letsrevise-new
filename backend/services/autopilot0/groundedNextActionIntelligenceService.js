/**
 * Autopilot 0 — Grounded Next-Action Intelligence Observer V1.
 * L0 read-only: human advisory only from A0.6 outcomes, A0.4 question review signals,
 * and batched content availability. No causal claims. No automatic actions.
 */
const Lesson = require("../../models/Lesson");
const TopicFlashcard = require("../../models/TopicFlashcard");
const TopicQuizQuestion = require("../../models/TopicQuizQuestion");
const ExamQuestion = require("../../models/ExamQuestion");
const PracticeAttempt = require("../../models/PracticeAttempt");
const adminTaxonomyService = require("../adminTaxonomyService");
const { assertValidSpecKey } = require("../../utils/specTopicValidation");
const { normalizeSpecKey } = require("../../config/featureFlags");
const { buildTopicKey, queryCandidates } = require("../../utils/topicKey");
const { isTopicGroup } = require("../../utils/topicTaxonomy");
const { buildTopicAliasMap, resolveCanonicalTopicKey } = require("./revisionIntelligenceService");
const { computeTopicOutcome } = require("./revisionOutcomeIntelligenceService");
const {
  computeWindowCutoffs,
  mergeAggregatedRowsByCanonicalTopic,
  buildTopicWindowMaps,
  aggregateLearningEvidenceCounts,
} = require("./learningTrendIntelligenceService");
const {
  buildTopicAliasMap: buildQuestionTopicAliasMap,
  resolveCanonicalTopicKey: resolveQuestionCanonicalTopicKey,
  isQuizInSpecScope,
  isExamInSpecScope,
  examHasMarkScheme,
  aggregatePerformanceByQuestion,
  classifyPerformanceRows,
} = require("./questionIntelligenceService");

const VERSION = "autopilot0-grounded-next-action-intelligence-v1";
const LEVEL = "L0";

const MIN_LESSON_COUNT = 1;
const MIN_QUIZ_COUNT = 3;
const MIN_EXAM_COUNT = 2;
const MIN_FLASHCARD_COUNT = 1;

/** Documented DB operation count for V1 request path (see buildGroundedNextActionIntelligence). */
const DB_OPERATION_COUNT = 10;

const ADVISORY_PRIORITY = {
  CONSIDER_QUESTION_REVIEW: 1,
  CONSIDER_RETEACH: 2,
  CONSIDER_MORE_PRACTICE: 3,
  CONSIDER_EXAM_PRACTICE: 4,
  CONSIDER_FLASHCARD_REVISION: 5,
  CONTINUE_CURRENT_PATH: 6,
  NO_FURTHER_WEAKNESS_OBSERVED: 7,
  INSUFFICIENT_EVIDENCE: 8,
};

const GREEN_ACTIONS = new Set(["CONTINUE_CURRENT_PATH", "NO_FURTHER_WEAKNESS_OBSERVED"]);
const AMBER_ACTIONS = new Set([
  "CONSIDER_QUESTION_REVIEW",
  "CONSIDER_RETEACH",
  "CONSIDER_MORE_PRACTICE",
  "CONSIDER_EXAM_PRACTICE",
  "CONSIDER_FLASHCARD_REVISION",
]);

function buildTopicCandidateMap(specKey, taxonomy) {
  const topicCandidates = new Map();
  for (const unit of taxonomy?.units || []) {
    const unitKey = unit.unitKey || unit.unit;
    for (const topic of unit.topics || []) {
      if (isTopicGroup(topic)) continue;
      const slug = (topic.key || topic.topicKey || "").trim();
      if (!slug) continue;
      const canonical = buildTopicKey(specKey, slug);
      topicCandidates.set(canonical, queryCandidates(specKey, slug, unitKey));
    }
  }
  return topicCandidates;
}

async function aggregateCountsByTopicKey(Model, candidateKeys, extraMatch = {}) {
  const validKeys = candidateKeys.filter((k) => typeof k === "string" && k !== "");
  if (validKeys.length === 0) return new Map();

  const rows = await Model.aggregate([
    {
      $match: {
        topicKey: { $in: validKeys },
        ...extraMatch,
      },
    },
    { $group: { _id: "$topicKey", count: { $sum: 1 } } },
  ]);

  const map = new Map();
  for (const row of rows) map.set(row._id, row.count);
  return map;
}

function sumCountsForTopic(candidates, countMap) {
  return candidates.reduce((sum, key) => sum + (countMap.get(key) || 0), 0);
}

async function buildContentAvailabilityMap(specKey, canonicalTopicKeys, topicCandidates) {
  const allCandidates = new Set();
  for (const canonical of canonicalTopicKeys) {
    const candidates = topicCandidates.get(canonical) || [canonical];
    for (const key of candidates) allCandidates.add(key);
  }

  const candidateList = [...allCandidates];
  const [lessonMap, flashMap, quizMap, examMap] = await Promise.all([
    aggregateCountsByTopicKey(Lesson, candidateList, {
      specKey,
      status: "published",
      isPublished: true,
    }),
    aggregateCountsByTopicKey(TopicFlashcard, candidateList, {
      status: { $in: ["draft", "published"] },
      isArchived: { $ne: true },
    }),
    aggregateCountsByTopicKey(TopicQuizQuestion, candidateList, {
      status: { $in: ["draft", "published"] },
      isArchived: { $ne: true },
    }),
    aggregateCountsByTopicKey(ExamQuestion, candidateList, {
      status: { $in: ["draft", "published"] },
    }),
  ]);

  const availabilityByTopic = new Map();
  for (const canonical of canonicalTopicKeys) {
    const candidates = topicCandidates.get(canonical) || [canonical];
    const lessonCount = sumCountsForTopic(candidates, lessonMap);
    const flashcardCount = sumCountsForTopic(candidates, flashMap);
    const quizCount = sumCountsForTopic(candidates, quizMap);
    const examQuestionCount = sumCountsForTopic(candidates, examMap);
    availabilityByTopic.set(canonical, {
      lesson: lessonCount >= MIN_LESSON_COUNT,
      quizPractice: quizCount >= MIN_QUIZ_COUNT,
      examPractice: examQuestionCount >= MIN_EXAM_COUNT,
      flashcards: flashcardCount >= MIN_FLASHCARD_COUNT,
    });
  }

  return availabilityByTopic;
}

function emptyAvailability() {
  return {
    lesson: false,
    quizPractice: false,
    examPractice: false,
    flashcards: false,
  };
}

function computeEligibleA06Outcomes(specKey, taxonomy, rawRows, aliasToCanonical) {
  const mergedRows = mergeAggregatedRowsByCanonicalTopic(rawRows, specKey, aliasToCanonical);
  const topicMaps = buildTopicWindowMaps(mergedRows);
  const outcomesByTopic = new Map();

  for (const topicData of topicMaps.values()) {
    const result = computeTopicOutcome(topicData.canonicalTopicKey, topicData);
    if (!result.eligible) continue;
    outcomesByTopic.set(result.topicKey, result.outcome);
  }

  return outcomesByTopic;
}

async function loadQuizQuestionRowsForSpec(specKey, allCandidates) {
  if (!allCandidates.length) return [];
  return TopicQuizQuestion.find({
    status: "published",
    isArchived: { $ne: true },
    $or: [{ specKey }, { topicKey: { $in: allCandidates } }],
  })
    .select("_id topicKey specKey")
    .lean();
}

function buildTopicLookupFromQuizRows(specKey, quizRows, questionIds, aliasToCanonical) {
  const idSet = new Set(questionIds.map((id) => String(id)));
  const map = new Map();
  for (const row of quizRows) {
    if (!idSet.has(String(row._id))) continue;
    if (!isQuizInSpecScope(specKey, row, aliasToCanonical)) continue;
    map.set(String(row._id), resolveQuestionCanonicalTopicKey(specKey, row.topicKey, aliasToCanonical));
  }
  return map;
}

async function loadStructuralReviewTopics(specKey, aliasToCanonical, allCandidates) {
  const topicsWithReview = new Set();
  if (!allCandidates.length) return topicsWithReview;

  const examRows = await ExamQuestion.find({
    status: "published",
    isArchived: { $ne: true },
    topicKey: { $in: allCandidates },
  })
    .select("_id topicKey questionMode parts markScheme")
    .lean();

  for (const row of examRows) {
    if (!isExamInSpecScope(specKey, row, aliasToCanonical)) continue;
    const canonical = resolveQuestionCanonicalTopicKey(specKey, row.topicKey, aliasToCanonical);
    if (canonical && !examHasMarkScheme(row)) {
      topicsWithReview.add(canonical);
    }
  }

  return topicsWithReview;
}

async function buildReviewCandidateTopicSet(specKey, taxonomy) {
  const { aliasToCanonical, allCandidates } = buildQuestionTopicAliasMap(specKey, taxonomy);
  const quizRows = await loadQuizQuestionRowsForSpec(specKey, allCandidates);
  const [performanceRows, structuralTopics] = await Promise.all([
    aggregatePerformanceByQuestion(specKey),
    loadStructuralReviewTopics(specKey, aliasToCanonical, allCandidates),
  ]);

  const quizIds = performanceRows.map((row) => row.contentId);
  const topicLookup = buildTopicLookupFromQuizRows(
    specKey,
    quizRows,
    quizIds,
    aliasToCanonical
  );
  const { performanceCandidates } = classifyPerformanceRows(performanceRows, topicLookup);

  const topicsWithReview = new Set(structuralTopics);
  for (const candidate of performanceCandidates) {
    if (candidate.topicKey) topicsWithReview.add(candidate.topicKey);
  }
  return topicsWithReview;
}

function resolvePrimaryAdvisory({ observedOutcome, questionReviewRecommended, availability }) {
  if (questionReviewRecommended) return "CONSIDER_QUESTION_REVIEW";
  if (!observedOutcome) return "INSUFFICIENT_EVIDENCE";
  if (observedOutcome === "NO_LONGER_WEAK") return "NO_FURTHER_WEAKNESS_OBSERVED";
  if (observedOutcome === "WEAK_AND_IMPROVING") return "CONTINUE_CURRENT_PATH";

  if (observedOutcome === "WEAK_AND_DECLINING") {
    if (availability.lesson) return "CONSIDER_RETEACH";
    if (availability.quizPractice) return "CONSIDER_MORE_PRACTICE";
    if (availability.examPractice) return "CONSIDER_EXAM_PRACTICE";
    if (availability.flashcards) return "CONSIDER_FLASHCARD_REVISION";
    return "INSUFFICIENT_EVIDENCE";
  }

  if (observedOutcome === "WEAK_AND_STABLE") {
    if (availability.quizPractice) return "CONSIDER_MORE_PRACTICE";
    if (availability.examPractice) return "CONSIDER_EXAM_PRACTICE";
    if (availability.flashcards) return "CONSIDER_FLASHCARD_REVISION";
    if (availability.lesson) return "CONSIDER_RETEACH";
    return "INSUFFICIENT_EVIDENCE";
  }

  return "INSUFFICIENT_EVIDENCE";
}

function sortTopicAdvisories(rows) {
  return [...rows].sort((a, b) => {
    const priA = ADVISORY_PRIORITY[a.advisoryAction] || 99;
    const priB = ADVISORY_PRIORITY[b.advisoryAction] || 99;
    if (priA !== priB) return priA - priB;
    return String(a.topicKey).localeCompare(String(b.topicKey));
  });
}

function computeAdvisorySummary(advisories) {
  const usable = advisories.filter((row) => row.advisoryAction !== "INSUFFICIENT_EVIDENCE");
  if (usable.length === 0) {
    return { overallStatus: "UNKNOWN", humanReviewRequired: true };
  }
  const allGreen = usable.every((row) => GREEN_ACTIONS.has(row.advisoryAction));
  if (allGreen) {
    return { overallStatus: "GREEN", humanReviewRequired: false };
  }
  const hasAmber = usable.some((row) => AMBER_ACTIONS.has(row.advisoryAction));
  if (hasAmber) {
    return { overallStatus: "AMBER", humanReviewRequired: true };
  }
  return { overallStatus: "UNKNOWN", humanReviewRequired: true };
}

/**
 * @param {{ specKey: string, topicKey?: string, limit?: number, now?: Date|string|number }} opts
 */
async function buildGroundedNextActionIntelligence(opts = {}) {
  const specKey = normalizeSpecKey(opts.specKey);
  if (!specKey) {
    const err = new Error("specKey is required");
    err.code = "INVALID_SPEC_KEY";
    throw err;
  }

  assertValidSpecKey(specKey);

  const requestedTopicKey =
    opts.topicKey != null && String(opts.topicKey).trim() !== ""
      ? String(opts.topicKey).trim()
      : null;
  const isExactTopicMode = requestedTopicKey != null;

  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const cutoffs = computeWindowCutoffs(opts.now ?? new Date());

  const taxonomy = await adminTaxonomyService.getMergedTaxonomyBySpecKey(specKey);
  if (!taxonomy) {
    const err = new Error(`Unknown specKey: ${specKey}`);
    err.code = "INVALID_SPEC_KEY";
    throw err;
  }

  const { aliasToCanonical } = buildTopicAliasMap(specKey, taxonomy);
  const topicCandidates = buildTopicCandidateMap(specKey, taxonomy);

  let canonicalTopicKey = null;
  if (isExactTopicMode) {
    canonicalTopicKey = resolveCanonicalTopicKey(specKey, requestedTopicKey, aliasToCanonical);
    if (!canonicalTopicKey || !topicCandidates.has(canonicalTopicKey)) {
      const err = new Error(`Unknown topicKey for specKey "${specKey}": ${requestedTopicKey}`);
      err.code = "INVALID_TOPIC_KEY";
      throw err;
    }
  }

  const [rawRows, reviewCandidateTopics] = await Promise.all([
    aggregateLearningEvidenceCounts(specKey, cutoffs),
    buildReviewCandidateTopicSet(specKey, taxonomy),
  ]);

  const outcomesByTopic = computeEligibleA06Outcomes(specKey, taxonomy, rawRows, aliasToCanonical);

  const topicKeys = isExactTopicMode
    ? new Set([canonicalTopicKey])
    : new Set([...outcomesByTopic.keys(), ...reviewCandidateTopics]);

  if (!isExactTopicMode && topicKeys.size === 0) {
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
      topicAdvisories: [],
      summary: { overallStatus: "UNKNOWN", humanReviewRequired: true },
    };
  }

  const availabilityByTopic = await buildContentAvailabilityMap(
    specKey,
    [...topicKeys],
    topicCandidates
  );

  const advisories = [];
  for (const topicKey of topicKeys) {
    const observedOutcome = outcomesByTopic.get(topicKey) || null;
    const questionReviewRecommended = reviewCandidateTopics.has(topicKey);
    const availability = availabilityByTopic.get(topicKey) || emptyAvailability();
    const advisoryAction = resolvePrimaryAdvisory({
      observedOutcome,
      questionReviewRecommended,
      availability,
    });

    advisories.push({
      topicKey,
      observedOutcome,
      questionReviewRecommended,
      advisoryAction,
      contentAvailability: { ...availability },
    });
  }

  const topicAdvisories = isExactTopicMode
    ? advisories
    : sortTopicAdvisories(advisories).slice(0, limit);
  const summary = computeAdvisorySummary(topicAdvisories);

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
    topicAdvisories,
    summary,
  };
}

module.exports = {
  VERSION,
  LEVEL,
  DB_OPERATION_COUNT,
  MIN_LESSON_COUNT,
  MIN_QUIZ_COUNT,
  MIN_EXAM_COUNT,
  MIN_FLASHCARD_COUNT,
  ADVISORY_PRIORITY,
  buildTopicCandidateMap,
  buildContentAvailabilityMap,
  computeEligibleA06Outcomes,
  buildReviewCandidateTopicSet,
  resolvePrimaryAdvisory,
  sortTopicAdvisories,
  computeAdvisorySummary,
  buildGroundedNextActionIntelligence,
};
