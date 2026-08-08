/**
 * Autopilot 0 — Question Intelligence Observer V1.
 * L0 read-only: human-review candidates from PracticeAttempt aggregates only.
 * Performance signals: server-graded quiz_mcq only. No LearningEvidenceEvent blending.
 */
const PracticeAttempt = require("../../models/PracticeAttempt");
const TopicQuizQuestion = require("../../models/TopicQuizQuestion");
const ExamQuestion = require("../../models/ExamQuestion");
const adminTaxonomyService = require("../adminTaxonomyService");
const { assertValidSpecKey } = require("../../utils/specTopicValidation");
const { normalizeSpecKey } = require("../../config/featureFlags");
const { buildTopicKey, parseTopicKey, queryCandidates } = require("../../utils/topicKey");
const { isTopicGroup } = require("../../utils/topicTaxonomy");

const VERSION = "autopilot0-question-intelligence-v1";
const LEVEL = "L0";

/** Policy thresholds — not empirically proven defect cutoffs. */
const MIN_STUDENTS_FOR_PERFORMANCE = 10;
const MIN_RAW_ATTEMPTS_FOR_PERFORMANCE = 25;
const VERY_LOW_SUCCESS_RATE_THRESHOLD = 20;
const VERY_HIGH_SUCCESS_RATE_THRESHOLD = 95;

const PERFORMANCE_CONTENT_TYPE = "quiz_mcq";
const CLASSIFICATION_REVIEW_CANDIDATE = "REVIEW_CANDIDATE";

const SIGNAL_PRIORITY = {
  NO_TOPIC_LINK: 1,
  NO_MARK_SCHEME: 2,
  VERY_LOW_SUCCESS_RATE: 3,
  VERY_HIGH_SUCCESS_RATE: 4,
};

function studentSampleBand(studentCount) {
  if (studentCount < MIN_STUDENTS_FOR_PERFORMANCE) return null;
  if (studentCount <= 19) return "10-19";
  if (studentCount <= 49) return "20-49";
  return "50+";
}

function buildTopicAliasMap(specKey, taxonomy) {
  const aliasToCanonical = new Map();
  const canonicalTopicKeys = new Set();
  const allCandidates = new Set();

  for (const unit of taxonomy?.units || []) {
    const unitKey = unit.unitKey || unit.unit;
    for (const topic of unit.topics || []) {
      if (isTopicGroup(topic)) continue;
      const slug = (topic.key || topic.topicKey || "").trim();
      if (!slug) continue;
      const canonical = buildTopicKey(specKey, slug);
      canonicalTopicKeys.add(canonical);
      const candidates = queryCandidates(specKey, slug, unitKey);
      for (const alias of candidates) {
        aliasToCanonical.set(alias, canonical);
        allCandidates.add(alias);
      }
      aliasToCanonical.set(canonical, canonical);
      aliasToCanonical.set(slug, canonical);
      allCandidates.add(canonical);
      allCandidates.add(slug);
    }
  }

  return { aliasToCanonical, canonicalTopicKeys, allCandidates: [...allCandidates] };
}

function resolveCanonicalTopicKey(specKey, rawTopicKey, aliasToCanonical) {
  const trimmed = String(rawTopicKey || "").trim();
  if (!trimmed) return null;
  if (aliasToCanonical.has(trimmed)) return aliasToCanonical.get(trimmed);

  const parsed = parseTopicKey(trimmed);
  if (parsed.isNamespaced && parsed.specKey && parsed.specKey !== specKey) return null;

  const slug = parsed.topicKey || trimmed;
  const candidates = queryCandidates(specKey, slug);
  for (const candidate of candidates) {
    if (aliasToCanonical.has(candidate)) return aliasToCanonical.get(candidate);
  }
  return null;
}

function isQuizInSpecScope(specKey, record, aliasToCanonical) {
  const recordSpec = String(record.specKey || "").trim();
  if (recordSpec && recordSpec !== specKey) return false;
  if (recordSpec === specKey) return true;
  return Boolean(resolveCanonicalTopicKey(specKey, record.topicKey, aliasToCanonical));
}

