/**
 * Student Topic Evidence Service — aggregates learning evidence per topic.
 * Uses LearningEvidenceEvent. Null-safe, deterministic.
 */
const mongoose = require("mongoose");
const LearningEvidenceEvent = require("../models/LearningEvidenceEvent");
const contentCoverageService = require("./contentCoverageService");
const adminTaxonomyService = require("./adminTaxonomyService");
const { queryCandidates } = require("../utils/topicKey");

function classifyDifficultyLevel(accuracy) {
  if (accuracy === null || accuracy === undefined) return "unknown";
  const a = Number(accuracy);
  if (isNaN(a)) return "unknown";
  if (a < 50) return "very_difficult";
  if (a < 65) return "difficult";
  if (a < 80) return "moderate";
  return "well_understood";
}

/**
 * Build topic learning evidence from events.
 * @param {object[]} events - LearningEvidenceEvent documents
 * @param {string} specKey
 * @param {string} topicKey
 * @param {string} topicFull
 */
function buildEvidenceFromEvents(events, specKey, topicKey, topicFull) {
  const quizEvents = events.filter((e) => e.eventType === "quiz_attempt");
  const flashcardEvents = events.filter((e) => e.eventType === "flashcard_review");
  const examEvents = events.filter((e) => e.eventType === "exam_question_attempt");
  const lessonEvents = events.filter((e) => e.eventType === "lesson_completion");

  const quizAttempts = quizEvents.length;
  const quizCorrect = quizEvents.filter((e) => e.correct === true).length;
  const quizAccuracy =
    quizAttempts > 0 ? Math.round((quizCorrect / quizAttempts) * 100) : null;

  const examAttempts = examEvents.length;
  const examCorrect = examEvents.filter((e) => e.correct === true).length;
  const examAccuracy =
    examAttempts > 0 ? Math.round((examCorrect / examAttempts) * 100) : null;

  const flashcardReviews = flashcardEvents.length;
  const difficultyRatings = flashcardEvents
    .map((e) => e.difficultyRating)
    .filter((r) => r != null && r >= 1 && r <= 5);
  const averageDifficulty =
    difficultyRatings.length > 0
      ? Math.round(
          (difficultyRatings.reduce((s, r) => s + r, 0) / difficultyRatings.length) * 10
        ) / 10
      : null;

  const lessonCompletions = lessonEvents.length;
  const timeSpentValues = lessonEvents
    .map((e) => e.timeSpentSeconds)
    .filter((t) => t != null && t >= 0);
  const averageTimeSpent =
    timeSpentValues.length > 0
      ? Math.round(
          timeSpentValues.reduce((s, t) => s + t, 0) / timeSpentValues.length
        )
      : null;

  const masteryScore =
    quizAccuracy !== null && examAccuracy !== null
      ? Math.round((quizAccuracy + examAccuracy) / 2)
      : quizAccuracy !== null
      ? quizAccuracy
      : examAccuracy !== null
      ? examAccuracy
      : null;

  const difficultyLevel = classifyDifficultyLevel(masteryScore);

  return {
    specKey: specKey || "",
    topicKey: topicFull,
    quizStats: {
      attempts: quizAttempts,
      correct: quizCorrect,
      accuracy: quizAccuracy,
    },
    flashcardStats: {
      reviews: flashcardReviews,
      averageDifficulty,
    },
    examStats: {
      attempts: examAttempts,
      correct: examCorrect,
      accuracy: examAccuracy,
    },
    lessonStats: {
      completions: lessonCompletions,
      averageTimeSpent,
    },
    derivedMetrics: {
      masteryScore,
      difficultyLevel,
    },
  };
}

/**
 * Get topic learning evidence for a single topic.
 * @param {string} specKey
 * @param {string} topicKey
 * @param {string|import("mongoose").Types.ObjectId} [userId] - If provided, filter by user (per-student). Omit for aggregate.
 */
async function getTopicLearningEvidence(specKey, topicKey, userId) {
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  const topicFull = (topicKey || "").includes(":") ? topicKey : `${specKey}:${(topicOnly || "").trim()}`;
  const candidates = queryCandidates(specKey, topicOnly);

  const query = {
    specKey: specKey || "",
    topicKey: { $in: candidates },
  };
  if (userId) {
    query.userId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  }

  const events = await LearningEvidenceEvent.find(query).lean();

  return buildEvidenceFromEvents(events, specKey, topicKey, topicFull);
}

/**
 * Get learning evidence for all topics in a spec.
 * @param {string} specKey
 * @param {string|import("mongoose").Types.ObjectId} [userId] - If provided, filter by user (per-student).
 */
async function getSpecLearningEvidence(specKey, userId) {
  const specCoverage = await contentCoverageService.getSpecCoverage(specKey);
  if (!specCoverage || !specCoverage.topics) {
    return { specKey: specKey || "", topics: [] };
  }

  const topics = await Promise.all(
    specCoverage.topics.map((t) => {
      const tk = t.topicKey || "";
      const sk = t.specKey || specKey;
      return getTopicLearningEvidence(sk, tk, userId);
    })
  );

  return {
    specKey: specKey || "",
    topics,
  };
}

/**
 * Get recent activity for a student from LearningEvidenceEvent.
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @param {number} [limit=10]
 * @returns {Promise<Array<{ eventType: string, topicKey: string, specKey: string, createdAt: string }>>}
 */
async function getStudentRecentActivity(userId, limit = 10) {
  if (!userId) return [];
  const oid = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  const events = await LearningEvidenceEvent.find({ userId: oid })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("eventType topicKey specKey createdAt")
    .lean();
  return events.map((e) => ({
    eventType: e.eventType,
    topicKey: e.topicKey,
    specKey: e.specKey,
    createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : null,
  }));
}

module.exports = {
  getTopicLearningEvidence,
  getSpecLearningEvidence,
  getStudentRecentActivity,
  classifyDifficultyLevel,
};
