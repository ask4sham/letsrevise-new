// backend/routes/worksheets.js — PR-W1: Worksheet model + APIs (teacher/admin only)
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const auth = require("../middleware/auth");
const Worksheet = require("../models/Worksheet");
const { TITLE_MAX_LENGTH } = require("../models/Worksheet");

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

/** Normalize and validate questionItems. Returns { ok, items, error } — error set if invalid or duplicates. */
function parseQuestionItems(items) {
  if (!Array.isArray(items)) {
    return { ok: false, items: [], error: "questionItems must be an array" };
  }
  const seen = new Set();
  const result = [];
  for (const it of items) {
    if (!it || !mongoose.Types.ObjectId.isValid(String(it.examQuestionId))) {
      return { ok: false, items: [], error: "Each item must include a valid examQuestionId" };
    }
    const oid = new mongoose.Types.ObjectId(it.examQuestionId);
    const idStr = oid.toString();
    if (seen.has(idStr)) {
      return { ok: false, items: [], error: "Duplicate examQuestionId in questionItems" };
    }
    seen.add(idStr);
    result.push({
      examQuestionId: oid,
      marksOverride: typeof it.marksOverride === "number" && it.marksOverride >= 0 ? it.marksOverride : undefined,
      notes: typeof it.notes === "string" ? it.notes.trim().slice(0, 500) : "",
    });
  }
  return { ok: true, items: result, error: null };
}

function sanitizeTitle(title) {
  const t = (title != null && typeof title === "string" ? title : "").trim();
  if (!t) return "Untitled worksheet";
  return t.slice(0, TITLE_MAX_LENGTH);
}

// GET /api/worksheets — list worksheets: owner-only (admin sees all), sorted updatedAt desc, no populate
router.get("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const ownerId = req.user._id || req.user.userId || req.user.id;
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const query = isAdmin ? {} : { ownerId };
    const list = await Worksheet.find(query).sort({ updatedAt: -1 }).lean();
    return res.json({ worksheets: list });
  } catch (err) {
    console.error("Worksheets list error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/worksheets — create empty worksheet (teacher/admin only). questionItems always [] on create.
router.post("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const ownerId = req.user._id || req.user.userId || req.user.id;
    const doc = await Worksheet.create({
      ownerId,
      title: sanitizeTitle(req.body.title),
      subject: (req.body.subject && String(req.body.subject).trim()) || "",
      examBoard: (req.body.examBoard && String(req.body.examBoard).trim()) || "",
      level: (req.body.level && String(req.body.level).trim()) || "",
      topicKey: (req.body.topicKey && String(req.body.topicKey).trim()) || null,
      questionItems: [],
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

// PUT /api/worksheets/:id — update title, items, metadata (owner or admin only). status is read-only; use POST /publish.
router.put("/:id", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, "status")) {
    return res.status(400).json({ error: "status is read-only; use /publish" });
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
    if (req.body.title !== undefined) doc.title = sanitizeTitle(req.body.title);
    if (req.body.subject !== undefined) doc.subject = String(req.body.subject).trim();
    if (req.body.examBoard !== undefined) doc.examBoard = String(req.body.examBoard).trim();
    if (req.body.level !== undefined) doc.level = String(req.body.level).trim();
    if (req.body.topicKey !== undefined) doc.topicKey = (req.body.topicKey && String(req.body.topicKey).trim()) || null;
    if (req.body.questionItems !== undefined) {
      const parsed = parseQuestionItems(req.body.questionItems);
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      doc.questionItems = parsed.items;
    }
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