function isExamInSpecScope(specKey, record, aliasToCanonical) {
  return Boolean(resolveCanonicalTopicKey(specKey, record.topicKey, aliasToCanonical));
}

function examHasMarkScheme(doc) {
  if (!doc) return false;
  if (doc.questionMode === "composite") {
    const parts = Array.isArray(doc.parts) ? doc.parts : [];
    if (parts.length === 0) return false;
    return parts.every(
      (part) =>
        Array.isArray(part.markScheme) && part.markScheme.some((line) => String(line || "").trim())
    );
  }
  return Array.isArray(doc.markScheme) && doc.markScheme.some((line) => String(line || "").trim());
}

function computeSuccessRate(correctStudents, uniqueStudents) {
  if (!uniqueStudents) return null;
  return Math.round((correctStudents / uniqueStudents) * 100);
}

function compareQuestionKeys(a, b) {
  const typeCmp = String(a.contentType).localeCompare(String(b.contentType));
  if (typeCmp !== 0) return typeCmp;
  return String(a.contentId).localeCompare(String(b.contentId));
}

function sortReviewCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    const priA = SIGNAL_PRIORITY[a.signal] || 99;
    const priB = SIGNAL_PRIORITY[b.signal] || 99;
    if (priA !== priB) return priA - priB;

    if (a.signal === "VERY_LOW_SUCCESS_RATE" && b.signal === "VERY_LOW_SUCCESS_RATE") {
      if (a.successRate !== b.successRate) return a.successRate - b.successRate;
    }
    if (a.signal === "VERY_HIGH_SUCCESS_RATE" && b.signal === "VERY_HIGH_SUCCESS_RATE") {
      if (a.successRate !== b.successRate) return b.successRate - a.successRate;
    }

    return compareQuestionKeys(a.questionKey, b.questionKey);
  });
}

