/**
 * Autopilot Outcomes — aggregation and analytics for admin dashboard.
 * Uses AutopilotRun, TopicFlashcard, TopicQuizQuestion, ExamQuestion.
 * No changes to generation, approval, or run logging.
 */
const AutopilotRun = require("../models/AutopilotRun");
const AutopilotPromptExperiment = require("../models/AutopilotPromptExperiment");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");

const AUTOPILOT_META = "metadata.generatedBy";
const AUTOPILOT_VALUE = "autopilot";
const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 50;

/**
 * Build date filter from days param.
 */
function dateFilter(days) {
  const d = typeof days === "number" && days > 0 ? days : DEFAULT_DAYS;
  const since = new Date();
  since.setDate(since.getDate() - d);
  return { createdAt: { $gte: since } };
}

/**
 * Get outcome summary: runs, generated counts, approved/rejected from content models.
 */
async function getAutopilotOutcomeSummary(filters = {}) {
  const { specKey, topicKey, days, limit } = filters;
  const since = dateFilter(days);
  const q = { ...since };
  if (specKey) q.specKey = new RegExp(`^${(specKey || "").replace(/-/g, "[-_]")}`, "i");
  if (topicKey) q.topicKey = new RegExp((topicKey || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  // Fetch all runs in date range for accurate totals (no limit on runs for aggregation)
  const runs = await AutopilotRun.find(q).sort({ createdAt: -1 }).lean();

  const totals = {
    runs: runs.length,
    dryRuns: runs.filter((r) => r.dryRun).length,
    liveRuns: runs.filter((r) => !r.dryRun).length,
    completedRuns: runs.filter((r) => r.status === "completed").length,
    partialRuns: runs.filter((r) => r.status === "partial").length,
    failedRuns: runs.filter((r) => r.status === "failed").length,
    generatedFlashcards: 0,
    generatedQuizzes: 0,
    generatedExamQuestions: 0,
    approvedItems: 0,
    rejectedItems: 0,
  };

  for (const r of runs) {
    const s = r.summary || {};
    totals.generatedFlashcards += s.generatedFlashcards || 0;
    totals.generatedQuizzes += s.generatedQuizzes || 0;
    totals.generatedExamQuestions += s.generatedExamQuestions || 0;
  }

  // Approved/rejected: only autopilot-generated items. Build model-specific queries.
  const baseAutopilot = { [AUTOPILOT_META]: AUTOPILOT_VALUE };
  const topicEscaped = (topicKey || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const specPattern = specKey ? (specKey || "").replace(/-/g, "[-_]") : null;

  function buildTopicFilter() {
    if (specKey && topicKey) return { topicKey: new RegExp(`^${specPattern}.*${topicEscaped}`, "i") };
    if (specKey) return { topicKey: new RegExp(`^${specPattern}`, "i") };
    if (topicKey) return { topicKey: new RegExp(topicEscaped, "i") };
    return {};
  }

  const topicFilter = buildTopicFilter();
  const fcQuery = { ...baseAutopilot, ...topicFilter };
  const qqQuery = { ...baseAutopilot, ...topicFilter };
  const eqQuery = { ...baseAutopilot, ...topicFilter };

  const [approvedFlashcards, rejectedFlashcards, approvedQuizzes, rejectedQuizzes, approvedExam, rejectedExam] =
    await Promise.all([
      TopicFlashcard.countDocuments({ ...fcQuery, status: "published" }),
      TopicFlashcard.countDocuments({ ...fcQuery, isArchived: true }),
      TopicQuizQuestion.countDocuments({ ...qqQuery, status: "published" }),
      TopicQuizQuestion.countDocuments({ ...qqQuery, isArchived: true }),
      ExamQuestion.countDocuments({ ...eqQuery, status: "published" }),
      ExamQuestion.countDocuments({ ...eqQuery, isArchived: true }),
    ]);

  totals.approvedItems = approvedFlashcards + approvedQuizzes + approvedExam;
  totals.rejectedItems = rejectedFlashcards + rejectedQuizzes + rejectedExam;

  const repeatedFailures = await getRepeatedAutopilotFailures({ ...filters, limit: 10 });
  const topCoverageLiftTopics = await getCoverageLiftSummary({ ...filters, limit: 10 });

  return {
    totals,
    repeatedFailures,
    topCoverageLiftTopics,
  };
}

/**
 * Get outcome summary for a spec.
 */
async function getAutopilotOutcomeBySpec(specKey, filters = {}) {
  return getAutopilotOutcomeSummary({ ...filters, specKey });
}

/**
 * Get outcome summary for a topic.
 */
async function getAutopilotOutcomeByTopic(specKey, topicKey, filters = {}) {
  const topicFull = topicKey && topicKey.includes(":") ? topicKey : `${specKey || ""}:${topicKey || ""}`.replace(/^:/, "");
  return getAutopilotOutcomeSummary({ ...filters, specKey, topicKey: topicFull });
}

/**
 * Get topics that repeatedly fail or get skipped.
 * Aggregates from AutopilotRun.topicResults.
 */
async function getRepeatedAutopilotFailures(filters = {}) {
  const { specKey, topicKey, days, limit } = filters;
  const since = dateFilter(days);
  const q = { ...since };
  if (specKey) q.specKey = new RegExp(`^${(specKey || "").replace(/-/g, "[-_]")}`, "i");
  if (topicKey) q.topicKey = new RegExp((topicKey || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const runs = await AutopilotRun.find(q).select("specKey topicKey topicResults").sort({ createdAt: -1 }).lean();

  const byTopic = {};
  for (const r of runs) {
    const results = r.topicResults || [];
    for (const tr of results) {
      const key = `${r.specKey || ""}::${tr.topicKey || ""}`;
      if (!byTopic[key]) {
        byTopic[key] = { specKey: r.specKey, topicKey: tr.topicKey, topicTitle: tr.topicTitle, failCount: 0, skipCount: 0, latestReason: null };
      }
      const actions = tr.executedActions || [];
      for (const a of actions) {
        if (a.status === "failed") {
          byTopic[key].failCount += 1;
          if (a.reason) byTopic[key].latestReason = a.reason;
        } else if (a.status === "skipped") {
          byTopic[key].skipCount += 1;
          if (!byTopic[key].latestReason && a.reason) byTopic[key].latestReason = a.reason;
        }
      }
    }
  }

  const list = Object.values(byTopic).filter((t) => t.failCount > 0 || t.skipCount > 0);
  list.sort((a, b) => b.failCount + b.skipCount - (a.failCount + a.skipCount));
  return list.slice(0, limit || 20);
}

/**
 * Get topics with coverage lift from run logs.
 * PREFERS true coverageLift when present (from coverageBefore/coverageAfter snapshots).
 * Falls back to estimated behavior only for legacy runs (no coverageLift stored).
 */
async function getCoverageLiftSummary(filters = {}) {
  const { specKey, topicKey, days, limit } = filters;
  const since = dateFilter(days);
  const q = { ...since };
  if (specKey) q.specKey = new RegExp(`^${(specKey || "").replace(/-/g, "[-_]")}`, "i");
  if (topicKey) q.topicKey = new RegExp((topicKey || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const runs = await AutopilotRun.find(q).select("specKey topicKey topicResults createdAt").sort({ createdAt: -1 }).lean();

  const byTopic = {};
  for (const r of runs) {
    const results = r.topicResults || [];
    for (const tr of results) {
      const key = `${r.specKey || ""}::${tr.topicKey || ""}`;
      if (!byTopic[key]) {
        const hasTrueLift = tr.coverageLift != null;
        const latestScore =
          (tr.coverageAfter?.score ?? tr.updatedCoverage?.score) ?? null;
        const latestStatus =
          (tr.coverageAfter?.status ?? tr.updatedCoverage?.status) ?? null;
        if (latestScore == null && !hasTrueLift) continue;

        byTopic[key] = {
          specKey: r.specKey,
          topicKey: tr.topicKey,
          topicTitle: tr.topicTitle,
          latestCoverageScore: latestScore,
          latestCoverageStatus: latestStatus,
          liftType: hasTrueLift ? "true" : "estimated",
          trueCoverageLift: hasTrueLift ? tr.coverageLift : undefined,
          estimatedCoverageLift: !hasTrueLift ? (tr.updatedCoverage?.score ?? null) : undefined,
        };
      }
    }
  }

  const list = Object.values(byTopic);
  list.sort((a, b) => (b.latestCoverageScore || 0) - (a.latestCoverageScore || 0));
  return list.slice(0, limit || 20);
}

/**
 * Get outcomes aggregated by prompt pack (from AutopilotRun).
 * Legacy runs without promptPackId are grouped as "unknown" when present.
 */
async function getOutcomesByPromptPack(filters = {}) {
  const { specKey, topicKey, days, limit = 20 } = filters;
  const since = dateFilter(days);
  const q = { ...since };
  if (specKey) q.specKey = new RegExp(`^${(specKey || "").replace(/-/g, "[-_]")}`, "i");
  if (topicKey) q.topicKey = new RegExp((topicKey || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const runs = await AutopilotRun.find(q)
    .select("specKey topicKey dryRun summary topicResults promptPackId promptPackVersion createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const byPack = {};
  for (const r of runs) {
    const id = r.promptPackId || "unknown";
    const version = r.promptPackVersion || "unknown";
    const key = `${id}::${version}`;
    if (!byPack[key]) {
      byPack[key] = {
        promptPackId: id,
        promptPackVersion: version,
        runs: 0,
        liveRuns: 0,
        generatedFlashcards: 0,
        generatedQuizzes: 0,
        generatedExamQuestions: 0,
        totalCoverageLift: 0,
        liftCount: 0,
      };
    }
    byPack[key].runs += 1;
    if (!r.dryRun) byPack[key].liveRuns += 1;
    const s = r.summary || {};
    byPack[key].generatedFlashcards += s.generatedFlashcards || 0;
    byPack[key].generatedQuizzes += s.generatedQuizzes || 0;
    byPack[key].generatedExamQuestions += s.generatedExamQuestions || 0;
    for (const tr of r.topicResults || []) {
      if (tr.coverageLift != null) {
        byPack[key].totalCoverageLift += tr.coverageLift;
        byPack[key].liftCount += 1;
      }
    }
  }

  const promptPacks = Object.values(byPack).map((p) => ({
    promptPackId: p.promptPackId,
    promptPackVersion: p.promptPackVersion,
    runs: p.runs,
    liveRuns: p.liveRuns,
    generatedFlashcards: p.generatedFlashcards,
    generatedQuizzes: p.generatedQuizzes,
    generatedExamQuestions: p.generatedExamQuestions,
    avgCoverageLift: p.liftCount > 0 ? Math.round((p.totalCoverageLift / p.liftCount) * 10) / 10 : null,
  }));
  promptPacks.sort((a, b) => (b.runs || 0) - (a.runs || 0));
  return { promptPacks: promptPacks.slice(0, limit) };
}

/**
 * Get experiment performance: runs, generated items, approved/rejected, approval rate, avg coverage lift per pack.
 * @param {string} experimentId - Experiment ID (from AutopilotPromptExperiment.experimentId)
 */
async function getExperimentPerformance(experimentId) {
  const experiment = await AutopilotPromptExperiment.findOne({ experimentId, status: { $in: ["active", "paused", "archived"] } }).lean();
  if (!experiment) return null;

  const packKeys = (experiment.promptPacks || []).map((p) => `${p.promptPackId}::${p.promptPackVersion}`);

  const runs = await AutopilotRun.find({ experimentId })
    .select("specKey topicKey dryRun summary topicResults promptPackId promptPackVersion createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const byPack = {};
  for (const key of packKeys) {
    const [id, version] = key.split("::");
    byPack[key] = {
      promptPackId: id,
      promptPackVersion: version,
      runs: 0,
      liveRuns: 0,
      generatedItems: 0,
      approvedItems: 0,
      rejectedItems: 0,
      totalCoverageLift: 0,
      liftCount: 0,
    };
  }

  for (const r of runs) {
    const id = r.promptPackId || "unknown";
    const version = r.promptPackVersion || "unknown";
    const key = `${id}::${version}`;
    if (!byPack[key]) byPack[key] = { promptPackId: id, promptPackVersion: version, runs: 0, liveRuns: 0, generatedItems: 0, approvedItems: 0, rejectedItems: 0, totalCoverageLift: 0, liftCount: 0 };
    byPack[key].runs += 1;
    if (!r.dryRun) byPack[key].liveRuns += 1;
    const s = r.summary || {};
    byPack[key].generatedItems += (s.generatedFlashcards || 0) + (s.generatedQuizzes || 0) + (s.generatedExamQuestions || 0);
    for (const tr of r.topicResults || []) {
      if (tr.coverageLift != null) {
        byPack[key].totalCoverageLift += tr.coverageLift;
        byPack[key].liftCount += 1;
      }
    }
  }

  const baseAutopilot = { "metadata.generatedBy": "autopilot" };
  for (const key of Object.keys(byPack)) {
    const [id, version] = key.split("::");
    const q = { ...baseAutopilot, "metadata.promptPackId": id, "metadata.promptPackVersion": version };
    const [approvedFc, rejectedFc, approvedQq, rejectedQq, approvedEq, rejectedEq] = await Promise.all([
      TopicFlashcard.countDocuments({ ...q, status: "published" }),
      TopicFlashcard.countDocuments({ ...q, isArchived: true }),
      TopicQuizQuestion.countDocuments({ ...q, status: "published" }),
      TopicQuizQuestion.countDocuments({ ...q, isArchived: true }),
      ExamQuestion.countDocuments({ ...q, status: "published" }),
      ExamQuestion.countDocuments({ ...q, isArchived: true }),
    ]);
    byPack[key].approvedItems = approvedFc + approvedQq + approvedEq;
    byPack[key].rejectedItems = rejectedFc + rejectedQq + rejectedEq;
  }

  const promptPacks = Object.values(byPack).map((p) => {
    const reviewed = p.approvedItems + p.rejectedItems;
    return {
      promptPackId: p.promptPackId,
      promptPackVersion: p.promptPackVersion,
      runs: p.runs,
      liveRuns: p.liveRuns,
      generatedItems: p.generatedItems,
      approvedItems: p.approvedItems,
      rejectedItems: p.rejectedItems,
      approvalRate: reviewed > 0 ? Math.round((p.approvedItems / reviewed) * 100) : null,
      avgCoverageLift: p.liftCount > 0 ? Math.round((p.totalCoverageLift / p.liftCount) * 10) / 10 : null,
    };
  });

  return {
    experimentId,
    label: experiment.label,
    description: experiment.description || "",
    status: experiment.status,
    promptPacks,
  };
}

module.exports = {
  getAutopilotOutcomeSummary,
  getAutopilotOutcomeBySpec,
  getAutopilotOutcomeByTopic,
  getRepeatedAutopilotFailures,
  getCoverageLiftSummary,
  getOutcomesByPromptPack,
  getExperimentPerformance,
};
