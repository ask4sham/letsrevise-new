/**
 * PR-EDGE-4.1/4.2: Quiz/Assessment assignment share — public by shareId.
 * GET /api/quiz-assignments/share/:shareId — assignment metadata for /q/:shareId
 * POST /api/quiz-assignments/share/:shareId/attempts — create QuizAttempt (PR-EDGE-4.2)
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const crypto = require("crypto");
const QuizAssignment = require("../models/QuizAssignment");
const QuizAttempt = require("../models/QuizAttempt");
const Lesson = require("../models/Lesson");
const AssessmentPaper = require("../models/AssessmentPaper");

// GET /api/quiz-assignments/share/:shareId — public, no auth
router.get("/share/:shareId", async (req, res) => {
  try {
    const shareId = (req.params.shareId || "").trim();
    if (!shareId) return res.status(400).json({ error: "Missing shareId" });
    const assignment = await QuizAssignment.findOne({ shareId }).lean();
    if (!assignment) return res.status(404).json({ error: "Quiz assignment not found" });
    if (!assignment.isActive) {
      return res.json({
        assignment: {
          _id: assignment._id,
          shareId: assignment.shareId,
          kind: assignment.kind,
          title: assignment.title,
          isActive: false,
          dueAt: assignment.dueAt,
        },
        closed: true,
      });
    }
    const duePassed = assignment.dueAt && new Date(assignment.dueAt) < new Date();
    let lesson = null;
    let paper = null;
    if (assignment.lessonId) {
      lesson = await Lesson.findById(assignment.lessonId).select("_id title").lean();
    }
    if (assignment.paperId) {
      paper = await AssessmentPaper.findById(assignment.paperId).select("_id title").lean();
    }
    return res.json({
      assignment: {
        _id: assignment._id,
        shareId: assignment.shareId,
        kind: assignment.kind,
        title: assignment.title || (lesson?.title || paper?.title) || (assignment.kind === "quiz" ? "Quiz" : "Assessment"),
        isActive: assignment.isActive,
        dueAt: assignment.dueAt,
        lessonId: assignment.lessonId,
        paperId: assignment.paperId,
      },
      lesson: lesson ? { _id: lesson._id, title: lesson.title } : null,
      paper: paper ? { _id: paper._id, title: paper.title } : null,
      closed: duePassed,
    });
  } catch (err) {
    console.error("Quiz assignment share error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/quiz-assignments/share/:shareId/attempts — create attempt (public; optional studentId/studentName)
router.post("/share/:shareId/attempts", async (req, res) => {
  try {
    const shareId = (req.params.shareId || "").trim();
    if (!shareId) return res.status(400).json({ error: "Missing shareId" });
    const assignment = await QuizAssignment.findOne({ shareId }).lean();
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (!assignment.isActive) return res.status(403).json({ error: "Assignment is closed" });
    if (assignment.dueAt && new Date(assignment.dueAt) < new Date()) {
      return res.status(403).json({ error: "Assignment is closed" });
    }
    const studentId = req.body?.studentId && mongoose.Types.ObjectId.isValid(req.body.studentId)
      ? new mongoose.Types.ObjectId(req.body.studentId)
      : null;
    const studentName = (req.body?.studentName != null) ? String(req.body.studentName).trim() : "";
    const attemptToken = crypto.randomBytes(24).toString("hex");
    const attempt = await QuizAttempt.create({
      assignmentId: assignment._id,
      studentId,
      studentName,
      status: "IN_PROGRESS",
      score: 0,
      maxScore: 0,
      attemptToken,
    });
    return res.status(201).json({ attemptId: attempt._id.toString(), attemptToken });
  } catch (err) {
    console.error("Quiz create attempt error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
