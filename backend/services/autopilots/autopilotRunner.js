/**
 * Content engine runner — orchestrates coverage → asset → quality → approval (isolated steps).
 * Manual trigger first; scheduling off unless CONTENT_ENGINE_SCHEDULE_ENABLED=true (future).
 */
const mongoose = require("mongoose");
const AutopilotRun = require("../../models/AutopilotRun");
const { runCoverageAutopilot } = require("./runCoverageAutopilot");
const { runAssetAutopilot } = require("./runAssetAutopilot");
const { runQualityAutopilot } = require("./runQualityAutopilot");
const { runApprovalAutopilot } = require("./runApprovalAutopilot");

const PHASES = ["coverage", "asset", "quality", "approval"];

function computeStatus(topicResults, hadError) {
  if (hadError) return "failed";
  const tr = topicResults || [];
  if (tr.length === 0) return "completed";
  const hasFailed = tr.some((t) => (t.executedActions || []).some((a) => a.status === "failed"));
  const hasGenerated = tr.some((t) =>
    (t.executedActions || []).some((a) => a.status === "generated" || a.status === "planned")
  );
  if (hasFailed && hasGenerated) return "partial";
  if (hasFailed) return "failed";
  if (hasGenerated) return "completed";
  /** Only skips / no-op: still a successful run */
  return "completed";
}

async function saveRun(payload) {
  try {
    await AutopilotRun.create(payload);
  } catch (e) {
    console.error("[content-engine] AutopilotRun create failed:", e?.message || e);
  }
}

/** Scheduling: no cron in repo; enable only when wiring a worker to call runContentEngine. */
const CONTENT_ENGINE_SCHEDULE_ENABLED = process.env.CONTENT_ENGINE_SCHEDULE_ENABLED === "true";

/**
 * @param {{ phase: string, specKey?: string, adminUserId: string, teacherName?: string, dryRun?: boolean, limit?: number, lessonLimit?: number, maxQualityItems?: number, approvalLimit?: number }} opts
 */
async function runContentEngine(opts) {
  const {
    phase,
    specKey = "all-specs",
    adminUserId,
    teacherName,
    dryRun = false,
    limit = 15,
    minPriorityScore = 30,
    lessonLimit = 40,
    maxQualityItems = 20,
    approvalLimit = 120,
  } = opts;

  const runId = new mongoose.Types.ObjectId();
  const validReviewerId = adminUserId && mongoose.Types.ObjectId.isValid(adminUserId) ? adminUserId : null;
  const specForQuery = specKey === "all-specs" ? undefined : specKey;

  let topicResults = [];
  let summary = {
    generatedFlashcards: null,
    generatedQuizzes: null,
    generatedExamQuestions: null,
    skippedActions: null,
    failedActions: null,
  };
  let hadError = false;

  try {
    if (phase === "coverage") {
      const r = await runCoverageAutopilot({
        specKey: specForQuery || "aqa-gcse-biology",
        adminUserId,
        teacherName,
        dryRun,
        limit,
        minPriorityScore,
        autopilotRunId: String(runId),
      });
      topicResults = r.topicResults || [];
      summary.generatedFlashcards = r.proposalsCreated;
      summary.skippedActions = r.skipped;
    } else if (phase === "asset") {
      const r = await runAssetAutopilot({
        specKey: specForQuery,
        adminUserId,
        dryRun,
        lessonLimit,
      });
      topicResults = r.topicResults || [];
      summary.generatedFlashcards = r.generated;
      summary.skippedActions = r.skipped;
      summary.failedActions = r.errors;
    } else if (phase === "quality") {
      const r = await runQualityAutopilot({ maxItems: maxQualityItems, specKey: specForQuery });
      topicResults = r.topicResults || [];
      summary.generatedFlashcards = r.improved;
      summary.skippedActions = r.skipped;
      summary.failedActions = r.errors;
    } else if (phase === "approval") {
      const r = await runApprovalAutopilot({ specKey: specForQuery, limit: approvalLimit });
      topicResults = r.topicResults || [];
      summary.generatedFlashcards = r.labeled;
    } else {
      throw new Error(`Unknown phase: ${phase}`);
    }
  } catch (e) {
    hadError = true;
    topicResults = [
      {
        topicKey: "_engine",
        topicTitle: "",
        executedActions: [{ type: phase, status: "failed", reason: e?.message || String(e) }],
      },
    ];
  }

  const status = computeStatus(topicResults, hadError);
  const failedCount = (topicResults || []).reduce(
    (n, tr) => n + (tr.executedActions || []).filter((a) => a.status === "failed").length,
    0
  );

  await saveRun({
    _id: runId,
    runType: "spec",
    contentEnginePhase: phase,
    specKey: specForQuery || "all-specs",
    topicKey: null,
    dryRun,
    triggeredByUserId: validReviewerId,
    triggeredByRole: "content_engine",
    status,
    plannedTopicCount: topicResults.length,
    executedTopicCount: topicResults.length,
    skippedTopicCount: summary.skippedActions,
    failedTopicCount: failedCount,
    summary,
    topicResults,
    errorMessage: hadError ? "phase_threw" : null,
  });

  return {
    runId: String(runId),
    phase,
    status,
    topicResults,
    summary,
  };
}

/**
 * Run safe pipeline in order: coverage → asset → quality → approval.
 * Failures are isolated; each step returns its own result object.
 */
async function runSafePipeline(opts) {
  const results = {};
  let anyFailed = false;

  for (const p of PHASES) {
    try {
      results[p] = await runContentEngine({ ...opts, phase: p });
      if (results[p].status === "failed") anyFailed = true;
    } catch (e) {
      anyFailed = true;
      results[p] = { ok: false, error: e?.message || String(e), status: "failed" };
    }
  }

  return { ok: !anyFailed, results };
}

module.exports = {
  runContentEngine,
  runSafePipeline,
  PHASES,
  CONTENT_ENGINE_SCHEDULE_ENABLED,
};
