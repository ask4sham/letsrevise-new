/**
 * PR-PRACTICE-LOOP-1 Slice 1: Teacher topic-performance analytics.
 * GET /topic-performance?specKey=... — aggregate by topicKey; sort by lowest accuracy first.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const PracticeAttempt = require("../models/PracticeAttempt");

function getUserId(req) {
  return req.user?.userId ?? req.user?._id ?? req.user?.id;
}

function isTeacher(req) {
  const t = (req.user?.userType || req.user?.type || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user?.isAdmin === true;
}

// GET /api/teacher/analytics/topic-performance?specKey=...
router.get("/topic-performance", auth, async (req, res) => {
  if (!isTeacher(req)) {
    return res.status(403).json({ error: "Teachers only" });
  }

  const specKey = (req.query.specKey && String(req.query.specKey).trim()) || null;
  if (!specKey) {
    return res.status(400).json({ error: "specKey is required" });
  }

  const teacherId = getUserId(req);
  if (!teacherId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const agg = await PracticeAttempt.aggregate([
      { $match: { teacherId, specKey } },
      {
        $addFields: {
          correctCount: {
            $cond: [
              {
                $or: [
                  { $eq: ["$isCorrect", true] },
                  { $eq: ["$outcome", "correct"] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: "$topicKey",
          attempts: { $sum: 1 },
          correct: { $sum: "$correctCount" },
          lastAttemptAt: { $max: "$createdAt" },
        },
      },
      {
        $addFields: {
          accuracy: { $cond: [{ $eq: ["$attempts", 0] }, 0, { $divide: ["$correct", "$attempts"] }] },
        },
      },
      { $sort: { accuracy: 1 } },
      {
        $project: {
          topicKey: "$_id",
          attempts: 1,
          correct: 1,
          accuracy: 1,
          lastAttemptAt: 1,
          _id: 0,
        },
      },
    ]);

    return res.status(200).json(agg);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Failed to fetch topic performance" });
  }
});

module.exports = router;
