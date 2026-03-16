/**
 * Study coach service — plan data extraction for reuse by dashboard.
 * Extracted from studyCoach.controller.
 */
const StudentTopicProgress = require("../models/StudentTopicProgress");
const CoverageSnapshot = require("../models/CoverageSnapshot");
const { normalizeSpecKey } = require("../config/featureFlags");
const { findBestLessonForTopicKey } = require("../services/enquiry/learningSuggestions");

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
 * Get study plan data for a student.
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @param {string} specKey
 * @returns {Promise<{ specKey: string, generatedAt: string, plan: Array }>}
 */
async function getPlanData(userId, specKey) {
  const spec = normalizeSpecKey(specKey);
  if (!spec) return { specKey: specKey || "", generatedAt: new Date().toISOString(), plan: [] };

  const progressRows = await StudentTopicProgress.find({ userId, specKey: spec })
    .sort({ masteryScore: 1, "signals.lastActivityAt": -1 })
    .limit(50)
    .lean();

  const latestCoverage = await CoverageSnapshot.findOne({ specKey: spec }).sort({ computedAt: -1 }).lean();
  const coverageMap = new Map();
  if (latestCoverage) {
    const coverageRows = await CoverageSnapshot.find({ specKey: spec, computedAt: latestCoverage.computedAt }).lean();
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
  for (const { progress, coverageStatus, demandScore } of selected) {
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
      coverageStatus,
      demandScore: demandScore ?? 0,
      actions,
    });
  }

  return {
    specKey: spec,
    generatedAt: new Date().toISOString(),
    plan,
  };
}

module.exports = { getPlanData, buildPlanActions };
