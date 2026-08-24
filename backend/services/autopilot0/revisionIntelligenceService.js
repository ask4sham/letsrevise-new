/**
 * Autopilot 0 — Revision Intelligence Topic Summary V1.
 * L0 read-only platform observer: topic weakness + content × mastery cross-signals.
 * Mastery source: LearningEvidenceEvent only (student-topic-evidence parity).
 */
const LearningEvidenceEvent = require("../../models/LearningEvidenceEvent");
const Lesson = require("../../models/Lesson");
const TopicFlashcard = require("../../models/TopicFlashcard");
const TopicQuizQuestion = require("../../models/TopicQuizQuestion");
const ExamQuestion = require("../../models/ExamQuestion");
const adminTaxonomyService = require("../adminTaxonomyService");
const { computeCoverageScore } = require("../contentCoverageService");
const { assertValidSpecKey } = require("../../utils/specTopicValidation");
const { normalizeSpecKey } = require("../../config/featureFlags");
const { buildTopicKey, parseTopicKey, queryCandidates } = require("../../utils/topicKey");
const { isTopicGroup } = require("../../utils/topicTaxonomy");

const VERSION = "autopilot0-revision-intelligence-v1";
const LEVEL = "L0";
const WEAK_THRESHOLD = 70;
const COVERAGE_STRONG_THRESHOLD = 70;

const MIN_STUDENTS_FOR_TOPIC = 5;
const MIN_ATTEMPTS_FOR_TOPIC = 10;
const SUFFICIENT_ATTEMPTS = 20;
const HIGH_CONFIDENCE_STUDENTS = 20;
const HIGH_CONFIDENCE_ATTEMPTS = 100;

const QUIZ_EXAM_EVENT_TYPES = ["quiz_attempt", "exam_question_attempt"];

/**
 * Mirror studentTopicEvidenceService.buildEvidenceFromEvents mastery semantics.
 */
function computeMasteryFromCounts(quizAttempts, quizCorrect, examAttempts, examCorrect) {
  const quizAccuracy =
    quizAttempts > 0 ? Math.round((quizCorrect / quizAttempts) * 100) : null;
  const examAccuracy =
    examAttempts > 0 ? Math.round((examCorrect / examAttempts) * 100) : null;

  if (quizAccuracy !== null && examAccuracy !== null) {
    return Math.round((quizAccuracy + examAccuracy) / 2);
  }
  if (quizAccuracy !== null) return quizAccuracy;
  if (examAccuracy !== null) return examAccuracy;
  return null;
}

function hasCalculableMastery(quizAttempts, examAttempts, masteryScore) {
  return quizAttempts + examAttempts >= 1 && masteryScore !== null;
}

function isWeakMastery(masteryScore) {
  return masteryScore !== null && masteryScore < WEAK_THRESHOLD;
}

function classifyConfidence(studentCount, attemptCount) {
  if (studentCount >= HIGH_CONFIDENCE_STUDENTS && attemptCount >= HIGH_CONFIDENCE_ATTEMPTS) {
    return "HIGH_CONFIDENCE";
  }
  if (studentCount >= MIN_STUDENTS_FOR_TOPIC && attemptCount >= SUFFICIENT_ATTEMPTS) {
    return "SUFFICIENT_SAMPLE";
  }
  return "LOW";
}

function studentSampleBand(studentCount) {
  if (studentCount < MIN_STUDENTS_FOR_TOPIC) return null;
  if (studentCount <= 9) return "5-9";
  if (studentCount <= 19) return "10-19";
  return "20+";
}

function formatStudentsWithEvidence(studentCount) {
  if (studentCount < 10) return null;
  return studentCount;
}

