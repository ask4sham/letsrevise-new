// backend/ops/opsTick.js — Phase 11.7 Scheduler entry point
const opsSignals = require("../services/opsSignals");
const opsDecisionEngine = require("../services/opsDecisionEngine");
const opsActionExecutor = require("../services/opsActionExecutor");
const opsVerifier = require("../services/opsVerifier");
const opsTickLock = require("../services/opsTickLock");
const { AUTOMATION_LEVELS, DEFAULT_AUTOMATION_LEVEL } = require("../contracts/opsAutopilot.v1");
const path = require("path");
const fs = require("fs");

/** Safety cap: at most one action per tick, even if playbooks are edited later. */
const MAX_ACTIONS_PER_TICK = 1;

let currentAutomationLevel = process.env.OPS_AUTOPILOT_LEVEL || DEFAULT_AUTOMATION_LEVEL;
let manualKillSwitch = false;
let lastDecision = null;
let lastActionAt = null;

/** Dry-run: compute decision and log "would execute", but do not write config or open incidents. */
function isDryRun() {
  return process.env.OPS_DRY_RUN === "1" || process.env.OPS_DRY_RUN === "true";
}

function getAutomationLevel() {
  return currentAutomationLevel;
}

function setAutomationLevel(level) {
  if (Object.values(AUTOMATION_LEVELS).includes(level)) currentAutomationLevel = level;
}

function setManualKillSwitch(on) {
  manualKillSwitch = on === true;
}

function isManualKillSwitchOn() {
  return manualKillSwitch;
}

function getLastDecision() {
  return lastDecision;
}

function getLastActionAt() {
  return lastActionAt;
}

/** Load playbook by id from backend/ops/playbooks/. */
function loadPlaybook(playbookId) {
  try {
    const playbooksDir = path.resolve(__dirname, "playbooks");
    const files = fs.readdirSync(playbooksDir) || [];
    for (const f of files) {
      if (f.endsWith(".js")) {
        const mod = require(path.join(playbooksDir, f));
        if (mod.id === playbookId) return mod;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

/**
 * One tick: snapshot → decision → (if L1/L2 and allowed) execute first action of playbook → schedule verification.
 * Single-flight: acquires DB lock with TTL; if lock held, skips and logs.
 * Dry-run (OPS_DRY_RUN=1): computes decision and logs "would execute", does not write config or open incidents.
 * Returns { decision, actionResult?, playbookId?, skipped? }.
 */
async function runTick() {
  if (manualKillSwitch) {
    return { decision: null, skipped: "manual_kill_switch" };
  }

  const lockAcquired = await opsTickLock.acquireLock();
  if (!lockAcquired) {
    console.info("[ops-tick] skipped: lock held by another node (single-flight)");
    return { decision: null, skipped: "tick_lock" };
  }

  try {
    const signalSnapshot = opsSignals.getSignalSnapshot();
    const decision = opsDecisionEngine.run(signalSnapshot);
    lastDecision = decision;

    if (!decision) return { decision: null };

    if (currentAutomationLevel === AUTOMATION_LEVELS.L0) {
      return { decision, skipped: "L0_observe_only" };
    }

    if (opsDecisionEngine.isWithinHysteresis(decision.recommendedPlaybookId)) {
      return { decision, skipped: "hysteresis" };
    }

    const playbook = loadPlaybook(decision.recommendedPlaybookId);
    if (!playbook || !playbook.eligibility(signalSnapshot, decision)) {
      return { decision, skipped: "playbook_not_eligible" };
    }

    const actions = (playbook.actions || []).slice(0, MAX_ACTIONS_PER_TICK);
    if (actions.length === 0) return { decision, skipped: "no_actions" };

    const firstAction = actions[0];

    if (isDryRun()) {
      const dryRunPayload = {
        playbookId: decision.recommendedPlaybookId,
        actionType: firstAction.type,
        payload: firstAction.payload,
      };
      console.info("[ops-tick] dry-run: would execute", dryRunPayload);
      if (process.env.OPS_DRY_RUN_AUDIT === "1" || process.env.OPS_DRY_RUN_AUDIT === "true") {
        const OpsActionAudit = require("../models/OpsActionAudit");
        await OpsActionAudit.create({
          actionType: firstAction.type,
          payload: { dryRun: true, wouldHaveExecuted: firstAction.payload, playbookId: decision.recommendedPlaybookId, decisionId: decision.incidentType },
          decisionId: decision.incidentType,
          result: "DRY_RUN",
          afterSnapshot: { at: new Date().toISOString(), dryRunPayload },
        });
      }
      return {
        decision,
        actionResult: { success: true, result: "dry_run", dryRun: true },
        playbookId: decision.recommendedPlaybookId,
        skipped: "dry_run",
      };
    }

    const actionResult = await opsActionExecutor.execute(firstAction.type, firstAction.payload, {
      decisionId: decision.incidentType,
      incidentId: null,
    });

    lastActionAt = new Date();
    opsDecisionEngine.setHysteresisState(decision.recommendedPlaybookId);

    if (actionResult.success && playbook.verification) {
      const beforeSnapshot = opsSignals.getMetricsSnapshot();
      const verificationResult = await opsVerifier.verifyAfterAction(firstAction.type, beforeSnapshot, {
        delayMs: process.env.NODE_ENV === "test" ? 0 : undefined,
      });
      if (!verificationResult.improved && playbook.escalation && playbook.escalation.length > 0) {
        await opsVerifier.escalateIfNotImproved(decision.incidentType, decision.incidentType, verificationResult);
      }
    }

    return {
      decision,
      actionResult,
      playbookId: decision.recommendedPlaybookId,
    };
  } finally {
    await opsTickLock.releaseLock();
  }
}

module.exports = {
  runTick,
  getAutomationLevel,
  setAutomationLevel,
  setManualKillSwitch,
  isManualKillSwitchOn,
  getLastDecision,
  getLastActionAt,
  isDryRun,
};
