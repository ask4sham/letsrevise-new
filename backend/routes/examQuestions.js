// backend/routes/examQuestions.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const auth = require("../middleware/auth");
const { findTopicByKey } = require("../utils/topicTaxonomy");

function isTeacher(req) {
  return req.user && req.user.userType === "teacher";
}

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

function validateTopicKey(topicKey) {
  if (!topicKey || typeof topicKey !== "string") return null;
  const k = topicKey.trim().toLowerCase();
  if (!k) return null;
  const found = findTopicByKey(k);
  return found ? k : null;
}

// POST /api/exam-questions — create draft (teacher only)
router.post("/", auth, async (req, res) => {
  if (!isTeacher(req)) {
    return res.status(403).json({ success: false, msg: "Teachers only" });
  }
  try {
    if (req.body.topicKey != null) {
      const validKey = validateTopicKey(req.body.topicKey);
      if (req.body.topicKey.trim() !== "" && !validKey) {
        return res.status(400).json({ success: false, msg: "Invalid topicKey", error: "Invalid topicKey" });
      }
      if (validKey) req.body.topicKey = validKey;
      else req.body.topicKey = undefined;
    }
    const teacherId = req.user.userId || req.user._id;
    const question = await ExamQuestion.create({
      ...req.body,
      teacherId,
      status: "draft",
    });
    return res.status(201).json({ success: true, question });
  } catch (err) {
    console.error("ExamQuestions POST error:", err);
    return res.status(400).json({ success: false, msg: err.message });
  }
});

// GET /api/exam-questions — list (teacher/admin only; filters: subject, examBoard, level, topic, topicKey, type, status)
// PR-W2.2: Teacher/admin see draft + published by default so Worksheet Builder Question Bank shows seeded drafts.
// Students are not allowed (403); if ever opened to students, enforce status: "published" only.
router.get("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ success: false, msg: "Teachers and admins only" });
  }
  try {
    const teacherId = req.user.userId || req.user._id;
    const { subject, examBoard, level, topic, topicKey, type, status, mineOnly } = req.query;
    const query = {};
    // Teacher/admin: default = both draft and published (Worksheet Builder shows all bank questions)
    if (status !== undefined && status !== "") {
      query.status = String(status).trim().toLowerCase();
    } else {
      query.status = { $in: ["draft", "published"] };
    }
    // Restrict to current teacher only when mineOnly=1 (e.g. "my questions only")
    if (String(mineOnly) === "1" || String(mineOnly) === "true") {
      query.teacherId = teacherId;
    }
    if (subject) query.subject = subject;
    if (examBoard) query.examBoard = examBoard;
    if (level) query.level = level;
    if (topic) query.topic = topic;
    if (topicKey) query.topicKey = topicKey.trim().toLowerCase();
    if (type) query.type = type;
    const questions = await ExamQuestion.find(query).sort({ updatedAt: -1 }).lean();
    return res.json({ success: true, questions });
  } catch (err) {
    console.error("ExamQuestions GET error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

// PUT /api/exam-questions/:id — update (only owner)
router.put("/:id", auth, async (req, res) => {
  if (!isTeacher(req)) {
    return res.status(403).json({ success: false, msg: "Teachers only" });
  }
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid ID" });
    }
    const teacherId = req.user.userId || req.user._id;
    const question = await ExamQuestion.findOne({ _id: id, teacherId });
    if (!question) {
      return res.status(404).json({ success: false, msg: "Question not found" });
    }
    if (req.body.topicKey != null) {
      const validKey = validateTopicKey(req.body.topicKey);
      if (req.body.topicKey && String(req.body.topicKey).trim() !== "" && !validKey) {
        return res.status(400).json({ success: false, msg: "Invalid topicKey", error: "Invalid topicKey" });
      }
      question.topicKey = validKey || undefined;
    }
    const { subject, examBoard, level, topic, unitKey, type, marks, question: qText, options, correctIndex, correctAnswer, markScheme, content, status } = req.body;
    if (subject !== undefined) question.subject = subject;
    if (examBoard !== undefined) question.examBoard = examBoard;
    if (level !== undefined) question.level = level;
    if (topic !== undefined) question.topic = topic;
    if (unitKey !== undefined) question.unitKey = unitKey || undefined;
    if (type !== undefined) question.type = type;
    if (marks !== undefined) question.marks = marks;
    if (qText !== undefined) question.question = qText;
    if (options !== undefined) question.options = options;
    if (correctIndex !== undefined) question.correctIndex = correctIndex;
    if (correctAnswer !== undefined) question.correctAnswer = correctAnswer;
    if (markScheme !== undefined) question.markScheme = markScheme;
    if (content !== undefined) question.content = content;
    if (status !== undefined) question.status = status;
    await question.save();
    return res.json({ success: true, question });
  } catch (err) {
    console.error("ExamQuestions PUT error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

// DELETE /api/exam-questions/:id — delete (only owner)
router.delete("/:id", auth, async (req, res) => {
  if (!isTeacher(req)) {
    return res.status(403).json({ success: false, msg: "Teachers only" });
  }
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, msg: "Invalid ID" });
    }
    const teacherId = req.user.userId || req.user._id;
    const question = await ExamQuestion.findOneAndDelete({ _id: id, teacherId });
    if (!question) {
      return res.status(404).json({ success: false, msg: "Question not found" });
    }
    return res.json({ success: true, question });
  } catch (err) {
    console.error("ExamQuestions DELETE error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

module.exports = router;
