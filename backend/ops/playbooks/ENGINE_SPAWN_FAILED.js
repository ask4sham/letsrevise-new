// backend/ops/playbooks/ENGINE_SPAWN_FAILED.js — Phase 11.8
/** Condition: ENGINE_SPAWN_FAILED ≥5 min. Actions: enable kill-switch, open incident, notify admin. */

function eligibility(signalSnapshot, decision) {
  if (decision?.recommendedPlaybookId !== "ENGINE_SPAWN_FAILED") return false;
  const recent = signalSnapshot?.metrics?.recent || [];
  const spawnFailed = recent.filter((o) => o.errorCode === "ENGINE_SPAWN_FAILED").length;
  return spawnFailed >= 5;
}

const actions = [
  { type: "SET_KILL_SWITCH", payload: { kind: "revision", enabled: true } },
  { type: "OPEN_INCIDENT", payload: { type: "ENGINE_SPAWN_FAILED", severity: "high", title: "Engine spawn failed", details: "Kill-switch enabled by autopilot" } },
  { type: "NOTIFY_ADMIN", payload: { channel: "audit", message: "ENGINE_SPAWN_FAILED: kill-switch enabled" } },
];

function verification() {
  return { expectKillSwitchOn: true };
}

function escalation() {
  return [];
}

module.exports = { id: "ENGINE_SPAWN_FAILED", eligibility, actions, verification, escalation };
