/**
 * Admin Question Banks — list all bank items for moderation. Admin-only.
 * Uses existing delete routes: DELETE /api/topic-flashcards/:id, /api/topic-quiz-questions/:id, /api/exam-questions/:id
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");

const requireContentManager = require("../middleware/requireContentManager");

router.use(auth, requireContentManager);

/** GET /api/admin/question-banks/flashcards — list all topic flashcards (admin only). Optional: topicKey, status, ownerId, limit, offset */
router.get("/flashcards", async (req, res) => {
  try {
    const { topicKey, status, ownerId, limit = 50, offset = 0 } = req.query;
    const query = { isArchived: { $ne: true } };
    if (topicKey && String(topicKey).trim()) query.topicKey = { $regex: String(topicKey).trim(), $options: "i" };
    if (status && ["draft", "published"].includes(String(status).toLowerCase())) query.status = String(status).toLowerCase();
    if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) query.ownerId = new mongoose.Types.ObjectId(ownerId);

    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const off = Math.max(0, parseInt(offset, 10) || 0);

    const [items, total] = await Promise.all([
      TopicFlashcard.find(query)
        .sort({ updatedAt: -1 })
        .skip(off)
        .limit(lim)
        .populate("ownerId", "firstName lastName email")
        .lean(),
      TopicFlashcard.countDocuments(query),
    ]);

    const rows = items.map((f) => ({
      id: f._id,
      front: f.front,
      back: f.back,
      topicKey: f.topicKey,
      topic: f.topic,
      status: f.status,
      ownerId: f.ownerId?._id || f.ownerId,
      ownerName: f.ownerId ? [f.ownerId.firstName, f.ownerId.lastName].filter(Boolean).join(" ").trim() || f.ownerId.email : "—",
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));

    return res.json({ items: rows, total, limit: lim, offset: off });
  } catch (err) {
    console.error("Admin question-banks flashcards error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/** GET /api/admin/question-banks/quizzes — list all topic quiz questions (admin only). Optional: topicKey, status, kind, ownerId, limit, offset */
router.get("/quizzes", async (req, res) => {
  try {
    const { topicKey, status, kind, ownerId, limit = 50, offset = 0 } = req.query;
    const query = { isArchived: { $ne: true } };
    if (topicKey && String(topicKey).trim()) query.topicKey = { $regex: String(topicKey).trim(), $options: "i" };
    if (status && ["draft", "published"].includes(String(status).toLowerCase())) query.status = String(status).toLowerCase();
    if (kind && ["quiz", "assessment"].includes(String(kind).toLowerCase())) query.kind = String(kind).toLowerCase();
    if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) query.ownerId = new mongoose.Types.ObjectId(ownerId);

    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const off = Math.max(0, parseInt(offset, 10) || 0);

    const [items, total] = await Promise.all([
      TopicQuizQuestion.find(query)
        .sort({ updatedAt: -1 })
        .skip(off)
        .limit(lim)
        .populate("ownerId", "firstName lastName email")
        .lean(),
      TopicQuizQuestion.countDocuments(query),
    ]);

    const rows = items.map((q) => ({
      id: q._id,
      questionText: (q.questionText || "").slice(0, 120),
      topicKey: q.topicKey,
      type: q.type,
      kind: q.kind,
      status: q.status,
      ownerId: q.ownerId?._id || q.ownerId,
      ownerName: q.ownerId ? [q.ownerId.firstName, q.ownerId.lastName].filter(Boolean).join(" ").trim() || q.ownerId.email : "—",
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    }));

    return res.json({ items: rows, total, limit: lim, offset: off });
  } catch (err) {
    console.error("Admin question-banks quizzes error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/** GET /api/admin/question-banks/exam-questions — list all exam questions (admin only). Uses same filters as GET /api/exam-questions. */
router.get("/exam-questions", async (req, res) => {
  try {
    const { subject, examBoard, level, topicKey, type, status, limit = 50, offset = 0 } = req.query;
    const query = {};
    if (status && String(status).trim()) {
      query.status = String(status).trim().toLowerCase();
    } else {
      query.status = { $in: ["draft", "published"] };
    }
    if (subject) query.subject = subject;
    if (examBoard) query.examBoard = examBoard;
    if (level) query.level = level;
    if (topicKey && String(topicKey).trim()) query.topicKey = { $regex: String(topicKey).trim(), $options: "i" };
    if (type) query.type = type;

    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const off = Math.max(0, parseInt(offset, 10) || 0);

    const [questions, total] = await Promise.all([
      ExamQuestion.find(query)
        .sort({ updatedAt: -1 })
        .skip(off)
        .limit(lim)
        .populate("teacherId", "firstName lastName email")
        .lean(),
      ExamQuestion.countDocuments(query),
    ]);

    const rows = questions.map((q) => ({
      id: q._id,
      question: (q.question || "").slice(0, 120),
      subject: q.subject,
      examBoard: q.examBoard,
      level: q.level,
      topic: q.topic,
      topicKey: q.topicKey,
      type: q.type,
      status: q.status,
      marks: q.marks,
      teacherId: q.teacherId?._id || q.teacherId,
      ownerName: q.teacherId ? [q.teacherId.firstName, q.teacherId.lastName].filter(Boolean).join(" ").trim() || q.teacherId.email : "—",
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    }));

    return res.json({ items: rows, total, limit: lim, offset: off });
  } catch (err) {
    console.error("Admin question-banks exam-questions error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
