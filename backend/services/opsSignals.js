// backend/services/opsSignals.js — Phase 11.1 Data plane
// Consumes Phase 10 metrics/logs only. No new monitoring infrastructure.

const revisionMetrics = require("./revisionMetrics");

/**
 * Full metrics snapshot (Phase 10 revisionMetrics).
 */
function getMetricsSnapshot() {
  return revisionMetrics.getSnapshot();
}

/**
 * ErrorCode counts and rates (from snapshot). Rates = count / attempts or 0.
 */
function getErrorCodeRates() {
  const snap = revisionMetrics.getSnapshot();
  const total = snap.attempts || 1;
  const rates = {};
  for (const [code, count] of Object.entries(snap.byErrorCode || {})) {
    rates[code] = { count, rate: count / total };
  }
  return rates;
}

/**
 * COMPLETED vs STUB outcome rates.
 */
function getOutcomeRates() {
  const snap = revisionMetrics.getSnapshot();
  const total = snap.attempts || 1;
  return {
    completed: { count: snap.completed || 0, rate: (snap.completed || 0) / total },
    stub: { count: snap.stub || 0, rate: (snap.stub || 0) / total },
    total: snap.attempts || 0,
  };
}

/**
 * Health snapshot: DB (simple check), queue (none in Phase 10), OpenAI (inferred from recent outcomes).
 * No new infra; best-effort from existing signals.
 */
function getHealthSnapshot() {
  const snap = revisionMetrics.getSnapshot();
  const recent = snap.recent || [];
  const openaiFailures = recent.filter((o) => String(o.errorCode || "").startsWith("OPENAI_")).length;
  const completedInRecent = recent.filter((o) => o.status === "COMPLETED").length;
  let openaiReachability = "unknown";
  if (recent.length >= 5) {
    if (openaiFailures > completedInRecent) openaiReachability = "degraded";
    else if (completedInRecent > 0) openaiReachability = "ok";
  }
  return {
    db: "unknown",
    queue: "n/a",
    openaiReachability,
    lastCompletedAt: snap.lastCompletedAt,
    recentAttempts: recent.length,
  };
}

/**
 * Single snapshot object for the decision engine (metrics + alerts + health).
 */
function getSignalSnapshot() {
  const metrics = getMetricsSnapshot();
  const alerts = typeof revisionMetrics.evaluateAlerts === "function" ? revisionMetrics.evaluateAlerts() : { ok: true, alerts: [] };
  const errorCodeRates = getErrorCodeRates();
  const outcomeRates = getOutcomeRates();
  const health = getHealthSnapshot();
  return {
    at: new Date().toISOString(),
    metrics,
    alerts,
    errorCodeRates,
    outcomeRates,
    health,
  };
}

module.exports = {
  getMetricsSnapshot,
  getErrorCodeRates,
  getOutcomeRates,
  getHealthSnapshot,
  getSignalSnapshot,
};
