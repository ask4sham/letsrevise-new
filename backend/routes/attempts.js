/**
 * PR12: Record student practice/checkpoint attempts.
 * PR12.3: confidence 1-3, duplicate guard.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const PracticeAttempt = require("../models/PracticeAttempt");

const MAX_SELECTED = 120;
const MAX_ANSWER_TEXT = 500;
const DEDUPE_WINDOW_PRACTICE_MS = 10 * 1000;
const DEDUPE_WINDOW_CHECKPOINT_MS = 5 * 1000;

/**
 * POST /api/attempts
 * Body: { lessonId, source, questionType, questionId?, selected?, answerText?, isCorrect, confidence? }
 */
router.post("/", auth, async (req, res) => {
  try {
    const { lessonId, source, questionType, questionId, selected, answerText, isCorrect, confidence } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lessonId" });
    }
    if (!["checkpoint", "practice"].includes(String(source))) {
      return res.status(400).json({ error: "Invalid source" });
    }
    if (!["mcq", "short"].includes(String(questionType))) {
      return res.status(400).json({ error: "Invalid questionType" });
    }
    if (typeof isCorrect !== "boolean") {
      return res.status(400).json({ error: "isCorrect must be boolean" });
    }
    if (source === "practice" && !mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({ error: "practice source requires questionId" });
    }
    let confidenceFinal = 2;
    if (confidence !== undefined && confidence !== null) {
      const n = typeof confidence === "string" ? parseInt(confidence, 10) : Number(confidence);
      if (n !== 1 && n !== 2 && n !== 3) {
        return res.status(400).json({ error: "confidence must be 1, 2, or 3" });
      }
      confidenceFinal = n;
    }

    const selectedStr = typeof selected === "string" ? selected.slice(0, MAX_SELECTED) : "";
    const answerTextStr = typeof answerText === "string" ? answerText.slice(0, MAX_ANSWER_TEXT) : "";

    const userId = req.user._id;
    const lessonOid = new mongoose.Types.ObjectId(lessonId);
    const questionOid = source === "practice" && questionId ? new mongoose.Types.ObjectId(questionId) : null;

    if (source === "practice" && questionOid) {
      const since = new Date(Date.now() - DEDUPE_WINDOW_PRACTICE_MS);
      const dup = await PracticeAttempt.findOne({
        userId,
        lessonId: lessonOid,
        questionId: questionOid,
        createdAt: { $gte: since },
      }).lean();
      if (dup) return res.json({ ok: true, duplicate: true });
    } else {
      const since = new Date(Date.now() - DEDUPE_WINDOW_CHECKPOINT_MS);
      const dup = await PracticeAttempt.findOne({
        userId,
        lessonId: lessonOid,
        source: "checkpoint",
        questionType,
        createdAt: { $gte: since },
      }).lean();
      if (dup) return res.json({ ok: true, duplicate: true });
    }

    await PracticeAttempt.create({
      userId,
      lessonId: lessonOid,
      source,
      questionType,
      questionId: questionOid || undefined,
      selected: selectedStr,
      answerText: answerTextStr,
      isCorrect,
      confidence: confidenceFinal,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /attempts error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
