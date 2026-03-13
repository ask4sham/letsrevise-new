/**
 * PR-038: Study coach API — personalised study plan from StudentTopicProgress + CoverageSnapshot.
 * Student only.
 */
const StudentTopicProgress = require("../models/StudentTopicProgress");
const CoverageSnapshot = require("../models/CoverageSnapshot");
const { normalizeSpecKey } = require("../config/featureFlags");
const { findBestLessonForTopicKey } = require("../services/enquiry/learningSuggestions");

function isStudent(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "student";
}

function topicKeyToTitle(topicKey) {
  if (!topicKey || typeof topicKey !== "string") return "Topic";
  const last = String(topicKey).split(":").pop();
  return last ? last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : topicKey;
}

async function buildPlanActions(topicKey, specKey) {
  const actions = [];
  const enc = encodeURIComponent(topicKey);
  const lesson = await findBestLessonForTopicKey(topicKey);
  const lessonId = lesson?._id ? String(lesson._id) : null;

  if (lessonId) {
    actions.push({ id: "view-lesson", label: "View lesson", href: `/lesson/${lessonId}` });
    actions.push({ id: "summarise", label: "Summarise topic", href: `/lesson/${lessonId}?openTopicSummary=1` });
    actions.push({ id: "practice", label: "Practice", href: `/lesson/${lessonId}#check-understanding` });
    actions.push({ id: "ask-ai", label: "Ask AI", href: `/lesson/${lessonId}` });
  } else {
    actions.push({ id: "view-lesson", label: "View lesson", href: `/browse-lessons?topicKey=${enc}` });
    actions.push({ id: "practice", label: "Practice", href: `/browse-lessons?topicKey=${enc}` });
  }
  return actions.slice(0, 4);
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

    const progressRows = await StudentTopicProgress.find({ userId, specKey: spec })
      .sort({ masteryScore: 1, "signals.lastActivityAt": -1 })
      .limit(50)
      .lean();

    const latestCoverage = await CoverageSnapshot.findOne({ specKey: spec }).sort({ computedAt: -1 }).lean();
    const coverageMap = new Map();
    let coverageRows = [];
    if (latestCoverage) {
      coverageRows = await CoverageSnapshot.find({ specKey: spec, computedAt: latestCoverage.computedAt }).lean();
      for (const r of coverageRows) {
        coverageMap.set(String(r.topicKey).trim(), r);
      }
    }

    let candidates = progressRows.map((p) => {
      const coverageRow = coverageMap.get(String(p.topicKey).trim()) || null;
      const coverageStatus = coverageRow?.status || "OK";
      const demandScore = coverageRow?.demandScore ?? 0;
      const masteryScore = p.masteryScore ?? 0;
      return {
        progress: p,
        coverageRow,
        coverageStatus,
        demandScore,
        masteryScore,
      };
    });

    // Prioritise: 1) low mastery + high demand, 2) low mastery + THIN/EMPTY, 3) recent weak AI
    candidates.sort((a, b) => {
      const weakA = (a.progress.signals?.weakAiEnquiries || 0) > 0 ? 1 : 0;
      const weakB = (b.progress.signals?.weakAiEnquiries || 0) > 0 ? 1 : 0;
      if (weakA !== weakB) return weakB - weakA;
      const thinA = ["THIN", "EMPTY", "NO_SPEC"].includes(a.coverageStatus) ? 1 : 0;
      const thinB = ["THIN", "EMPTY", "NO_SPEC"].includes(b.coverageStatus) ? 1 : 0;
      if (thinA !== thinB) return thinB - thinA;
      const demandA = a.demandScore >= 60 ? 1 : 0;
      const demandB = b.demandScore >= 60 ? 1 : 0;
      if (demandA !== demandB) return demandB - demandA;
      return a.masteryScore - b.masteryScore;
    });

    const limit = Math.min(5, Math.max(3, candidates.length));
    const selected = candidates.slice(0, limit);

    const plan = [];
    for (const { progress, coverageRow, coverageStatus, demandScore } of selected) {
      const topicKey = String(progress?.topicKey || "").trim();
      if (!topicKey) continue;
      const actions = await buildPlanActions(topicKey, spec);
      plan.push({
        topicKey,
        masteryScore: progress.masteryScore ?? 0,
        confidenceBand: progress.confidenceBand ?? "low",
        status: progress.status ?? "new",
        nextAction: progress.recommendations?.nextAction ?? "viewLesson",
        reason: progress.recommendations?.reason ?? "Consider revising this topic.",
        coverageStatus: coverageStatus,
        demandScore: demandScore ?? 0,
        actions,
      });
    }

    return res.json({
      specKey: spec,
      generatedAt: new Date().toISOString(),
      plan,
    });
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
