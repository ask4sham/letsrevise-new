// backend/routes/worksheetReports.js — PR-W4: teacher report summary per assignment; PR-W5: needsMarkingCount, avg includes MARKED
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const auth = require("../middleware/auth");
const WorksheetAssignment = require("../models/WorksheetAssignment");
const WorksheetAttempt = require("../models/WorksheetAttempt");
const Worksheet = require("../models/Worksheet");
const ExamQuestion = require("../models/ExamQuestion");

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || req.user.isAdmin || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

function isOwner(doc, req) {
  if (!doc || !req.user) return false;
  const ownerId = doc.ownerId && doc.ownerId.toString ? doc.ownerId.toString() : String(doc.ownerId);
  const userId = (req.user._id || req.user.userId || req.user.id || "").toString();
  return ownerId === userId;
}

// GET /api/worksheet-reports/needs-marking — teacher/admin; attempts SUBMITTED with unmarked short answers, scoped to teacher's assignments. PR-W6
router.get("/needs-marking", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const userId = (req.user._id || req.user.userId || req.user.id || "").toString();
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

    const assignmentQuery = isAdmin ? {} : { ownerId: userId };
    const assignments = await WorksheetAssignment.find(assignmentQuery).select("_id title worksheetId").lean();
    const assignmentIds = assignments.map((a) => a._id);
    const assignmentMap = new Map(assignments.map((a) => [a._id.toString(), a]));

    if (assignmentIds.length === 0) {
      return res.json({ items: [] });
    }

    const attempts = await WorksheetAttempt.find({
      assignmentId: { $in: assignmentIds },
      status: "SUBMITTED",
    })
      .select("_id assignmentId worksheetId studentName answers submittedAt updatedAt")
      .sort({ submittedAt: -1, updatedAt: -1 })
      .limit(limit * 2)
      .lean();

    const worksheetIds = [...new Set(attempts.map((a) => a.worksheetId))];
    const worksheets = await Worksheet.find({ _id: { $in: worksheetIds } }).select("_id title questionItems").lean();
    const worksheetMap = new Map(worksheets.map((w) => [w._id.toString(), w]));

    const allQIds = new Set();
    worksheets.forEach((w) => (w.questionItems || []).forEach((it) => allQIds.add(it.examQuestionId)));
    const examQuestions = await ExamQuestion.find({ _id: { $in: [...allQIds] } }).select("_id type").lean();
    const shortByWorksheet = new Map();
    worksheets.forEach((w) => {
      const qids = (w.questionItems || []).map((it) => it.examQuestionId);
      const eqMap = new Map(examQuestions.filter((eq) => qids.some((q) => q.toString() === eq._id.toString())).map((eq) => [eq._id.toString(), eq]));
      const shortIds = new Set((w.questionItems || []).filter((it) => eqMap.get(it.examQuestionId.toString())?.type !== "mcq").map((it) => it.examQuestionId.toString()));
      shortByWorksheet.set(w._id.toString(), shortIds);
    });

    const items = [];
    for (const a of attempts) {
      const ws = worksheetMap.get(a.worksheetId.toString());
      const shortIds = ws ? shortByWorksheet.get(a.worksheetId.toString()) : new Set();
      if (!shortIds || shortIds.size === 0) continue;
      let unmarkedCount = 0;
      const answers = a.answers || [];
      for (const ans of answers) {
        if (shortIds.has(String(ans.examQuestionId)) && (ans.awardedMarks == null)) unmarkedCount++;
      }
      if (unmarkedCount === 0) continue;

      const assignment = assignmentMap.get(a.assignmentId.toString());
      items.push({
        attemptId: a._id.toString(),
        assignmentId: a.assignmentId.toString(),
        worksheetId: a.worksheetId.toString(),
        worksheetTitle: (ws && ws.title) || "",
        assignmentTitle: (assignment && assignment.title) || "",
        studentName: a.studentName || "",
        submittedAt: a.submittedAt || null,
        updatedAt: a.updatedAt,
        unmarkedCount,
        totalShortCount: shortIds.size,
      });
      if (items.length >= limit) break;
    }

    return res.json({ items });
  } catch (err) {
    console.error("WorksheetReports needs-marking error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/worksheet-reports/assignment/:assignmentId/attempts — teacher/admin only, list attempts (newest first); PR-W5: needsMarking
router.get("/assignment/:assignmentId/attempts", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const assignmentId = req.params.assignmentId;
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({ error: "Invalid assignment id" });
    }
    const assignment = await WorksheetAssignment.findById(assignmentId).lean();
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!isOwner(assignment, req) && !isAdmin) return res.status(404).json({ error: "Assignment not found" });
    const list = await WorksheetAttempt.find({ assignmentId })
      .select("_id studentName status score maxScore submittedAt updatedAt createdAt answers")
      .sort({ updatedAt: -1 })
      .lean();

    let shortQuestionIds = new Set();
    const worksheet = await Worksheet.findById(assignment.worksheetId).lean();
    if (worksheet && (worksheet.questionItems || []).length > 0) {
      const questionIds = (worksheet.questionItems || []).map((it) => it.examQuestionId);
      const examQuestions = await ExamQuestion.find({ _id: { $in: questionIds } }).select("_id type").lean();
      examQuestions.forEach((q) => {
        if (q.type !== "mcq") shortQuestionIds.add(q._id.toString());
      });
    }

    const payload = list.map((a) => {
      let needsMarking = false;
      if (a.status === "SUBMITTED" && a.answers && shortQuestionIds.size > 0) {
        needsMarking = a.answers.some(
          (ans) => shortQuestionIds.has(String(ans.examQuestionId)) && (ans.awardedMarks == null)
        );
      }
      return {
        _id: a._id,
        studentName: a.studentName || "",
        status: a.status,
        score: a.score ?? 0,
        maxScore: a.maxScore ?? 0,
        submittedAt: a.submittedAt || null,
        updatedAt: a.updatedAt,
        createdAt: a.createdAt,
        needsMarking,
      };
    });
    return res.json({ attempts: payload });
  } catch (err) {
    console.error("WorksheetReports attempts list error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/worksheet-reports/assignment/:assignmentId/summary — teacher/admin only; PR-W5: avg includes SUBMITTED+MARKED, needsMarkingCount
router.get("/assignment/:assignmentId/summary", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const assignmentId = req.params.assignmentId;
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({ error: "Invalid assignment id" });
    }
    const assignment = await WorksheetAssignment.findById(assignmentId).lean();
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!isOwner(assignment, req) && !isAdmin) return res.status(404).json({ error: "Assignment not found" });
    const attempts = await WorksheetAttempt.find({ assignmentId }).lean();
    const submitted = attempts.filter((a) => a.status === "SUBMITTED" || a.status === "MARKED");
    const attemptsCount = attempts.length;
    const submittedCount = submitted.length;
    let avgScore = 0;
    let maxScore = 0;
    if (submitted.length > 0) {
      const totalScore = submitted.reduce((s, a) => s + (a.score || 0), 0);
      const totalMax = submitted.reduce((s, a) => s + (a.maxScore || 0), 0);
      avgScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) / 100 : 0;
      maxScore = submitted[0].maxScore || 0;
    }

    let needsMarkingCount = 0;
    const worksheet = await Worksheet.findById(assignment.worksheetId).lean();
    if (worksheet && (worksheet.questionItems || []).length > 0) {
      const questionIds = (worksheet.questionItems || []).map((it) => it.examQuestionId);
      const examQuestions = await ExamQuestion.find({ _id: { $in: questionIds } }).select("_id type").lean();
      const shortIds = new Set(examQuestions.filter((q) => q.type !== "mcq").map((q) => q._id.toString()));
      const submittedOnly = attempts.filter((a) => a.status === "SUBMITTED");
      needsMarkingCount = submittedOnly.filter((a) =>
        a.answers && a.answers.some((ans) => shortIds.has(String(ans.examQuestionId)) && (ans.awardedMarks == null))
      ).length;
    }

    return res.json({
      attemptsCount,
      submittedCount,
      avgScore,
      maxScore,
      needsMarkingCount,
    });
  } catch (err) {
    console.error("WorksheetReports summary error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
