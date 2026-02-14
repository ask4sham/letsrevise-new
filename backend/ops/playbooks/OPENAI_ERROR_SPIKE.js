// backend/ops/playbooks/OPENAI_ERROR_SPIKE.js — Phase 11.8
/** Condition: OPENAI_* spike ≥10 min AND rollout > 0. Actions: reduce rollout to 1–5%; if unresolved → rollout 0 + open incident. */

function eligibility(signalSnapshot, decision) {
  if (decision?.recommendedPlaybookId !== "OPENAI_ERROR_SPIKE") return false;
  const recent = signalSnapshot?.metrics?.recent || [];
  const openaiCount = recent.filter((o) => String(o.errorCode || "").startsWith("OPENAI_")).length;
  if (openaiCount < 10) return false;
  const config = require("../../services/opsActionExecutor").readRevisionEngineConfig();
  const rollout = config.rolloutPercent ?? process.env.SLOTGEN_AI_ROLLOUT_PERCENT;
  const currentPercent = typeof rollout === "number" ? rollout : parseInt(rollout, 10);
  return !isNaN(currentPercent) && currentPercent > 0;
}

const actions = [
  { type: "SET_ROLLOUT_PERCENT", payload: { kind: "revision", percent: 5 } },
];

function verification(signalSnapshot, beforeSnapshot, afterSnapshot) {
  const after = afterSnapshot?.metrics || {};
  const openaiAfter = Object.entries(after.byErrorCode || {}).reduce(
    (s, [k, v]) => (String(k).startsWith("OPENAI_") ? s + v : s),
    0
  );
  return { expectReducedOpenai: true, openaiCountAfter: openaiAfter };
}

function escalation(decisionId, verificationResult) {
  return [
    { type: "SET_ROLLOUT_PERCENT", payload: { kind: "revision", percent: 0 } },
    { type: "OPEN_INCIDENT", payload: { type: "OPENAI_ERROR_SPIKE", severity: "high", title: "OPENAI spike unresolved", details: JSON.stringify(verificationResult) } },
  ];
}

module.exports = { id: "OPENAI_ERROR_SPIKE", eligibility, actions, verification, escalation };