function buildTopicAliasMap(specKey, taxonomy) {
  const aliasToCanonical = new Map();
  const canonicalMeta = new Map();

  for (const unit of taxonomy?.units || []) {
    const unitKey = unit.unitKey || unit.unit;
    for (const topic of unit.topics || []) {
      if (isTopicGroup(topic)) continue;
      const slug = (topic.key || topic.topicKey || "").trim();
      if (!slug) continue;
      const canonical = buildTopicKey(specKey, slug);
      const candidates = queryCandidates(specKey, slug, unitKey);
      for (const alias of candidates) {
        aliasToCanonical.set(alias, canonical);
      }
      aliasToCanonical.set(canonical, canonical);
      aliasToCanonical.set(slug, canonical);
      canonicalMeta.set(canonical, {
        topicKey: canonical,
        topicName: topic.topic || slug.replace(/-/g, " "),
      });
    }
  }

  return { aliasToCanonical, canonicalMeta };
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

function mergeUserTopicRow(target, source) {
  target.quizAttempts += source.quizAttempts;
  target.quizCorrect += source.quizCorrect;
  target.examAttempts += source.examAttempts;
  target.examCorrect += source.examCorrect;
}

function rollupTopicMetrics(userTopicRows) {
  const byTopic = new Map();

  for (const row of userTopicRows) {
    const masteryScore = computeMasteryFromCounts(
      row.quizAttempts,
      row.quizCorrect,
      row.examAttempts,
      row.examCorrect
    );
    if (!hasCalculableMastery(row.quizAttempts, row.examAttempts, masteryScore)) continue;

    if (!byTopic.has(row.canonicalTopicKey)) {
      byTopic.set(row.canonicalTopicKey, {
        canonicalTopicKey: row.canonicalTopicKey,
        students: [],
        attemptCount: 0,
      });
    }
    const topic = byTopic.get(row.canonicalTopicKey);
    topic.attemptCount += row.quizAttempts + row.examAttempts;
    topic.students.push({ masteryScore, isWeak: isWeakMastery(masteryScore) });
  }

  const results = [];
  let suppressedTopicCount = 0;

  for (const topic of byTopic.values()) {
    const studentCount = topic.students.length;
    const attemptCount = topic.attemptCount;

    if (studentCount < MIN_STUDENTS_FOR_TOPIC || attemptCount < MIN_ATTEMPTS_FOR_TOPIC) {
      suppressedTopicCount += 1;
      continue;
    }

    const weakCount = topic.students.filter((s) => s.isWeak).length;
    const masterySum = topic.students.reduce((sum, s) => sum + s.masteryScore, 0);
    const averageMastery = Math.round(masterySum / studentCount);
    const weakRate = Math.round((weakCount / studentCount) * 1000) / 1000;

    results.push({
      canonicalTopicKey: topic.canonicalTopicKey,
      studentCount,
      attemptCount,
      averageMastery,
      weakRate,
      confidence: classifyConfidence(studentCount, attemptCount),
    });
  }

  return { topics: results, suppressedTopicCount };
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

async function buildCoverageScoreMap(specKey, taxonomy) {
  const allCandidates = new Set();
  const topicCandidates = new Map();

  for (const unit of taxonomy?.units || []) {
    const unitKey = unit.unitKey || unit.unit;
    for (const topic of unit.topics || []) {
      if (isTopicGroup(topic)) continue;
      const slug = (topic.key || topic.topicKey || "").trim();
      if (!slug) continue;
      const canonical = buildTopicKey(specKey, slug);
      const candidates = queryCandidates(specKey, slug, unitKey);
      topicCandidates.set(canonical, candidates);
      for (const key of candidates) allCandidates.add(key);
    }
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

  const coverageByCanonical = new Map();
  for (const [canonical, candidates] of topicCandidates.entries()) {
    const counts = {
      lessonCount: sumCountsForTopic(candidates, lessonMap),
      flashcardCount: sumCountsForTopic(candidates, flashMap),
      quizCount: sumCountsForTopic(candidates, quizMap),
      examQuestionCount: sumCountsForTopic(candidates, examMap),
    };
    const { score, status } = computeCoverageScore(counts, 0);
    coverageByCanonical.set(canonical, { coverageScore: score, coverageStatus: status });
  }

  return coverageByCanonical;
}

async function aggregateLearningEvidenceByUserTopic(specKey) {
  const rows = await LearningEvidenceEvent.aggregate([
    {
      $match: {
        specKey,
        eventType: { $in: QUIZ_EXAM_EVENT_TYPES },
      },
    },
    {
      $group: {
        _id: { userId: "$userId", topicKey: "$topicKey" },
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

  return rows.map((row) => ({
    userId: row._id.userId,
    topicKey: row._id.topicKey,
    quizAttempts: row.quizAttempts || 0,
    quizCorrect: row.quizCorrect || 0,
    examAttempts: row.examAttempts || 0,
    examCorrect: row.examCorrect || 0,
  }));
}

function normalizeUserTopicRows(specKey, rawRows, aliasToCanonical) {
  const merged = new Map();

  for (const row of rawRows) {
    const canonicalTopicKey = resolveCanonicalTopicKey(specKey, row.topicKey, aliasToCanonical);
    if (!canonicalTopicKey) continue;

    const userKey = String(row.userId);
    const mergeKey = `${userKey}::${canonicalTopicKey}`;
    if (!merged.has(mergeKey)) {
      merged.set(mergeKey, {
        canonicalTopicKey,
        quizAttempts: 0,
        quizCorrect: 0,
        examAttempts: 0,
        examCorrect: 0,
      });
    }
    mergeUserTopicRow(merged.get(mergeKey), row);
  }

  return [...merged.values()];
}

function sortTopicWeakness(rows) {
  return [...rows].sort((a, b) => {
    if (b.weakRate !== a.weakRate) return b.weakRate - a.weakRate;
    if (b.attemptCount !== a.attemptCount) return b.attemptCount - a.attemptCount;
    return a.topicKey.localeCompare(b.topicKey);
  });
}

function sortCrossSignals(rows) {
  return [...rows].sort((a, b) => {
    if (b.coverageScore !== a.coverageScore) return b.coverageScore - a.coverageScore;
    if (a.averageMastery !== b.averageMastery) return a.averageMastery - b.averageMastery;
    return a.topicKey.localeCompare(b.topicKey);
  });
}

/**
 * @param {{ specKey: string, limit?: number }} opts
 */
async function buildRevisionIntelligence(opts = {}) {
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

  const { aliasToCanonical, canonicalMeta } = buildTopicAliasMap(specKey, taxonomy);

  const [rawEvidenceRows, coverageByCanonical] = await Promise.all([
    aggregateLearningEvidenceByUserTopic(specKey),
    buildCoverageScoreMap(specKey, taxonomy),
  ]);

  const userTopicRows = normalizeUserTopicRows(specKey, rawEvidenceRows, aliasToCanonical);
  const { topics, suppressedTopicCount } = rollupTopicMetrics(userTopicRows);

  const topicWeakness = sortTopicWeakness(
    topics.map((topic) => {
      const meta = canonicalMeta.get(topic.canonicalTopicKey) || {
        topicKey: topic.canonicalTopicKey,
        topicName: topic.canonicalTopicKey.split(":").pop().replace(/-/g, " "),
      };
      return {
        topicKey: meta.topicKey,
        topicName: meta.topicName,
        attemptCount: topic.attemptCount,
        averageMastery: topic.averageMastery,
        weakRate: topic.weakRate,
        studentsWithEvidence: formatStudentsWithEvidence(topic.studentCount),
        studentSampleBand: studentSampleBand(topic.studentCount),
        confidence: topic.confidence,
        reason: "TOPIC_WEAKNESS_PREVALENCE",
      };
    })
  ).slice(0, limit);

  const contentLearningCrossSignals = sortCrossSignals(
    topics
      .filter((topic) => {
        const coverage = coverageByCanonical.get(topic.canonicalTopicKey);
        return (
          coverage &&
          coverage.coverageScore >= COVERAGE_STRONG_THRESHOLD &&
          topic.averageMastery < WEAK_THRESHOLD
        );
      })
      .map((topic) => {
        const coverage = coverageByCanonical.get(topic.canonicalTopicKey);
        const meta = canonicalMeta.get(topic.canonicalTopicKey) || {
          topicKey: topic.canonicalTopicKey,
        };
        return {
          topicKey: meta.topicKey,
          coverageScore: coverage.coverageScore,
          averageMastery: topic.averageMastery,
          attemptCount: topic.attemptCount,
          studentSampleBand: studentSampleBand(topic.studentCount),
          confidence: topic.confidence,
          signal: "HIGH_CONTENT_LOW_MASTERY",
          status: "AMBER",
          reason: "STRONG_CONTENT_COVERAGE_BUT_MASTERY_BELOW_CANONICAL_THRESHOLD",
        };
      })
  ).slice(0, limit);

  const hasSampledTopics = topicWeakness.length > 0;
  const overallStatus = contentLearningCrossSignals.length
    ? "AMBER"
    : hasSampledTopics
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
      topicsObserved: topicWeakness.length,
      suppressedTopicCount,
    },
    mastery: {
      source: "LearningEvidenceEvent",
      policy: "student-topic-evidence",
      weakThreshold: WEAK_THRESHOLD,
    },
    privacy: {
      minStudentsForTopic: MIN_STUDENTS_FOR_TOPIC,
      minAttemptsForTopic: MIN_ATTEMPTS_FOR_TOPIC,
    },
    topicWeakness,
    contentLearningCrossSignals,
    summary: {
      overallStatus,
      humanReviewRequired: overallStatus !== "GREEN",
    },
  };
}

module.exports = {
  VERSION,
  LEVEL,
  WEAK_THRESHOLD,
  COVERAGE_STRONG_THRESHOLD,
  MIN_STUDENTS_FOR_TOPIC,
  MIN_ATTEMPTS_FOR_TOPIC,
  SUFFICIENT_ATTEMPTS,
  HIGH_CONFIDENCE_STUDENTS,
  HIGH_CONFIDENCE_ATTEMPTS,
  computeMasteryFromCounts,
  hasCalculableMastery,
  isWeakMastery,
  classifyConfidence,
  studentSampleBand,
  formatStudentsWithEvidence,
  buildTopicAliasMap,
  resolveCanonicalTopicKey,
  rollupTopicMetrics,
  normalizeUserTopicRows,
  mergeUserTopicRow,
  sortTopicWeakness,
  sortCrossSignals,
  buildRevisionIntelligence,
};
