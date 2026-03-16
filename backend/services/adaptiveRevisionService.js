/**
 * Adaptive Revision Service — spaced repetition + difficulty adaptation.
 * Consumes canonical mastery (studentTopicEvidenceService) and adds adaptation logic.
 * Does NOT replace canonical mastery.
 */
const mongoose = require("mongoose");
const StudentTopicReviewState = require("../models/StudentTopicReviewState");
const contentCoverageService = require("./contentCoverageService");
const { queryCandidates } = require("../utils/topicKey");

// Priority formula weights (keep in service, not components)
const WEIGHTS = {
  masteryGap: 0.35,
  overdueDays: 0.2,
  difficulty: 0.2,
  daysSinceLastReview: 0.15,
  examReadiness: 0.1,
};

// Interval schedule: successCount -> next interval days
const INTERVAL_SCHEDULE = [1, 3, 7, 14, 30];

/**
 * Get next interval days from success count.
 * Hard/poor performance resets to 1–2 days.
 */
function getNextInterval(successCount, wasHard) {
  if (wasHard) return successCount <= 1 ? 1 : 2;
  const idx = Math.min(successCount, INTERVAL_SCHEDULE.length - 1);
  return INTERVAL_SCHEDULE[idx];
}

/**
 * Classify adaptive difficulty from evidence.
 * easy | moderate | hard | very_hard
 */
function classifyAdaptiveDifficulty(evidence) {
  const mastery = evidence?.derivedMetrics?.masteryScore ?? null;
  const quizAcc = evidence?.quizStats?.accuracy ?? null;
  const examAcc = evidence?.examStats?.accuracy ?? null;
  const avgDiff = evidence?.flashcardStats?.averageDifficulty ?? null;

  const acc = quizAcc ?? examAcc ?? mastery;
  if (acc !== null && acc < 40) return "very_hard";
  if (acc !== null && acc < 60) return "hard";
  if (avgDiff != null && avgDiff >= 4) return "hard";
  if (avgDiff != null && avgDiff <= 2) return "easy";
  if (acc !== null && acc >= 85) return "easy";
  return "moderate";
}

/**
 * Compute difficulty score (0–100) for priority.
 */
function computeDifficultyScore(evidence, adaptiveDifficulty) {
  const d = adaptiveDifficulty || classifyAdaptiveDifficulty(evidence);
  if (d === "very_hard") return 100;
  if (d === "hard") return 70;
  if (d === "moderate") return 40;
  return 10;
}

/**
 * Compute overdue days score (0–100).
 */
function computeOverdueDaysScore(nextReviewAt) {
  if (!nextReviewAt) return 50;
  const now = new Date();
  const next = new Date(nextReviewAt);
  const daysOverdue = (now - next) / (24 * 60 * 60 * 1000);
  if (daysOverdue <= 0) return 0;
  return Math.min(100, Math.round(daysOverdue * 10));
}

/**
 * Compute days since last review score (0–100).
 */
function computeDaysSinceLastReviewScore(lastReviewedAt) {
  if (!lastReviewedAt) return 80;
  const now = new Date();
  const last = new Date(lastReviewedAt);
  const days = (now - last) / (24 * 60 * 60 * 1000);
  return Math.min(100, Math.round(days * 5));
}

/**
 * Compute exam readiness score (0–100).
 * Topics in 70–90 mastery range get higher score for exam practice.
 */
function computeExamReadinessScore(masteryScore) {
  if (masteryScore == null) return 0;
  if (masteryScore >= 70 && masteryScore < 90) return 80;
  if (masteryScore >= 60 && masteryScore < 70) return 50;
  if (masteryScore >= 50 && masteryScore < 60) return 30;
  return 0;
}

/**
 * Build revision reason string.
 */
function buildRevisionReason(opts) {
  const { isOverdue, isDueToday, adaptiveDifficulty, masteryScore, daysSinceReview } = opts;
  if (isOverdue) return "Overdue review";
  if (isDueToday) return "Due today";
  if (adaptiveDifficulty === "very_hard" || adaptiveDifficulty === "hard") {
    return masteryScore != null && masteryScore < 50
      ? "Low mastery and recent difficulty"
      : "Recently struggled";
  }
  if (masteryScore != null && masteryScore >= 70 && masteryScore < 85) return "Ready for exam practice";
  if (daysSinceReview != null && daysSinceReview > 7) return "Needs refresh";
  return "Consider revising this topic";
}

/**
 * Get recommended action from mastery (aligned with topicRevisionAction).
 */
function getRecommendedAction(masteryScore) {
  if (masteryScore == null || masteryScore < 40) return "flashcards";
  if (masteryScore < 70) return "quiz";
  if (masteryScore < 85) return "exam";
  return "review";
}

/**
 * Get adaptive revision data for a student.
 * @param {string|ObjectId} userId
 * @param {string} specKey
 * @param {object} specEvidence - from studentTopicEvidenceService.getSpecLearningEvidence
 * @returns {Promise<{ dueToday, overdueTopics, adaptiveRecommendations }>}
 */
