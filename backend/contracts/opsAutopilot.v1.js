// backend/contracts/opsAutopilot.v1.js — Phase 11 policy contract
// Hard allowlist, rate limits, cooldowns, verification rules. No autonomous actions beyond allowlist.

/** Automation level: L0 observe, L1 safe autopilot, L2 playbook autopilot, L3 human required */
const AUTOMATION_LEVELS = Object.freeze({
  L0: "L0",
  L1: "L1",
  L2: "L2",
  L3: "L3",
});

const DEFAULT_AUTOMATION_LEVEL = AUTOMATION_LEVELS.L1;

/** Hard allowlist of permitted action types. Deny unknown. */
const PERMITTED_ACTIONS = Object.freeze([
  "SET_ROLLOUT_PERCENT",
  "ENABLE_ALLOWLIST",
  "SET_KILL_SWITCH",
  "SET_REVISION_NO_FALLBACK",
  "OPEN_INCIDENT",
  "NOTIFY_ADMIN",
]);

/** Max actions per hour (across all types). */
const MAX_ACTIONS_PER_HOUR = 10;

/** Minimum seconds between actions of the same type. */
const MIN_COOLDOWN_SECONDS_BY_ACTION = Object.freeze({
  SET_ROLLOUT_PERCENT: 300,
  ENABLE_ALLOWLIST: 300,
  SET_KILL_SWITCH: 600,
  SET_REVISION_NO_FALLBACK: 300,
  OPEN_INCIDENT: 60,
  NOTIFY_ADMIN: 120,
});

/** Default cooldown when action not listed (seconds). */
const DEFAULT_COOLDOWN_SECONDS = 300;

/** Verification: after action, wait this many ms before re-snapshot. */
const VERIFICATION_DELAY_MS = 5 * 60 * 1000;

/** Hysteresis: signal must persist this many ms before firing (e.g. 5–10 min). */
const HysteresisMs = 5 * 60 * 1000;

/** High severity requires at least this many corroborating signals. */
const MIN_CORROBORATING_SIGNALS_FOR_HIGH = 2;

function isPermittedAction(actionType) {
  return PERMITTED_ACTIONS.includes(actionType);
}

function getCooldownSeconds(actionType) {
  return MIN_COOLDOWN_SECONDS_BY_ACTION[actionType] ?? DEFAULT_COOLDOWN_SECONDS;
}

module.exports = {
  AUTOMATION_LEVELS,
  DEFAULT_AUTOMATION_LEVEL,
  PERMITTED_ACTIONS,
  MAX_ACTIONS_PER_HOUR,
  MIN_COOLDOWN_SECONDS_BY_ACTION,
  DEFAULT_COOLDOWN_SECONDS,
  VERIFICATION_DELAY_MS,
  HysteresisMs,
  MIN_CORROBORATING_SIGNALS_FOR_HIGH,
  isPermittedAction,
  getCooldownSeconds,
};
