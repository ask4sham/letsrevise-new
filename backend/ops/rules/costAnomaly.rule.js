// backend/ops/rules/costAnomaly.rule.js — Phase 11.2
/** Cost or request volume anomaly. Phase 10 has no cost signal; rule returns null until signals exist. */

function run(signalSnapshot) {
  const costSignal = signalSnapshot?.costAnomaly;
  if (!costSignal || !costSignal.anomalyDetected) return null;
  return {
    incidentType: "COST_ANOMALY",
    severity: "high",
    confidence: costSignal.confidence ?? 0.5,
    recommendedPlaybookId: "COST_ANOMALY",
  };
}

module.exports = { run };
