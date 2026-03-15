/**
 * PR-038: Student progress signal endpoints.
 * Student-only; lightweight fire-and-forget for activity tracking.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { upsertStudentTopicProgressSignal } = require("../services/progress/studentTopicProgressService");
const { recordFlashcardReview, recordLessonCompletion } = require("../services/learningEvidenceService");
const { updateReviewStateAfterSession } = require("../services/adaptiveRevisionService");

function isStudent(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "student";
}

/**
 * POST /api/progress/lesson-view
 * Body: { specKey, topicKey }
 * Student only. Increments lessonViews signal.
 */
router.post("/lesson-view", auth, (req, res) => {
  if (!isStudent(req)) {
    return res.status(403).json({ error: "Students only" });
  }
  const { specKey, topicKey } = req.body || {};
  if (!specKey || !topicKey) {
    return res.status(400).json({ error: "specKey and topicKey are required" });
  }
  const userId = req.user?._id || req.user?.userId || req.user?.id;
  const tk = (topicKey || "").includes(":") ? (topicKey || "").split(":").pop() : topicKey;
  upsertStudentTopicProgressSignal({ userId, specKey, topicKey, signalType: "lessonViews", value: 1 })
    .then(() => res.status(204).send())
    .catch((err) => {
      console.error("[progress] lesson-view:", err);
      res.status(500).json({ error: "Failed to record" });
    });
  if (userId && specKey && tk) {
    recordLessonCompletion({
      userId,
      specKey,
      topicKey: tk,
      lessonId: req.body?.lessonId || null,
      timeSpentSeconds: req.body?.timeSpentSeconds ?? null,
    }).catch(() => {});
  }
});

/**
 * POST /api/progress/practice-attempt
 * Body: { specKey, topicKey, correct: boolean }
 * Student only. Ready for future wiring when practice UI submits results centrally.
 */
router.post("/practice-attempt", auth, (req, res) => {
  if (!isStudent(req)) {
    return res.status(403).json({ error: "Students only" });
  }
  const { specKey, topicKey, correct } = req.body || {};
  if (!specKey || !topicKey) {
    return res.status(400).json({ error: "specKey and topicKey are required" });
  }
  const userId = req.user?._id || req.user?.userId || req.user?.id;
  Promise.all([
    upsertStudentTopicProgressSignal({ userId, specKey, topicKey, signalType: "practiceAttempts", value: 1 }),
    correct === true ? upsertStudentTopicProgressSignal({ userId, specKey, topicKey, signalType: "practiceCorrect", value: 1 }) : Promise.resolve(),
  ])
    .then(() => res.status(204).send())
    .catch((err) => {
      console.error("[progress] practice-attempt:", err);
      res.status(500).json({ error: "Failed to record" });
    });
});

/**
 * POST /api/progress/flashcard-review
 * Body: { specKey, topicKey, flashcardId?, difficultyRating? }
 * Student only. Records flashcard_review LearningEvidenceEvent.
 */
router.post("/flashcard-review", auth, (req, res) => {
  if (!isStudent(req)) {
    return res.status(403).json({ error: "Students only" });
  }
  const { specKey, topicKey, flashcardId, difficultyRating } = req.body || {};
  if (!specKey || !topicKey) {
    return res.status(400).json({ error: "specKey and topicKey are required" });
  }
  const userId = req.user?._id || req.user?.userId || req.user?.id;
  const tk = (topicKey || "").includes(":") ? (topicKey || "").split(":").pop() : topicKey;
  upsertStudentTopicProgressSignal({ userId, specKey, topicKey, signalType: "flashcardReviews", value: 1 })
    .then(() => res.status(204).send())
    .catch((err) => {
      console.error("[progress] flashcard-review:", err);
      res.status(500).json({ error: "Failed to record" });
    });
  if (userId && specKey && tk) {
    recordFlashcardReview({
      userId,
      specKey,
      topicKey: tk,
      flashcardId: flashcardId || null,
      difficultyRating:
        difficultyRating != null && difficultyRating >= 1 && difficultyRating <= 5 ? Number(difficultyRating) : null,
    }).catch(() => {});
    const wasSuccess = difficultyRating != null && difficultyRating >= 3;
    const wasHard = difficultyRating != null && difficultyRating <= 2;
    updateReviewStateAfterSession({
      userId,
      specKey,
      topicKey: req.body.topicKey || `${specKey}:${tk}`,
      wasSuccess,
      difficultyRating: difficultyRating != null && difficultyRating >= 1 && difficultyRating <= 5 ? Number(difficultyRating) : null,
      wasHard,
    }).catch(() => {});
  }
});

/**
 * POST /api/progress/lesson-completion
 * Body: { specKey, topicKey, lessonId?, timeSpentSeconds? }
 * Student only. Records lesson completion for learning evidence.
 */
router.post("/lesson-completion", auth, (req, res) => {
  if (!isStudent(req)) {
    return res.status(403).json({ error: "Students only" });
  }
  const { specKey, topicKey, lessonId, timeSpentSeconds } = req.body || {};
  if (!specKey || !topicKey) {
    return res.status(400).json({ error: "specKey and topicKey are required" });
  }
  const userId = req.user?._id || req.user?.userId || req.user?.id;
  const tk = (topicKey || "").includes(":") ? (topicKey || "").split(":").pop() : topicKey;
  if (!userId || !specKey || !tk) {
    return res.status(400).json({ error: "Invalid request" });
  }
  recordLessonCompletion({
    userId,
    specKey,
    topicKey: tk,
    lessonId: lessonId || null,
    timeSpentSeconds: timeSpentSeconds ?? null,
  })
    .then(() => res.status(204).send())
    .catch((err) => {
      console.error("[progress] lesson-completion:", err);
      res.status(500).json({ error: "Failed to record" });
    });
});

module.exports = router;
