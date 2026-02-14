// backend/ops/playbooks/NO_COMPLETED_WHILE_ENABLED.js — Phase 11.8
/** Condition: allowlist ON + rollout > 0 + no COMPLETED for 2h. Actions: open incident, emit diagnosis hints only. */

function eligibility(signalSnapshot, decision) {
  if (decision?.recommendedPlaybookId !== "NO_COMPLETED_WHILE_ENABLED") return false;
  const metrics = signalSnapshot?.metrics || {};
  if ((metrics.attempts || 0) === 0) return false;
  const lastCompletedAt = metrics.lastCompletedAt ? new Date(metrics.lastCompletedAt) : null;
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  return !lastCompletedAt || lastCompletedAt < twoHoursAgo;
}

const actions = [
  { type: "OPEN_INCIDENT", payload: { type: "NO_COMPLETED_WHILE_ENABLED", severity: "medium", title: "No COMPLETED revisions while enabled", details: "Check allowlist, rollout, FEATURE_SLOTGEN_AI, OPENAI_API_KEY" } },
];

function verification() {
  return { diagnosisOnly: true };
}

function escalation() {
  return [];
}

module.exports = { id: "NO_COMPLETED_WHILE_ENABLED", eligibility, actions, verification, escalation };