async function getAdaptiveRevisionData(userId, specKey, specEvidence) {
  const topics = specEvidence?.topics || [];
  if (topics.length === 0) {
    return { dueToday: [], overdueTopics: [], adaptiveRecommendations: [] };
  }

  const topicKeys = topics.map((t) => t.topicKey).filter(Boolean);
  const reviewStates = await StudentTopicReviewState.find({
    userId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId,
    specKey: specKey || "",
    topicKey: { $in: topicKeys },
  }).lean();

  const stateMap = new Map(reviewStates.map((s) => [String(s.topicKey).trim(), s]));

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const dueToday = [];
  const overdueTopics = [];
  const adaptiveRecommendations = [];

  for (const topic of topics) {
    const tk = topic.topicKey || "";
    const state = stateMap.get(tk) || null;
    const masteryScore = topic.derivedMetrics?.masteryScore ?? null;
    const nextReviewAt = state?.nextReviewAt ? new Date(state.nextReviewAt) : null;
    const lastReviewedAt = state?.lastReviewedAt ? new Date(state.lastReviewedAt) : null;

    const isOverdue = nextReviewAt && nextReviewAt < todayStart;
    const isDueToday = nextReviewAt && nextReviewAt >= todayStart && nextReviewAt < todayEnd;
    const daysSinceReview = lastReviewedAt
      ? Math.floor((now - lastReviewedAt) / (24 * 60 * 60 * 1000))
      : null;

    const adaptiveDifficulty = classifyAdaptiveDifficulty(topic);
    const priorityScore =
      (100 - (masteryScore ?? 50)) * WEIGHTS.masteryGap +
      computeOverdueDaysScore(nextReviewAt) * WEIGHTS.overdueDays +
      computeDifficultyScore(topic, adaptiveDifficulty) * WEIGHTS.difficulty +
      computeDaysSinceLastReviewScore(lastReviewedAt) * WEIGHTS.daysSinceLastReview +
      computeExamReadinessScore(masteryScore) * WEIGHTS.examReadiness;

    const reason = buildRevisionReason({
      isOverdue,
      isDueToday,
      adaptiveDifficulty,
      masteryScore,
      daysSinceReview,
    });
    const recommendedAction = getRecommendedAction(masteryScore);

    const item = {
      topicKey: tk,
      topicName: (tk || "").split(":").pop()?.replace(/-/g, " ") || tk,
      masteryScore,
      priorityScore: Math.round(priorityScore * 10) / 10,
      reason,
      recommendedAction,
      adaptiveDifficulty,
      nextReviewAt: nextReviewAt ? nextReviewAt.toISOString() : null,
      lastReviewedAt: lastReviewedAt ? lastReviewedAt.toISOString() : null,
    };

    if (isOverdue) overdueTopics.push(item);
    if (isDueToday) dueToday.push(item);
    adaptiveRecommendations.push(item);
  }

  adaptiveRecommendations.sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
  return {
    dueToday,
    overdueTopics,
    adaptiveRecommendations: adaptiveRecommendations.slice(0, 10),
  };
}

/**
 * Update review state after a practice session.
 * Call after evidence is recorded (flashcard, quiz, exam).
 * @param {object} opts
 * @param {string|ObjectId} opts.userId
 * @param {string} opts.specKey
 * @param {string} opts.topicKey - namespaced or slug
 * @param {boolean} opts.wasSuccess - overall success
 * @param {number} [opts.difficultyRating] - 1-5 for flashcard
 * @param {boolean} [opts.wasHard] - true if poor performance
 */
async function updateReviewStateAfterSession(opts) {
  const { userId, specKey, topicKey, wasSuccess, difficultyRating, wasHard } = opts;
  if (!userId || !specKey || !topicKey) return;

  const topicOnly = (topicKey || "").includes(":") ? (topicKey || "").split(":").pop() : topicKey;
  const topicFull = (topicKey || "").includes(":") ? topicKey : `${specKey}:${topicOnly}`;

  const candidates = queryCandidates(specKey, topicOnly);
  const state = await StudentTopicReviewState.findOne({
    userId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId,
    specKey: specKey || "",
    topicKey: candidates.length ? { $in: candidates } : topicFull,
  }).lean();

  const now = new Date();
  const successCount = state ? (state.successCount || 0) + (wasSuccess ? 1 : 0) : wasSuccess ? 1 : 0;
  const hard = wasHard || (difficultyRating != null && difficultyRating <= 2);
  const intervalDays = getNextInterval(successCount, hard);
  const nextReviewAt = new Date(now);
  nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);

  const filter = {
    userId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId,
    specKey: specKey || "",
    topicKey: state?.topicKey ?? topicFull,
  };
  await StudentTopicReviewState.findOneAndUpdate(
    filter,
    {
      $set: {
        lastReviewedAt: now,
        nextReviewAt,
        intervalDays,
        lastDifficultyRating: difficultyRating ?? null,
        successCount: hard ? 0 : successCount,
        updatedAt: now,
      },
    },
    { upsert: true }
  );
}

module.exports = {
  getAdaptiveRevisionData,
  updateReviewStateAfterSession,
  classifyAdaptiveDifficulty,
  buildRevisionReason,
  getRecommendedAction,
  WEIGHTS,
};
