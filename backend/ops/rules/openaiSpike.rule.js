// backend/ops/rules/openaiSpike.rule.js — Phase 11.2
/** OPENAI_* spike in recent outcomes. */

const OPENAI_SPIKE_RECENT_N = 100;
const OPENAI_SPIKE_THRESHOLD = 15;

function run(signalSnapshot) {
  const recent = signalSnapshot?.metrics?.recent || [];
  const openaiFailures = recent.filter((o) => String(o.errorCode || "").startsWith("OPENAI_")).length;
  if (openaiFailures < OPENAI_SPIKE_THRESHOLD) return null;
  const alertPresent = (signalSnapshot?.alerts?.alerts || []).some((a) => a.id === "SPIKE_OPENAI_FAILURES");
  return {
    incidentType: "OPENAI_ERROR_SPIKE",
    severity: "high",
    confidence: alertPresent ? 0.9 : 0.6,
    recommendedPlaybookId: "OPENAI_ERROR_SPIKE",
  };
}

module.exports = { run };
