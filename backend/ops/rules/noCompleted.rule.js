// backend/ops/rules/noCompleted.rule.js — Phase 11.2
/** No COMPLETED revisions in last N hours while we have attempts (allowlist/rollout expected on). */

const ZERO_COMPLETED_HOURS = 2;

function run(signalSnapshot) {
  const metrics = signalSnapshot?.metrics || {};
  const attempts = metrics.attempts || 0;
  if (attempts === 0) return null;
  const lastCompletedAt = metrics.lastCompletedAt ? new Date(metrics.lastCompletedAt) : null;
  const cutoff = new Date(Date.now() - ZERO_COMPLETED_HOURS * 60 * 60 * 1000);
  if (lastCompletedAt && lastCompletedAt >= cutoff) return null;
  const alertPresent = (signalSnapshot?.alerts?.alerts || []).some((a) => a.id === "ZERO_COMPLETED_OVER_N_HOURS");
  return {
    incidentType: "NO_COMPLETED_WHILE_ENABLED",
    severity: "medium",
    confidence: alertPresent ? 0.85 : 0.5,
    recommendedPlaybookId: "NO_COMPLETED_WHILE_ENABLED",
  };
}

module.exports = { run };
