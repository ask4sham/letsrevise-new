/**
 * Autopilot Safety Foundation — S1.2 runtime mutation gates.
 * Strict default-OFF semantics. Execution is never enabled via environment.
 */

function readStrictEnabledEnv(name) {
  const value = process.env[name];
  if (value === "1" || value === "true") {
    return true;
  }
  return false;
}

function isProposalsMutationEnabled() {
  return readStrictEnabledEnv("AUTOPILOT_LEARNING_PROPOSALS_ENABLED");
}

function isApprovalsMutationEnabled() {
  return readStrictEnabledEnv("AUTOPILOT_LEARNING_APPROVALS_ENABLED");
}

/** Execution is unconditionally false in S1.2 — no env may enable it. */
function isExecutionEnabled() {
  return false;
}

module.exports = {
  readStrictEnabledEnv,
  isProposalsMutationEnabled,
  isApprovalsMutationEnabled,
  isExecutionEnabled,
};
