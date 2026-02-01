// backend/routes/examQuestions.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const auth = require("../middleware/auth");

function isTeacher(req) {
  return req.user && req.user.userType === "teacher";
}

// POST /api/exam-questions — create draft (teacher only)
router.post("/", auth, async (req, res) => {
  if (!isTeacher(req)) {
    return res.status(403).json({ success: false, msg: "Teachers only" });
  }
  try {
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

// GET /api/exam-questions — list (teacher only; filters: subject, examBoard, level, topic, type, status; default status=draft)
router.get("/", auth, async (req, res) => {
  if (!isTeacher(req)) {
    return res.status(403).json({ success: false, msg: "Teachers only" });
  }
  try {
    const teacherId = req.user.userId || req.user._id;
    const { subject, examBoard, level, topic, type, status } = req.query;
    const query = { teacherId };
    if (subject) query.subject = subject;
    if (examBoard) query.examBoard = examBoard;
    if (level) query.level = level;
    if (topic) query.topic = topic;
    if (type) query.type = type;
    if (status) query.status = status;
    else query.status = "draft";
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
    const { subject, examBoard, level, topic, type, marks, question: qText, options, correctAnswer, markScheme, content, status } = req.body;
    if (subject !== undefined) question.subject = subject;
    if (examBoard !== undefined) question.examBoard = examBoard;
    if (level !== undefined) question.level = level;
    if (topic !== undefined) question.topic = topic;
    if (type !== undefined) question.type = type;
    if (marks !== undefined) question.marks = marks;
    if (qText !== undefined) question.question = qText;
    if (options !== undefined) question.options = options;
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
