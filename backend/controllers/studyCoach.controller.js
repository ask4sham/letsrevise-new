/**
 * PR-038: Study coach API — personalised study plan from StudentTopicProgress + CoverageSnapshot.
 * Student only. Delegates to studyCoachService.
 */
const StudentTopicProgress = require("../models/StudentTopicProgress");
const CoverageSnapshot = require("../models/CoverageSnapshot");
const { normalizeSpecKey } = require("../config/featureFlags");
const { getPlanData, buildPlanActions } = require("../services/studyCoachService");

function isStudent(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "student";
}

function topicKeyToTitle(topicKey) {
  if (!topicKey || typeof topicKey !== "string") return "Topic";
  const last = String(topicKey).split(":").pop();
  return last ? last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : topicKey;
}

/**
 * GET /api/study-coach/plan?specKey=...
 * Returns top 3–5 topics for study plan.
 */
async function getPlan(req, res) {
  try {
    if (!isStudent(req)) {
      return res.status(403).json({ error: "Students only" });
    }
    const specKey = (req.query?.specKey || "").trim();
    if (!specKey) {
      return res.status(400).json({ error: "specKey is required" });
    }
    const spec = normalizeSpecKey(specKey);
    if (!spec) {
      return res.status(400).json({ error: "Invalid specKey" });
    }

    const userId = req.user?._id || req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data = await getPlanData(userId, spec);
    return res.json(data);
  } catch (err) {
    console.error("[study-coach] getPlan:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

/**
 * GET /api/study-coach/topic/:topicKey?specKey=...
 * Returns one detailed progress card.
 */
async function getTopic(req, res) {
  try {
    if (!isStudent(req)) {
      return res.status(403).json({ error: "Students only" });
    }
    const { topicKey } = req.params;
    const specKey = (req.query?.specKey || "").trim();
    if (!specKey || !topicKey) {
      return res.status(400).json({ error: "specKey and topicKey are required" });
    }
    const spec = normalizeSpecKey(specKey);
    if (!spec) {
      return res.status(400).json({ error: "Invalid specKey" });
    }

    const userId = req.user?._id || req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const progress = await StudentTopicProgress.findOne({
      userId,
      specKey: spec,
      topicKey: topicKey.trim(),
    }).lean();

    if (!progress) {
      return res.status(404).json({ error: "No progress for this topic" });
    }

    const latestCoverage = await CoverageSnapshot.findOne({ specKey: spec }).sort({ computedAt: -1 }).lean();
    let coverageStatus = "OK";
    let demandScore = 0;
    if (latestCoverage) {
      const row = await CoverageSnapshot.findOne({
        specKey: spec,
        topicKey: topicKey.trim(),
        computedAt: latestCoverage.computedAt,
      }).lean();
      if (row) {
        coverageStatus = row.status;
        demandScore = row.demandScore ?? 0;
      }
    }

    const actions = await buildPlanActions(topicKey.trim(), spec);

    return res.json({
      topicKey: progress.topicKey,
      masteryScore: progress.masteryScore ?? 0,
      confidenceBand: progress.confidenceBand ?? "low",
      status: progress.status ?? "new",
      nextAction: progress.recommendations?.nextAction ?? "viewLesson",
      reason: progress.recommendations?.reason ?? "Consider revising this topic.",
      coverageStatus,
      demandScore,
      signals: progress.signals || {},
      actions,
    });
  } catch (err) {
    console.error("[study-coach] getTopic:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

module.exports = { getPlan, getTopic };