async function aggregatePerformanceByQuestion(specKey) {
  const eligibleMatch = {
    specKey,
    contentType: PERFORMANCE_CONTENT_TYPE,
    contentId: { $ne: null },
    studentId: { $ne: null },
    isCorrect: { $type: "bool" },
  };

  const [rawCounts, latestPerStudent] = await Promise.all([
    PracticeAttempt.aggregate([
      { $match: eligibleMatch },
      {
        $group: {
          _id: { contentType: "$contentType", contentId: "$contentId" },
          rawAttemptCount: { $sum: 1 },
        },
      },
    ]),
    PracticeAttempt.aggregate([
      { $match: eligibleMatch },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: {
            contentType: "$contentType",
            contentId: "$contentId",
            studentId: "$studentId",
          },
          isCorrect: { $first: "$isCorrect" },
        },
      },
      {
        $group: {
          _id: { contentType: "$_id.contentType", contentId: "$_id.contentId" },
          uniqueStudents: { $sum: 1 },
          correctStudents: {
            $sum: { $cond: [{ $eq: ["$isCorrect", true] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const rawByKey = new Map(
    rawCounts.map((row) => [
      `${row._id.contentType}::${row._id.contentId}`,
      row.rawAttemptCount,
    ])
  );

  return latestPerStudent.map((row) => {
    const key = `${row._id.contentType}::${row._id.contentId}`;
    return {
      contentType: row._id.contentType,
      contentId: row._id.contentId,
      uniqueStudents: row.uniqueStudents,
      correctStudents: row.correctStudents,
      rawAttemptCount: rawByKey.get(key) || 0,
      successRate: computeSuccessRate(row.correctStudents, row.uniqueStudents),
    };
  });
}

async function loadStructuralQuizCandidates(specKey, aliasToCanonical, allCandidates) {
  if (!allCandidates.length) return [];

  const rows = await TopicQuizQuestion.find({
    status: "published",
    isArchived: { $ne: true },
    $or: [{ specKey }, { topicKey: { $in: allCandidates } }],
  })
    .select("_id topicKey specKey")
    .lean();

  const candidates = [];
  for (const row of rows) {
    if (!isQuizInSpecScope(specKey, row, aliasToCanonical)) continue;
    const canonical = resolveCanonicalTopicKey(specKey, row.topicKey, aliasToCanonical);
    if (!canonical) {
      candidates.push({
        questionKey: { contentType: "quiz_mcq", contentId: String(row._id) },
        topicKey: null,
        signal: "NO_TOPIC_LINK",
        signalType: "STRUCTURAL",
        classification: CLASSIFICATION_REVIEW_CANDIDATE,
        successRate: null,
        studentSampleBand: null,
      });
    }
  }
  return candidates;
}

async function loadStructuralExamCandidates(specKey, aliasToCanonical, allCandidates) {
  if (!allCandidates.length) return [];

  const rows = await ExamQuestion.find({
    status: "published",
    isArchived: { $ne: true },
    topicKey: { $in: allCandidates },
  })
    .select("_id topicKey questionMode parts markScheme")
    .lean();

  const candidates = [];
  for (const row of rows) {
    if (!isExamInSpecScope(specKey, row, aliasToCanonical)) continue;
    const canonical = resolveCanonicalTopicKey(specKey, row.topicKey, aliasToCanonical);
    const questionKey = { contentType: "exam_question", contentId: String(row._id) };

    if (!canonical) {
      continue;
    }

    if (!examHasMarkScheme(row)) {
      candidates.push({
        questionKey,
        topicKey: canonical,
        signal: "NO_MARK_SCHEME",
        signalType: "STRUCTURAL",
        classification: CLASSIFICATION_REVIEW_CANDIDATE,
        successRate: null,
        studentSampleBand: null,
      });
    }
  }
  return candidates;
}

function classifyPerformanceRows(rows, topicKeyByQuestionId) {
  const performanceCandidates = [];
  let eligiblePerformanceQuestionCount = 0;
  let suppressedPerformanceQuestionCount = 0;

  for (const row of rows) {
    const passesGates =
      row.uniqueStudents >= MIN_STUDENTS_FOR_PERFORMANCE &&
      row.rawAttemptCount >= MIN_RAW_ATTEMPTS_FOR_PERFORMANCE;

    if (!passesGates) {
      if (row.rawAttemptCount > 0 || row.uniqueStudents > 0) {
        suppressedPerformanceQuestionCount += 1;
      }
      continue;
    }

    eligiblePerformanceQuestionCount += 1;
    const questionKey = {
      contentType: row.contentType,
      contentId: String(row.contentId),
    };
    const topicKey = topicKeyByQuestionId.get(String(row.contentId)) || null;
    const base = {
      questionKey,
      topicKey,
      signalType: "PERFORMANCE",
      classification: CLASSIFICATION_REVIEW_CANDIDATE,
      studentSampleBand: studentSampleBand(row.uniqueStudents),
    };

    if (row.successRate <= VERY_LOW_SUCCESS_RATE_THRESHOLD) {
      performanceCandidates.push({
        ...base,
        signal: "VERY_LOW_SUCCESS_RATE",
        successRate: row.successRate,
      });
    } else if (row.successRate >= VERY_HIGH_SUCCESS_RATE_THRESHOLD) {
      performanceCandidates.push({
        ...base,
        signal: "VERY_HIGH_SUCCESS_RATE",
        successRate: row.successRate,
      });
    }
  }

  return {
    performanceCandidates,
    eligiblePerformanceQuestionCount,
    suppressedPerformanceQuestionCount,
  };
}

async function buildTopicKeyLookupForQuizQuestions(specKey, questionIds, aliasToCanonical) {
  if (!questionIds.length) return new Map();
  const rows = await TopicQuizQuestion.find({ _id: { $in: questionIds } })
    .select("_id topicKey specKey")
    .lean();
  const map = new Map();
  for (const row of rows) {
    if (!isQuizInSpecScope(specKey, row, aliasToCanonical)) continue;
    map.set(String(row._id), resolveCanonicalTopicKey(specKey, row.topicKey, aliasToCanonical));
  }
  return map;
}

/**
 * @param {{ specKey: string, limit?: number }} opts
 */
async function buildQuestionIntelligence(opts = {}) {
  const specKey = normalizeSpecKey(opts.specKey);
  if (!specKey) {
    const err = new Error("specKey is required");
    err.code = "INVALID_SPEC_KEY";
    throw err;
  }

  assertValidSpecKey(specKey);

  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));

  const taxonomy = await adminTaxonomyService.getMergedTaxonomyBySpecKey(specKey);
  if (!taxonomy) {
    const err = new Error(`Unknown specKey: ${specKey}`);
    err.code = "INVALID_SPEC_KEY";
    throw err;
  }

  const { aliasToCanonical, allCandidates } = buildTopicAliasMap(specKey, taxonomy);

  const [performanceRows, structuralQuiz, structuralExam] = await Promise.all([
    aggregatePerformanceByQuestion(specKey),
    loadStructuralQuizCandidates(specKey, aliasToCanonical, allCandidates),
    loadStructuralExamCandidates(specKey, aliasToCanonical, allCandidates),
  ]);

  const quizIds = performanceRows.map((row) => row.contentId);
  const topicLookup = await buildTopicKeyLookupForQuizQuestions(
    specKey,
    quizIds,
    aliasToCanonical
  );

  const {
    performanceCandidates,
    eligiblePerformanceQuestionCount,
    suppressedPerformanceQuestionCount,
  } = classifyPerformanceRows(performanceRows, topicLookup);

  const deduped = new Map();
  for (const candidate of [...structuralQuiz, ...structuralExam, ...performanceCandidates]) {
    const dedupeKey = `${candidate.questionKey.contentType}::${candidate.questionKey.contentId}::${candidate.signal}`;
    if (!deduped.has(dedupeKey)) deduped.set(dedupeKey, candidate);
  }

  const reviewCandidates = sortReviewCandidates([...deduped.values()]).slice(0, limit);

  const hasCandidates = reviewCandidates.length > 0;
  const overallStatus = hasCandidates
    ? "AMBER"
    : eligiblePerformanceQuestionCount > 0
    ? "GREEN"
    : "UNKNOWN";

  return {
    version: VERSION,
    level: LEVEL,
    generatedAt: new Date().toISOString(),
    cohort: {
      specKey,
      cohortScope: "SPEC_ONLY",
      tierSupported: false,
      tier: null,
    },
    privacy: {
      minStudentsForPerformance: MIN_STUDENTS_FOR_PERFORMANCE,
      minRawAttemptsForPerformance: MIN_RAW_ATTEMPTS_FOR_PERFORMANCE,
    },
    reviewCandidates,
    summary: {
      overallStatus,
      humanReviewRequired: overallStatus !== "GREEN",
    },
    eligiblePerformanceQuestionCount,
    suppressedPerformanceQuestionCount,
  };
}

module.exports = {
  VERSION,
  LEVEL,
  MIN_STUDENTS_FOR_PERFORMANCE,
  MIN_RAW_ATTEMPTS_FOR_PERFORMANCE,
  VERY_LOW_SUCCESS_RATE_THRESHOLD,
  VERY_HIGH_SUCCESS_RATE_THRESHOLD,
  PERFORMANCE_CONTENT_TYPE,
  CLASSIFICATION_REVIEW_CANDIDATE,
  studentSampleBand,
  buildTopicAliasMap,
  resolveCanonicalTopicKey,
  isQuizInSpecScope,
  isExamInSpecScope,
  examHasMarkScheme,
  computeSuccessRate,
  sortReviewCandidates,
  aggregatePerformanceByQuestion,
  classifyPerformanceRows,
  buildQuestionIntelligence,
};
