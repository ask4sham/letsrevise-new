/**
 * PR — Adaptive Testing Loop: Topic mastery API.
 * Student: record quiz answers, get own mastery.
 * Teacher: get aggregate mastery for linked students.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const TopicMastery = require("../models/TopicMastery");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const { sendInternalError } = require("../utils/safeErrorResponse");

function isStudent(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "student";
}

function isTeacherOrAdmin(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin";
}

/**
 * POST /api/mastery/record
 * Body: { topicKey: string, correct: boolean }
 * Student only. Updates mastery after each quiz question.
 */
router.post("/record", auth, async (req, res) => {
  try {
    if (!isStudent(req)) {
      return res.status(403).json({ error: "Students only" });
    }
    const { topicKey, correct } = req.body || {};
    if (!topicKey || typeof topicKey !== "string") {
      return res.status(400).json({ error: "topicKey is required" });
    }
    const tk = String(topicKey).trim();
    if (!tk) {
      return res.status(400).json({ error: "topicKey is required" });
    }
    const userId = req.user?._id || req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const doc = await TopicMastery.findOneAndUpdate(
      { userId, topicKey: tk },
      {
        $inc: { attempts: 1, correct: correct === true ? 1 : 0 },
      },
      { upsert: true, new: true }
    );

    const attempts = doc.attempts || 0;
    const correctCount = doc.correct || 0;
    const masteryScore = attempts > 0 ? correctCount / attempts : 0;

    await TopicMastery.updateOne(
      { _id: doc._id },
      { $set: { masteryScore } }
    );

    return res.status(200).json({
      topicKey: tk,
      attempts,
      correct: correctCount,
      masteryScore,
    });
  } catch (err) {
    console.error("[mastery] record:", err);
    return sendInternalError("mastery/record", err, res);
  }
});

/**
 * GET /api/mastery?topicKey=...
 * Student only. Returns mastery for current user for the given topic.
 */
router.get("/", auth, async (req, res) => {
  try {
    if (!isStudent(req)) {
      return res.status(403).json({ error: "Students only" });
    }
    const topicKey = (req.query?.topicKey || "").trim();
    if (!topicKey) {
      return res.status(400).json({ error: "topicKey query param is required" });
    }
    const userId = req.user?._id || req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const doc = await TopicMastery.findOne({ userId, topicKey }).lean();
    if (!doc) {
      return res.json({
        topicKey,
        attempts: 0,
        correct: 0,
        masteryScore: 0,
      });
    }

    const attempts = doc.attempts || 0;
    const correct = doc.correct || 0;
    const masteryScore = attempts > 0 ? correct / attempts : 0;

    return res.json({
      topicKey: doc.topicKey,
      attempts,
      correct,
      masteryScore,
    });
  } catch (err) {
    console.error("[mastery] get:", err);
    return sendInternalError("mastery/get", err, res);
  }
});

/**
 * GET /api/mastery/aggregate?specKey=...
 * Teacher/admin only. Returns per-topic aggregate mastery for linked students.
 * Each topicKey has: avgMastery, studentCount, strugglingCount (mastery < 0.5).
 */
router.get("/aggregate", auth, async (req, res) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teacher or admin only" });
    }
    const specKey = (req.query?.specKey || "").trim();
    if (!specKey) {
      return res.status(400).json({ error: "specKey query param is required" });
    }
    const teacherId = req.user?._id || req.user?.userId || req.user?.id;
    if (!teacherId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get linked student IDs
    const links = await StudentTeacherLink.find({ teacherId }).select("studentId").lean();
    const studentIds = links.map((l) => l.studentId).filter(Boolean);

    if (studentIds.length === 0) {
      return res.json({
        specKey,
        topics: [],
        generatedAt: new Date().toISOString(),
      });
    }

    // topicKey format: specKey:topicSlug (e.g. aqa-gcse-biology:cell-structure)
    const prefix = specKey + ":";
    const docs = await TopicMastery.find({
      userId: { $in: studentIds },
      topicKey: { $regex: `^${escapeRegex(prefix)}` },
    }).lean();

    const byTopic = new Map();
    for (const d of docs) {
      const tk = String(d.topicKey || "").trim();
      if (!tk) continue;
      const attempts = d.attempts || 0;
      const correct = d.correct || 0;
      const score = attempts > 0 ? correct / attempts : 0;

      if (!byTopic.has(tk)) {
        byTopic.set(tk, { topicKey: tk, scores: [], strugglingCount: 0 });
      }
      const entry = byTopic.get(tk);
      entry.scores.push(score);
      if (score < 0.5 && attempts >= 1) {
        entry.strugglingCount += 1;
      }
    }

    const topics = Array.from(byTopic.values()).map((e) => {
      const n = e.scores.length;
      const avg = n > 0 ? e.scores.reduce((a, b) => a + b, 0) / n : 0;
      return {
        topicKey: e.topicKey,
        topicTitle: topicKeyToTitle(e.topicKey),
        avgMastery: Math.round(avg * 100) / 100,
        studentCount: n,
        strugglingCount: e.strugglingCount,
      };
    });

    topics.sort((a, b) => a.topicKey.localeCompare(b.topicKey));

    return res.json({
      specKey,
      topics,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[mastery] aggregate:", err);
    return sendInternalError("mastery/aggregate", err, res);
  }
});

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function topicKeyToTitle(topicKey) {
  if (!topicKey || typeof topicKey !== "string") return "Topic";
  const last = String(topicKey).split(":").pop();
  return last ? last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : topicKey;
}

module.exports = router;
