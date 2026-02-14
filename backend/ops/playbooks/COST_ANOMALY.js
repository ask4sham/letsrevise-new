// backend/ops/playbooks/COST_ANOMALY.js — Phase 11.8
/** Condition: abnormal cost or request volume spike. Actions: rollout → 0, open incident + notify. */

function eligibility(signalSnapshot, decision) {
  if (decision?.recommendedPlaybookId !== "COST_ANOMALY") return false;
  return true;
}

const actions = [
  { type: "SET_ROLLOUT_PERCENT", payload: { kind: "revision", percent: 0 } },
  { type: "OPEN_INCIDENT", payload: { type: "COST_ANOMALY", severity: "high", title: "Cost anomaly", details: "Rollout set to 0" } },
  { type: "NOTIFY_ADMIN", payload: { channel: "audit", message: "COST_ANOMALY: rollout set to 0" } },
];

function verification() {
  return { expectRolloutZero: true };
}

function escalation() {
  return [];
}

module.exports = { id: "COST_ANOMALY", eligibility, actions, verification, escalation };
