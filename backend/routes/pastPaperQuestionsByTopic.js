/**
 * PR-QUESTION-BROWSER-1: List teacher's past paper questions by spec + topic (for Questions browser page).
 */
const express = require("express");
const router = express.Router();
const PastPaperQuestion = require("../models/PastPaperQuestion");
const auth = require("../middleware/auth");
const { assertValidSpecKey } = require("../utils/specTopicValidation");
const { queryCandidates } = require("../utils/topicKey");

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

function getOwnerId(req) {
  return req.user._id || req.user.userId || req.user.id;
}

// GET /api/past-paper-questions/by-topic?specKey=...&topicKey=...&q=...&limit=...
router.get("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const { specKey, topicKey, q, limit } = req.query;
    if (!specKey || !topicKey) {
      return res.status(400).json({ error: "specKey and topicKey are required" });
    }
    assertValidSpecKey(String(specKey).trim());
    const slug = String(topicKey).trim();
    const candidates = queryCandidates(String(specKey).trim(), slug);
    if (!candidates || candidates.length === 0) {
      return res.status(400).json({ error: "Invalid topicKey" });
    }
    const lim = Math.min(Number(limit) || 200, 500);
    const ownerId = getOwnerId(req);

    const match = {
      ownerId,
      topicKey: { $in: candidates },
      isArchived: { $ne: true },
    };
    if (q && String(q).trim()) {
      match.question = { $regex: String(q).trim(), $options: "i" };
    }

    const items = await PastPaperQuestion.find(match).sort({ createdAt: -1 }).limit(lim).lean();
    return res.json({ items });
  } catch (e) {
    const status = e.code === "INVALID_SPEC_KEY" ? 400 : e.status || 500;
    return res.status(status).json({ error: e.message || "Failed" });
  }
});

module.exports = router;
