/**
 * PR-EDGE-4.2: Quiz attempt — submit (score MCQs), GET (student view with release gating).
 */
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const User = require("../models/User");
const QuizAttempt = require("../models/QuizAttempt");
const QuizAssignment = require("../models/QuizAssignment");
const Lesson = require("../models/Lesson");
const { getJwtSecret } = require("../utils/jwtSecret");

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || req.user.isAdmin || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

async function attachUserIfToken(req, res, next) {
  const authHeader = req.get("Authorization") || req.get("authorization") || "";
  const token =
    typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : req.get("x-auth-token") || null;
  if (!token) return next();
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    const userId = decoded.userId || decoded.user?.id || decoded.user?._id || decoded._id;
    if (!userId) return next();
    const user = await User.findById(userId).select("_id userType type").lean();
    if (user) req.user = { _id: user._id, userId: user._id, userType: user.userType || user.type };
  } catch { /* ignore */ }
  next();
}

async function loadAttemptAndAssignment(req, res, opts = {}) {
  const attemptId = req.params.attemptId;
  if (!mongoose.Types.ObjectId.isValid(attemptId)) {
    res.status(400).json({ error: "Invalid attempt id" });
    return null;
  }
  const query = QuizAttempt.findById(attemptId);
  if (opts.includeToken) query.select("+attemptToken");
  const attempt = await query.lean();
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return null;
  }
  const assignment = await QuizAssignment.findById(attempt.assignmentId).lean();
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return null;
  }
  return { attempt, assignment };
}

function isAssignmentOwner(assignment, req) {
  if (!assignment || !req.user) return false;
  return (assignment.ownerId?.toString() || "") === (req.user._id || req.user.userId || req.user.id || "").toString();
}

function sanitizeAttemptForStudent(attempt) {
  if (!attempt) return attempt;
  const out = { ...attempt };
  out.score = null;
  out.maxScore = null;
  out.resultsLocked = true;
  out.answers = undefined;
  return out;
}

// POST /api/quiz-attempts/:attemptId/submit — score MCQs from lesson.quiz/assessment.questions (lesson-based only)
router.post("/:attemptId/submit", async (req, res) => {
  try {
    const loaded = await loadAttemptAndAssignment(req, res, { includeToken: true });
    if (!loaded) return;
    const { attempt, assignment } = loaded;
    if (attempt.attemptToken) {
      const token = (req.body?.token || "").trim();
      if (!token || token !== attempt.attemptToken) {
        return res.status(403).json({ error: "Invalid or missing token" });
      }
    }
    if (attempt.status !== "IN_PROGRESS") {
      return res.status(400).json({ error: "Attempt already submitted" });
    }
    if (!assignment.isActive) return res.status(403).json({ error: "Assignment is closed" });
    if (assignment.dueAt && new Date(assignment.dueAt) < new Date()) {
      return res.status(403).json({ error: "Assignment is closed" });
    }
    if (!assignment.lessonId) {
      return res.status(400).json({ error: "Submit only supported for lesson-based quizzes; paper-based use assessment flow" });
    }
    const lesson = await Lesson.findById(assignment.lessonId).lean();
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });
    const qSet = assignment.kind === "assessment" ? (lesson.assessment?.questions || []) : (lesson.quiz?.questions || []);
    if (qSet.length === 0) return res.status(400).json({ error: "No questions in quiz" });

    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const answerMap = new Map(answers.map((a) => [String(a.questionId), a]));

    let score = 0;
    let maxScore = 0;
    const normalizedAnswers = [];

    for (const q of qSet) {
      const qid = String(q.id || q._id || "");
      const marks = typeof q.marks === "number" && q.marks > 0 ? q.marks : 1;
      const ans = answerMap.get(qid);
      const selectedIndex = ans && typeof ans.selectedIndex === "number" ? ans.selectedIndex : null;
      normalizedAnswers.push({ questionId: qid, selectedIndex });

      if (q.type === "mcq" && Array.isArray(q.options) && q.options.length > 0) {
        maxScore += marks;
        const correctAnswer = (q.correctAnswer || "").trim().toLowerCase();
        const selectedText =
          selectedIndex != null && selectedIndex >= 0 && q.options[selectedIndex] != null
            ? String(q.options[selectedIndex]).trim().toLowerCase()
            : "";
        if (selectedText && correctAnswer && selectedText === correctAnswer) {
          score += marks;
        }
      }
    }

    await QuizAttempt.updateOne(
      { _id: attempt._id },
      {
        $set: {
          answers: normalizedAnswers,
          score,
          maxScore,
          status: "SUBMITTED",
          submittedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
    const updated = await QuizAttempt.findById(attempt._id).lean();
    const payload = { ...updated, score: updated.score, maxScore: updated.maxScore, status: "SUBMITTED" };
    if (!updated.isReleased) {
      return res.json({ ok: true, attempt: sanitizeAttemptForStudent(payload) });
    }
    return res.json({ ok: true, attempt: payload });
  } catch (err) {
    console.error("Quiz attempt submit error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/quiz-attempts/:attemptId — student owner or teacher owner; release gating for score
router.get("/:attemptId", attachUserIfToken, async (req, res) => {
  try {
    const loaded = await loadAttemptAndAssignment(req, res);
    if (!loaded) return;
    const { attempt, assignment } = loaded;
    const uid = req.user ? (req.user._id || req.user.userId || req.user.id || "").toString() : "";
    const isStudentOwner = attempt.studentId && attempt.studentId.toString() === uid;
    const isTeacherOwner = isAssignmentOwner(assignment, req);
    const isAdmin = req.user && (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin";
    if (!isStudentOwner && !isTeacherOwner && !isAdmin) {
      return res.status(404).json({ error: "Attempt not found" });
    }
    const canSeeFull = isTeacherOwner || isAdmin;
    if (!canSeeFull && (attempt.status === "SUBMITTED" || attempt.status === "MARKED") && !attempt.isReleased) {
      return res.json({ attempt: sanitizeAttemptForStudent(attempt) });
    }
    return res.json({ attempt });
  } catch (err) {
    console.error("Quiz attempt GET error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
