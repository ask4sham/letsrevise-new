/**
 * PR-PRACTICE-LOOP-1: Practice set (GET), submit attempt (POST), teacher topic stats (GET).
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { generatePracticeSet, OUTCOME_ENUM } = require("../services/generatePracticeSet");
const PracticeAttempt = require("../models/PracticeAttempt");
const { buildTopicKey, parseTopicKey } = require("../utils/topicKey");
const { assertValidSpecKey, assertValidSpecTopic } = require("../utils/specTopicValidation");

function getUserId(req) {
  return req.user?.userId ?? req.user?._id ?? req.user?.id;
}

function isTeacher(req) {
  const t = (req.user?.userType || req.user?.type || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user?.isAdmin === true;
}

// GET /api/practice/set — specKey, topicKey (slug), count (default 10 max 30), optional teacherId
router.get("/set", auth, async (req, res) => {
  try {
    const specKey = (req.query.specKey && String(req.query.specKey).trim()) || null;
    const topicKey = (req.query.topicKey && String(req.query.topicKey).trim()) || null;
    const count = Math.min(30, Math.max(1, parseInt(req.query.count, 10) || 10));
    const teacherId = req.query.teacherId && String(req.query.teacherId).trim() ? req.query.teacherId : null;

    if (!specKey || !topicKey) {
      return res.status(400).json({ error: "specKey and topicKey are required" });
    }

    const result = await generatePracticeSet({
      teacherId: teacherId || undefined,
      specKey,
      topicKey,
      count,
    });

    return res.status(200).json(result);
  } catch (e) {
    if (e.code === "INVALID_SPEC_KEY" || e.code === "INVALID_TOPIC_KEY") {
      return res.status(400).json({ error: e.message });
    }
    return res.status(500).json({ error: e.message || "Failed to generate practice set" });
  }
});

// POST /api/practice/attempt — store attempt with namespaced topicKey
router.post("/attempt", auth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { specKey, topicKey, sourceType, sourceId, outcome, confidence } = req.body || {};

    if (!specKey || !topicKey || !sourceType || !sourceId || !outcome) {
      return res.status(400).json({
        error: "specKey, topicKey, sourceType, sourceId, and outcome are required",
      });
    }
    if (!["examQuestion", "pastPaperQuestion"].includes(sourceType)) {
      return res.status(400).json({ error: "sourceType must be examQuestion or pastPaperQuestion" });
    }
    if (!OUTCOME_ENUM.includes(outcome)) {
      return res.status(400).json({ error: "outcome must be correct, partial, or wrong" });
    }

    assertValidSpecKey(specKey);
    const topicSlug = parseTopicKey(String(topicKey).trim()).topicKey || String(topicKey).trim();
    assertValidSpecTopic({ specKey, topicKey: topicSlug });

    const namespacedTopicKey = buildTopicKey(specKey, topicSlug);

    // teacherId: from request (content owner) or leave null and derive from source later; spec says teacherId required on model
    const teacherId = req.body.teacherId && req.body.teacherId.trim ? req.body.teacherId.trim() : req.body.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: "teacherId (content owner) is required for attempt" });
    }

    const conf = confidence != null ? Math.min(3, Math.max(1, parseInt(confidence, 10))) : null;

    const attempt = await PracticeAttempt.create({
      studentId: userId,
      teacherId,
      specKey,
      topicKey: namespacedTopicKey,
      sourceType,
      sourceId,
      outcome,
      confidence: Number.isInteger(conf) ? conf : null,
    });

    return res.status(201).json({
      success: true,
      attemptId: attempt._id,
    });
  } catch (e) {
    if (e.code === "INVALID_SPEC_KEY" || e.code === "INVALID_TOPIC_KEY") {
      return res.status(400).json({ error: e.message });
    }
    return res.status(400).json({ error: e.message || "Failed to record attempt" });
  }
});

// GET /api/practice/stats/topics — teacher only; specKey required; aggregation by topicKey
router.get("/stats/topics", auth, async (req, res) => {
  if (!isTeacher(req)) {
    return res.status(403).json({ error: "Teachers only" });
  }

  const specKey = (req.query.specKey && String(req.query.specKey).trim()) || null;
  if (!specKey) {
    return res.status(400).json({ error: "specKey is required" });
  }

  try {
    const teacherId = getUserId(req);
    const agg = await PracticeAttempt.aggregate([
      { $match: { teacherId: teacherId, specKey } },
      {
        $group: {
          _id: "$topicKey",
          attempts: { $sum: 1 },
          correct: { $sum: { $cond: [{ $eq: ["$outcome", "correct"] }, 1, 0] } },
          partial: { $sum: { $cond: [{ $eq: ["$outcome", "partial"] }, 1, 0] } },
          wrong: { $sum: { $cond: [{ $eq: ["$outcome", "wrong"] }, 1, 0] } },
          lastAttempt: { $max: "$createdAt" },
        },
      },
      { $sort: { lastAttempt: -1 } },
      {
        $project: {
          topicKey: "$_id",
          attempts: 1,
          correct: 1,
          partial: 1,
          wrong: 1,
          lastAttempt: 1,
          _id: 0,
        },
      },
    ]);

    // Fix accuracy: divide (correct + partial*0.5) / attempts * 100
    const withAccuracy = agg.map((row) => ({
      ...row,
      accuracy: row.attempts > 0
        ? Math.round(
            (100 * (row.correct + row.partial * 0.5)) / row.attempts
          )
        : null,
    }));

    return res.status(200).json({ specKey, topics: withAccuracy });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Failed to fetch topic stats" });
  }
});

module.exports = router;
