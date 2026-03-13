// backend/ops/rules/engineSpawnFailed.rule.js — Phase 11.2
/** ENGINE_SPAWN_FAILED spike in recent outcomes. */

const SPAWN_FAILED_RECENT_N = 100;
const SPAWN_FAILED_THRESHOLD = 5;

function run(signalSnapshot) {
  const recent = signalSnapshot?.metrics?.recent || [];
  const spawnFailed = recent.filter((o) => o.errorCode === "ENGINE_SPAWN_FAILED").length;
  if (spawnFailed < SPAWN_FAILED_THRESHOLD) return null;
  const alertPresent = (signalSnapshot?.alerts?.alerts || []).some((a) => a.id === "SPIKE_ENGINE_SPAWN_FAILED");
  return {
    incidentType: "ENGINE_SPAWN_FAILED",
    severity: "high",
    confidence: alertPresent ? 0.95 : 0.7,
    recommendedPlaybookId: "ENGINE_SPAWN_FAILED",
  };
}

module.exports = { run };
