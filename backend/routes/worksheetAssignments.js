// backend/routes/worksheetAssignments.js — PR-W4: assignment CRUD + public share + create attempt
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const auth = require("../middleware/auth");
const Worksheet = require("../models/Worksheet");
const WorksheetAssignment = require("../models/WorksheetAssignment");
const WorksheetAttempt = require("../models/WorksheetAttempt");
const ExamQuestion = require("../models/ExamQuestion");
const { sendInternalError } = require("../utils/safeErrorResponse");

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

// ——— Teacher/admin protected ———

// POST /api/worksheet-assignments — create assignment (worksheet must be PUBLISHED)
router.post("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const { worksheetId, title, classCode, dueAt } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(worksheetId)) {
      return res.status(400).json({ error: "Invalid worksheetId" });
    }
    const worksheet = await Worksheet.findById(worksheetId).lean();
    if (!worksheet) return res.status(404).json({ error: "Worksheet not found" });
    if (worksheet.status !== "PUBLISHED") return res.status(400).json({ error: "Worksheet must be published before assigning" });
    const ownerId = req.user._id || req.user.userId || req.user.id;
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!isOwner(worksheet, req) && !isAdmin) return res.status(404).json({ error: "Worksheet not found" });
    let shareId = WorksheetAssignment.generateShareId();
    let exists = await WorksheetAssignment.findOne({ shareId });
    while (exists) {
      shareId = WorksheetAssignment.generateShareId();
      exists = await WorksheetAssignment.findOne({ shareId });
    }
    const doc = await WorksheetAssignment.create({
      worksheetId,
      ownerId,
      title: (title && String(title).trim()) || "",
      classCode: (classCode && String(classCode).trim()) || "",
      dueAt: dueAt ? new Date(dueAt) : null,
      shareId,
    });
    return res.status(201).json({ assignment: doc.toObject() });
  } catch (err) {
    console.error("WorksheetAssignments POST error:", err);
    return sendInternalError("worksheet-assignments/create", err, res);
  }
});

// GET /api/worksheet-assignments — list for owner (admin sees all)
router.get("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const ownerId = req.user._id || req.user.userId || req.user.id;
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const query = isAdmin ? {} : { ownerId };
    const list = await WorksheetAssignment.find(query).sort({ updatedAt: -1 }).lean();
    return res.json({ assignments: list });
  } catch (err) {
    console.error("WorksheetAssignments list error:", err);
    return sendInternalError("worksheet-assignments/list", err, res);
  }
});

// ——— Public (no auth) — must be before /:id ———

// GET /api/worksheet-assignments/share/:shareId — assignment metadata + worksheet + questions (for students). Returns isActive and dueAt so student can show "closed" UX.
router.get("/share/:shareId", async (req, res) => {
  try {
    const shareId = (req.params.shareId || "").trim();
    if (!shareId) return res.status(400).json({ error: "Missing shareId" });
    const assignment = await WorksheetAssignment.findOne({ shareId }).lean();
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    const worksheet = await Worksheet.findById(assignment.worksheetId).lean();
    if (!worksheet || worksheet.status !== "PUBLISHED") {
      return res.status(404).json({ error: "Worksheet not found or not published" });
    }
    const questionIds = (worksheet.questionItems || []).map((it) => it.examQuestionId);
    const examQuestions = await ExamQuestion.find({ _id: { $in: questionIds } })
      .select("_id type question options marks correctIndex markScheme")
      .lean();
    const qMap = new Map(examQuestions.map((q) => [q._id.toString(), q]));
    const items = (worksheet.questionItems || []).map((it) => {
      const eq = qMap.get(it.examQuestionId.toString());
      const marks = typeof it.marksOverride === "number" ? it.marksOverride : (eq && eq.marks) || 1;
      if (!eq) return { examQuestionId: it.examQuestionId, type: "short", question: "?", marks };
      if (eq.type === "mcq") {
        return {
          _id: eq._id,
          examQuestionId: eq._id,
          type: "mcq",
          question: eq.question,
          options: eq.options || [],
          marks,
        };
      }
      return {
        _id: eq._id,
        examQuestionId: eq._id,
        type: eq.type || "short",
        question: eq.question,
        marks,
      };
    });
    return res.json({
      assignment: {
        _id: assignment._id,
        title: assignment.title,
        dueAt: assignment.dueAt || null,
        worksheetId: assignment.worksheetId,
        isActive: assignment.isActive !== false,
      },
      worksheet: { _id: worksheet._id, title: worksheet.title },
      questions: items,
    });
  } catch (err) {
    console.error("WorksheetAssignments share GET error:", err);
    return sendInternalError("worksheet-assignments/share", err, res);
  }
});

// POST /api/worksheet-assignments/share/:shareId/attempts — create attempt (anonymous allowed). Reject if assignment closed or past due.
router.post("/share/:shareId/attempts", async (req, res) => {
  try {
    const shareId = (req.params.shareId || "").trim();
    if (!shareId) return res.status(400).json({ error: "Missing shareId" });
    const assignment = await WorksheetAssignment.findOne({ shareId }).lean();
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (assignment.isActive === false) {
      return res.status(403).json({ error: "Assignment is closed" });
    }
    if (assignment.dueAt && new Date(assignment.dueAt) < new Date()) {
      return res.status(403).json({ error: "Assignment is closed" });
    }
    const worksheet = await Worksheet.findById(assignment.worksheetId).lean();
    if (!worksheet || worksheet.status !== "PUBLISHED") {
      return res.status(404).json({ error: "Worksheet not found or not published" });
    }
    const studentName = (req.body && req.body.studentName != null) ? String(req.body.studentName).trim() : "";
    const attempt = await WorksheetAttempt.create({
      assignmentId: assignment._id,
      worksheetId: worksheet._id,
      studentId: null,
      studentName,
      answers: [],
      score: 0,
      maxScore: 0,
      status: "IN_PROGRESS",
    });
    return res.status(201).json({ attemptId: attempt._id.toString() });
  } catch (err) {
    console.error("WorksheetAssignments create attempt error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/worksheet-assignments/:id — owner/admin only
router.get("/:id", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid assignment id" });
    }
    const doc = await WorksheetAssignment.findById(id).lean();
    if (!doc) return res.status(404).json({ error: "Assignment not found" });
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!isOwner(doc, req) && !isAdmin) return res.status(404).json({ error: "Assignment not found" });
    return res.json({ assignment: doc });
  } catch (err) {
    console.error("WorksheetAssignments GET error:", err);
    return sendInternalError("worksheet-assignments/get", err, res);
  }
});

// POST /api/worksheet-assignments/:id/close — set isActive = false
router.post("/:id/close", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid assignment id" });
    }
    const doc = await WorksheetAssignment.findById(id);
    if (!doc) return res.status(404).json({ error: "Assignment not found" });
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!isOwner(doc, req) && !isAdmin) return res.status(404).json({ error: "Assignment not found" });
    doc.isActive = false;
    await doc.save();
    return res.json({ assignment: doc.toObject() });
  } catch (err) {
    console.error("WorksheetAssignments close error:", err);
    return sendInternalError("worksheet-assignments/close", err, res);
  }
});

module.exports = router;
