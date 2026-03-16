/**
 * Learning Evidence Service — records student performance events.
 * Lightweight, non-blocking. Links events to specKey/topicKey.
 */
const LearningEvidenceEvent = require("../models/LearningEvidenceEvent");
const mongoose = require("mongoose");

/**
 * Record a quiz attempt.
 */
async function recordQuizAttempt({
  userId,
  specKey,
  topicKey,
  lessonId,
  quizId,
  correct,
  score,
  timeSpentSeconds,
}) {
  if (!userId || !specKey || !topicKey) return { success: false, error: "userId, specKey, topicKey required" };
  try {
    await LearningEvidenceEvent.create({
      eventType: "quiz_attempt",
      userId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId,
      specKey: String(specKey).trim(),
      topicKey: String(topicKey).trim(),
      lessonId: lessonId && mongoose.Types.ObjectId.isValid(lessonId) ? new mongoose.Types.ObjectId(lessonId) : null,
      contentType: "quiz",
      contentId: quizId && mongoose.Types.ObjectId.isValid(quizId) ? new mongoose.Types.ObjectId(quizId) : null,
      correct: correct !== undefined && correct !== null ? !!correct : null,
      score: score !== undefined && score !== null ? Number(score) : null,
      timeSpentSeconds: timeSpentSeconds !== undefined && timeSpentSeconds !== null ? Number(timeSpentSeconds) : null,
    });
    return { success: true };
  } catch (e) {
    console.error("[learningEvidence] recordQuizAttempt", e?.message || e);
    return { success: false, error: e?.message || "Failed to record" };
  }
}

/**
 * Record a flashcard review.
 */
async function recordFlashcardReview({ userId, specKey, topicKey, flashcardId, difficultyRating }) {
  if (!userId || !specKey || !topicKey) return { success: false, error: "userId, specKey, topicKey required" };
  try {
    await LearningEvidenceEvent.create({
      eventType: "flashcard_review",
      userId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId,
      specKey: String(specKey).trim(),
      topicKey: String(topicKey).trim(),
      contentType: "flashcard",
      contentId: flashcardId && mongoose.Types.ObjectId.isValid(flashcardId) ? new mongoose.Types.ObjectId(flashcardId) : null,
      difficultyRating:
        difficultyRating !== undefined && difficultyRating !== null && difficultyRating >= 1 && difficultyRating <= 5
          ? Number(difficultyRating)
          : null,
    });
    return { success: true };
  } catch (e) {
    console.error("[learningEvidence] recordFlashcardReview", e?.message || e);
    return { success: false, error: e?.message || "Failed to record" };
  }
}

/**
 * Record an exam question attempt.
 */
async function recordExamQuestionAttempt({
  userId,
  specKey,
  topicKey,
  questionId,
  correct,
  timeSpentSeconds,
}) {
  if (!userId || !specKey || !topicKey) return { success: false, error: "userId, specKey, topicKey required" };
  try {
    await LearningEvidenceEvent.create({
      eventType: "exam_question_attempt",
      userId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId,
      specKey: String(specKey).trim(),
      topicKey: String(topicKey).trim(),
      contentType: "examQuestion",
      contentId: questionId && mongoose.Types.ObjectId.isValid(questionId) ? new mongoose.Types.ObjectId(questionId) : null,
      correct: correct !== undefined && correct !== null ? !!correct : null,
      timeSpentSeconds: timeSpentSeconds !== undefined && timeSpentSeconds !== null ? Number(timeSpentSeconds) : null,
    });
    return { success: true };
  } catch (e) {
    console.error("[learningEvidence] recordExamQuestionAttempt", e?.message || e);
    return { success: false, error: e?.message || "Failed to record" };
  }
}

/**
 * Record a lesson completion.
 */
async function recordLessonCompletion({ userId, specKey, topicKey, lessonId, timeSpentSeconds }) {
  if (!userId || !specKey || !topicKey) return { success: false, error: "userId, specKey, topicKey required" };
  try {
    await LearningEvidenceEvent.create({
      eventType: "lesson_completion",
      userId: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId,
      specKey: String(specKey).trim(),
      topicKey: String(topicKey).trim(),
      lessonId: lessonId && mongoose.Types.ObjectId.isValid(lessonId) ? new mongoose.Types.ObjectId(lessonId) : null,
      timeSpentSeconds: timeSpentSeconds !== undefined && timeSpentSeconds !== null ? Number(timeSpentSeconds) : null,
    });
    return { success: true };
  } catch (e) {
    console.error("[learningEvidence] recordLessonCompletion", e?.message || e);
    return { success: false, error: e?.message || "Failed to record" };
  }
}

module.exports = {
  recordQuizAttempt,
  recordFlashcardReview,
  recordExamQuestionAttempt,
  recordLessonCompletion,
};
