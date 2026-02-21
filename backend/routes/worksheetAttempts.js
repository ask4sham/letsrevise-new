// backend/routes/worksheetAttempts.js — PR-W4: get attempt, save answers, submit (MCQ scoring)
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const Worksheet = require("../models/Worksheet");
const WorksheetAssignment = require("../models/WorksheetAssignment");
const WorksheetAttempt = require("../models/WorksheetAttempt");
const ExamQuestion = require("../models/ExamQuestion");
const { getJwtSecret } = require("../utils/jwtSecret");

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || req.user.isAdmin || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

/** Optionally attach req.user from JWT (no 401). */
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
    if (user) {
      req.user = {
        _id: user._id,
        userId: user._id,
        userType: user.userType || user.type,
        type: user.userType || user.type,
      };
    }
  } catch {
    // ignore
  }
  next();
}

async function loadAttemptAndAssignment(req, res) {
  const attemptId = req.params.attemptId;
  if (!mongoose.Types.ObjectId.isValid(attemptId)) {
    res.status(400).json({ error: "Invalid attempt id" });
    return null;
  }
  const attempt = await WorksheetAttempt.findById(attemptId).lean();
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return null;
  }
  const assignment = await WorksheetAssignment.findById(attempt.assignmentId).lean();
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return null;
  }
  return { attempt, assignment };
}

function canAccessAttempt(attempt, assignment, req) {
  if (!attempt.studentId) return true;
  if (!req.user) return false;
  const userId = (req.user._id || req.user.userId || req.user.id || "").toString();
  if (attempt.studentId.toString() === userId) return true;
  if (isTeacherOrAdmin(req) && assignment.ownerId.toString() === userId) return true;
  return false;
}

function isAssignmentOwner(assignment, req) {
  if (!assignment || !req.user) return false;
  const userId = (req.user._id || req.user.userId || req.user.id || "").toString();
  return assignment.ownerId.toString() === userId;
}

/** For student/anonymous view: hide score and teacher marking until released. PR-W7 */
function sanitizeAttemptForStudent(attempt) {
  if (!attempt) return attempt;
  const out = { ...attempt };
  out.score = null;
  out.maxScore = null;
  out.resultsLocked = true;
  out.answers = (attempt.answers || []).map((a) => ({
    examQuestionId: a.examQuestionId,
    answerIndex: a.answerIndex,
    shortText: a.shortText,
    awardedMarks: undefined,
    teacherFeedback: undefined,
    markedAt: undefined,
  }));
  return out;
}

