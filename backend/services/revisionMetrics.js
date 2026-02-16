// backend/services/revisionMetrics.js — Phase 10.1
// In-process counters and recent outcomes for revision generation.
// Read-only visibility; no control logic. Metrics reset on process restart (acceptable for Phase 10).

const MAX_RECENT = 500;

const state = {
  attempts: 0,
  completed: 0,
  stub: 0,
  byErrorCode: {},
  lastCompletedAt: null,
  recent: [],
};

function recordOutcome(payload) {
  const status = payload?.status ?? "STUB";
  const errorCode = payload?.errorCode ?? null;
  const at = new Date();

  state.attempts += 1;
  if (status === "COMPLETED") {
    state.completed += 1;
    state.lastCompletedAt = at;
  } else {
    state.stub += 1;
  }

  const code = errorCode || "NONE";
  state.byErrorCode[code] = (state.byErrorCode[code] || 0) + 1;

  state.recent.push({ status, errorCode: code, at: at.toISOString() });
  if (state.recent.length > MAX_RECENT) state.recent.shift();

  const logLine = {
    metric: "revision_outcome",
    status,
    errorCode: code,
    attempts: state.attempts,
    completed: state.completed,
    stub: state.stub,
  };
  console.info("[revision-metric]", JSON.stringify(logLine));
}

function getSnapshot() {
  const byErrorCode = { ...state.byErrorCode };
  return {
    attempts: state.attempts,
    completed: state.completed,
    stub: state.stub,
    byErrorCode,
    lastCompletedAt: state.lastCompletedAt ? state.lastCompletedAt.toISOString() : null,
    recentCount: state.recent.length,
    recent: state.recent.slice(-100),
  };
}

/** For alerting: counts in the last N outcomes matching a predicate. */
function countInRecent(n, predicate) {
  const slice = state.recent.slice(-n);
  return slice.filter(predicate).length;
}

/** Phase 10.2: Evaluate alert conditions. Returns { ok, alerts }. */
function evaluateAlerts(opts) {
  const recentN = opts?.recentN ?? 100;
  const spawnFailedThreshold = opts?.spawnFailedThreshold ?? 5;
  const openaiFailedThreshold = opts?.openaiFailedThreshold ?? 15;
  const zeroCompletedHours = opts?.zeroCompletedHours ?? 4;

  const alerts = [];

  const spawnFailedInRecent = countInRecent(recentN, (o) => o.errorCode === "ENGINE_SPAWN_FAILED");
  if (spawnFailedInRecent >= spawnFailedThreshold) {
    alerts.push({
      id: "SPIKE_ENGINE_SPAWN_FAILED",
      message: `${spawnFailedInRecent} ENGINE_SPAWN_FAILED in last ${recentN} outcomes`,
      runbookRef: "docs/ops/RUNBOOK_REVISION_ENGINE.md#spike-engine_spawn_failed",
    });
  }

  const openaiFailedInRecent = countInRecent(recentN, (o) =>
    String(o.errorCode).startsWith("OPENAI_")
  );
  if (openaiFailedInRecent >= openaiFailedThreshold) {
    alerts.push({
      id: "SPIKE_OPENAI_FAILURES",
      message: `${openaiFailedInRecent} OPENAI_* failures in last ${recentN} outcomes`,
      runbookRef: "docs/ops/RUNBOOK_REVISION_ENGINE.md#spike-openai_failures",
    });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - zeroCompletedHours * 60 * 60 * 1000);
  if (
    state.attempts > 0 &&
    (!state.lastCompletedAt || new Date(state.lastCompletedAt) < cutoff)
  ) {
    alerts.push({
      id: "ZERO_COMPLETED_OVER_N_HOURS",
      message: `No COMPLETED revision in last ${zeroCompletedHours}h (attempts: ${state.attempts})`,
      runbookRef: "docs/ops/RUNBOOK_REVISION_ENGINE.md#zero-completed",
    });
  }

  return {
    ok: alerts.length === 0,
    alerts,
  };
}

module.exports = {
  recordOutcome,
  getSnapshot,
  countInRecent,
  evaluateAlerts,
};
