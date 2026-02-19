// backend/routes/worksheets.js — PR-W1: Worksheet model + APIs (teacher/admin only)
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const auth = require("../middleware/auth");
const Worksheet = require("../models/Worksheet");

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

function normalizeQuestionItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((it) => it && mongoose.Types.ObjectId.isValid(String(it.examQuestionId)))
    .map((it) => ({
      examQuestionId: it.examQuestionId,
      marksOverride: typeof it.marksOverride === "number" && it.marksOverride >= 0 ? it.marksOverride : undefined,
      notes: typeof it.notes === "string" ? it.notes.trim().slice(0, 500) : "",
    }));
}

// POST /api/worksheets — create empty worksheet (teacher/admin only)
router.post("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const ownerId = req.user._id || req.user.userId || req.user.id;
    const doc = await Worksheet.create({
      ownerId,
      title: (req.body.title && String(req.body.title).trim()) || "Untitled worksheet",
      subject: (req.body.subject && String(req.body.subject).trim()) || "",
      examBoard: (req.body.examBoard && String(req.body.examBoard).trim()) || "",
      topicKey: (req.body.topicKey && String(req.body.topicKey).trim()) || null,
      questionItems: normalizeQuestionItems(req.body.questionItems || []),
      status: "DRAFT",
    });
    return res.status(201).json({ worksheet: doc.toObject() });
  } catch (err) {
    console.error("Worksheets POST error:", err);
    return res.status(400).json({ error: err.message || "Bad request" });
  }
});

// GET /api/worksheets/:id — load worksheet (owner or admin only)
router.get("/:id", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid worksheet id" });
    }
    const doc = await Worksheet.findById(id).lean();
    if (!doc) return res.status(404).json({ error: "Worksheet not found" });
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!isOwner(doc, req) && !isAdmin) {
      return res.status(403).json({ error: "You can only access your own worksheets" });
    }
    return res.json({ worksheet: doc });
  } catch (err) {
    console.error("Worksheets GET error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/worksheets/:id — update title, items, metadata (owner or admin only, idempotent)
router.put("/:id", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid worksheet id" });
    }
    const doc = await Worksheet.findById(id);
    if (!doc) return res.status(404).json({ error: "Worksheet not found" });
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!isOwner(doc, req) && !isAdmin) {
      return res.status(403).json({ error: "You can only update your own worksheets" });
    }
    if (req.body.title !== undefined) doc.title = String(req.body.title).trim() || "Untitled worksheet";
    if (req.body.subject !== undefined) doc.subject = String(req.body.subject).trim();
    if (req.body.examBoard !== undefined) doc.examBoard = String(req.body.examBoard).trim();
    if (req.body.topicKey !== undefined) doc.topicKey = (req.body.topicKey && String(req.body.topicKey).trim()) || null;
    if (req.body.questionItems !== undefined) doc.questionItems = normalizeQuestionItems(req.body.questionItems);
    await doc.save();
    return res.json({ worksheet: doc.toObject() });
  } catch (err) {
    console.error("Worksheets PUT error:", err);
    return res.status(400).json({ error: err.message || "Bad request" });
  }
});

// POST /api/worksheets/:id/publish — set status to PUBLISHED (owner or admin only)
router.post("/:id/publish", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid worksheet id" });
    }
    const doc = await Worksheet.findById(id);
    if (!doc) return res.status(404).json({ error: "Worksheet not found" });
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!isOwner(doc, req) && !isAdmin) {
      return res.status(403).json({ error: "You can only publish your own worksheets" });
    }
    doc.status = "PUBLISHED";
    await doc.save();
    return res.json({ worksheet: doc.toObject() });
  } catch (err) {
    console.error("Worksheets publish error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