// GET /api/worksheet-attempts/:attemptId/teacher — teacher/admin only, owner of assignment; returns attempt + questions
router.get("/:attemptId/teacher", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const loaded = await loadAttemptAndAssignment(req, res);
    if (!loaded) return;
    const { attempt, assignment } = loaded;
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!isAssignmentOwner(assignment, req) && !isAdmin) return res.status(404).json({ error: "Attempt not found" });
    const worksheet = await Worksheet.findById(attempt.worksheetId).lean();
    if (!worksheet) return res.status(404).json({ error: "Worksheet not found" });
    const questionIds = (worksheet.questionItems || []).map((it) => it.examQuestionId);
    const examQuestions = await ExamQuestion.find({ _id: { $in: questionIds } })
      .select("_id type question options marks correctIndex")
      .lean();
    const qMap = new Map(examQuestions.map((q) => [q._id.toString(), q]));
    const questions = (worksheet.questionItems || []).map((it) => {
      const eq = qMap.get(it.examQuestionId.toString());
      const marks = typeof it.marksOverride === "number" ? it.marksOverride : (eq && eq.marks) || 1;
      if (!eq) return { _id: it.examQuestionId, type: "short", question: "?", marks };
      return {
        _id: eq._id,
        type: eq.type || "short",
        question: eq.question,
        options: eq.options || [],
        marks,
        correctIndex: eq.correctIndex,
      };
    });
    const worksheetPayload = {
      _id: worksheet._id,
      title: worksheet.title || "",
      questionItems: worksheet.questionItems || [],
    };
    return res.json({ attempt, worksheet: worksheetPayload, questions });
  } catch (err) {
    console.error("WorksheetAttempts GET teacher error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/worksheet-attempts/:attemptId — allow anonymous OR student owner OR teacher owner. PR-W7: student sees locked results until released.
router.get("/:attemptId", attachUserIfToken, async (req, res) => {
  try {
    const loaded = await loadAttemptAndAssignment(req, res);
    if (!loaded) return;
    const { attempt, assignment } = loaded;
    if (!canAccessAttempt(attempt, assignment, req)) {
      return res.status(403).json({ error: "You cannot access this attempt" });
    }
    const isTeacherView = req.user && isTeacherOrAdmin(req) && isAssignmentOwner(assignment, req);
    const isAdmin = req.user && ((req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true);
    const canSeeFull = isTeacherView || isAdmin;
    if (!canSeeFull && (attempt.status === "SUBMITTED" || attempt.status === "MARKED") && !attempt.isReleased) {
      return res.json({ attempt: sanitizeAttemptForStudent(attempt) });
    }
    return res.json({ attempt });
  } catch (err) {
    console.error("WorksheetAttempts GET error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/worksheet-attempts/:attemptId/save — save in-progress answers (no auth required for MVP). Reject if assignment closed.
router.post("/:attemptId/save", async (req, res) => {
  try {
    const loaded = await loadAttemptAndAssignment(req, res);
    if (!loaded) return;
    const { attempt, assignment } = loaded;
    if (attempt.status !== "IN_PROGRESS") {
      return res.status(400).json({ error: "Attempt already submitted" });
    }
    if (assignment.isActive === false) {
      return res.status(403).json({ error: "Assignment is closed" });
    }
    if (assignment.dueAt && new Date(assignment.dueAt) < new Date()) {
      return res.status(403).json({ error: "Assignment is closed" });
    }
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const normalized = answers
      .filter((a) => a && mongoose.Types.ObjectId.isValid(String(a.examQuestionId)))
      .map((a) => ({
        examQuestionId: new mongoose.Types.ObjectId(a.examQuestionId),
        answerIndex: typeof a.answerIndex === "number" ? a.answerIndex : null,
        shortText: typeof a.shortText === "string" ? a.shortText.trim().slice(0, 5000) : "",
      }));
    await WorksheetAttempt.updateOne(
      { _id: attempt._id },
      { $set: { answers: normalized, updatedAt: new Date() } }
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("WorksheetAttempts save error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/worksheet-attempts/:attemptId/submit — lock attempt, score MCQs only. Reject if assignment closed.
router.post("/:attemptId/submit", async (req, res) => {
  try {
    const loaded = await loadAttemptAndAssignment(req, res);
    if (!loaded) return;
    const { attempt, assignment } = loaded;
    if (attempt.status !== "IN_PROGRESS") {
      return res.status(400).json({ error: "Attempt already submitted" });
    }
    if (assignment.isActive === false) {
      return res.status(403).json({ error: "Assignment is closed" });
    }
    if (assignment.dueAt && new Date(assignment.dueAt) < new Date()) {
      return res.status(403).json({ error: "Assignment is closed" });
    }
    const answers = Array.isArray(req.body.answers) ? req.body.answers : attempt.answers || [];
    const worksheet = await Worksheet.findById(attempt.worksheetId).lean();
    if (!worksheet) return res.status(404).json({ error: "Worksheet not found" });
    const questionIds = (worksheet.questionItems || []).map((it) => it.examQuestionId);
    const examQuestions = await ExamQuestion.find({ _id: { $in: questionIds } })
      .select("_id type marks correctIndex")
      .lean();
    const qMap = new Map(examQuestions.map((q) => [q._id.toString(), q]));
    let score = 0;
    let maxScore = 0;
    const answerMap = new Map(answers.map((a) => [String(a.examQuestionId), a]));
    const normalizedAnswers = [];
    for (const it of worksheet.questionItems || []) {
      const qid = it.examQuestionId.toString();
      const eq = qMap.get(qid);
      const marks = typeof it.marksOverride === "number" ? it.marksOverride : (eq && eq.marks) || 1;
      maxScore += marks;
      const ans = answerMap.get(qid);
      if (eq && eq.type === "mcq" && typeof eq.correctIndex === "number") {
        const chosen = ans && typeof ans.answerIndex === "number" ? ans.answerIndex : null;
        if (chosen === eq.correctIndex) score += marks;
        normalizedAnswers.push({
          examQuestionId: it.examQuestionId,
          answerIndex: chosen,
          shortText: (ans && ans.shortText) || "",
        });
      } else {
        normalizedAnswers.push({
          examQuestionId: it.examQuestionId,
          answerIndex: ans && typeof ans.answerIndex === "number" ? ans.answerIndex : null,
          shortText: (ans && ans.shortText) || "",
        });
      }
    }
    await WorksheetAttempt.updateOne(
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
    const updated = await WorksheetAttempt.findById(attempt._id).lean();
    const attemptPayload = { ...updated, score: updated.score, maxScore: updated.maxScore, status: "SUBMITTED" };
    if (!updated.isReleased) {
      return res.json({ ok: true, attempt: sanitizeAttemptForStudent(attemptPayload) });
    }
    return res.json({ ok: true, attempt: attemptPayload });
  } catch (err) {
    console.error("WorksheetAttempts submit error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/worksheet-attempts/:attemptId/mark — teacher/admin owner only; set awardedMarks/feedback on short answers, recalc score, set MARKED when done. PR-W5
router.post("/:attemptId/mark", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const loaded = await loadAttemptAndAssignment(req, res);
    if (!loaded) return;
    const { attempt, assignment } = loaded;
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!isAssignmentOwner(assignment, req) && !isAdmin) return res.status(404).json({ error: "Attempt not found" });
    if (attempt.status !== "SUBMITTED" && attempt.status !== "MARKED") {
      return res.status(400).json({ error: "Attempt must be submitted before marking" });
    }

    const worksheet = await Worksheet.findById(attempt.worksheetId).lean();
    if (!worksheet) return res.status(404).json({ error: "Worksheet not found" });
    const questionItems = worksheet.questionItems || [];
    const questionIds = questionItems.map((it) => it.examQuestionId);
    const examQuestions = await ExamQuestion.find({ _id: { $in: questionIds } })
      .select("_id type marks correctIndex")
      .lean();
    const qMap = new Map(examQuestions.map((q) => [q._id.toString(), q]));
    const itemByQid = new Map(questionItems.map((it) => [it.examQuestionId.toString(), it]));

    const marksPayload = Array.isArray(req.body.marks) ? req.body.marks : [];
    const now = new Date();
    const answerMap = new Map((attempt.answers || []).map((a) => [String(a.examQuestionId), { ...a }]));

    for (const m of marksPayload) {
      const qid = m && m.examQuestionId ? String(m.examQuestionId) : null;
      if (!qid || !itemByQid.has(qid)) continue;
      const eq = qMap.get(qid);
      const it = itemByQid.get(qid);
      const maxMarks = typeof it.marksOverride === "number" ? it.marksOverride : (eq && eq.marks) || 1;
      if (eq && eq.type === "mcq") {
        return res.status(400).json({ error: "Cannot set marks for MCQ questions; they are auto-scored" });
      }
      const awarded = typeof m.awardedMarks === "number" ? m.awardedMarks : null;
      if (awarded !== null && (awarded < 0 || awarded > maxMarks)) {
        return res.status(400).json({ error: `awardedMarks must be between 0 and ${maxMarks} for this question` });
      }
      const feedback = typeof m.teacherFeedback === "string" ? m.teacherFeedback.trim().slice(0, 500) : "";
      let ans = answerMap.get(qid);
      if (!ans) {
        ans = { examQuestionId: it.examQuestionId, answerIndex: null, shortText: "" };
        answerMap.set(qid, ans);
      }
      ans.awardedMarks = awarded;
      ans.teacherFeedback = feedback;
      ans.markedAt = now;
    }

    // Rebuild answers in worksheet order, merging in existing + marked
    const normalizedAnswers = [];
    let score = 0;
    let maxScore = 0;
    let allShortMarked = true;

    for (const it of questionItems) {
      const qid = it.examQuestionId.toString();
      const eq = qMap.get(qid);
      const marks = typeof it.marksOverride === "number" ? it.marksOverride : (eq && eq.marks) || 1;
      maxScore += marks;
      const ans = answerMap.get(qid) || attempt.answers?.find((a) => String(a.examQuestionId) === qid);
      const existing = attempt.answers?.find((a) => String(a.examQuestionId) === qid);

      if (eq && eq.type === "mcq" && typeof eq.correctIndex === "number") {
        const chosen = (ans && typeof ans.answerIndex === "number" ? ans.answerIndex : null);
        if (chosen === eq.correctIndex) score += marks;
        normalizedAnswers.push({
          examQuestionId: it.examQuestionId,
          answerIndex: chosen,
          shortText: (ans && ans.shortText) || "",
          awardedMarks: existing?.awardedMarks,
          teacherFeedback: existing?.teacherFeedback || "",
          markedAt: existing?.markedAt || null,
        });
      } else {
        const awarded = ans?.awardedMarks;
        if (typeof awarded === "number") score += awarded;
        else allShortMarked = false;
        normalizedAnswers.push({
          examQuestionId: it.examQuestionId,
          answerIndex: (ans && typeof ans.answerIndex === "number" ? ans.answerIndex : null) ?? (existing?.answerIndex ?? null),
          shortText: (ans && ans.shortText) || (existing?.shortText) || "",
          awardedMarks: ans?.awardedMarks ?? existing?.awardedMarks ?? null,
          teacherFeedback: (ans && ans.teacherFeedback) || (existing?.teacherFeedback) || "",
          markedAt: ans?.markedAt || existing?.markedAt || null,
        });
      }
    }

    const newStatus = allShortMarked ? "MARKED" : attempt.status;
    await WorksheetAttempt.updateOne(
      { _id: attempt._id },
      {
        $set: {
          answers: normalizedAnswers,
          score,
          maxScore,
          status: newStatus,
          updatedAt: now,
        },
      }
    );
    const updated = await WorksheetAttempt.findById(attempt._id).lean();
    return res.json({ attempt: updated });
  } catch (err) {
    console.error("WorksheetAttempts mark error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/worksheet-attempts/:attemptId/release — teacher/admin owner only; set isReleased=true. PR-W7
router.post("/:attemptId/release", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const loaded = await loadAttemptAndAssignment(req, res);
    if (!loaded) return;
    const { attempt, assignment } = loaded;
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!isAssignmentOwner(assignment, req) && !isAdmin) return res.status(404).json({ error: "Attempt not found" });
    if (attempt.status !== "SUBMITTED" && attempt.status !== "MARKED") {
      return res.status(400).json({ error: "Only submitted or marked attempts can be released" });
    }
    const now = new Date();
    await WorksheetAttempt.updateOne(
      { _id: attempt._id },
      { $set: { isReleased: true, releasedAt: now, updatedAt: now } }
    );
    const updated = await WorksheetAttempt.findById(attempt._id).lean();
    return res.json({ attempt: updated });
  } catch (err) {
    console.error("WorksheetAttempts release error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
