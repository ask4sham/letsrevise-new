// backend/services/opsDecisionEngine.js — Phase 11.2 Decision plane
const path = require("path");
const fs = require("fs");
const opsSignals = require("./opsSignals");
const { MIN_CORROBORATING_SIGNALS_FOR_HIGH, HysteresisMs } = require("../contracts/opsAutopilot.v1");

const SEVERITY_ORDER = { high: 3, medium: 2, low: 1 };

/** Load all rule modules from backend/ops/rules/*.rule.js */
function loadRules() {
  const rulesDir = path.resolve(__dirname, "../ops/rules");
  const rules = [];
  try {
    const files = fs.readdirSync(rulesDir) || [];
    for (const f of files) {
      if (f.endsWith(".rule.js")) {
        const mod = require(path.join(rulesDir, f));
        if (typeof mod.run === "function") rules.push(mod);
      }
    }
  } catch (e) {
    // no rules dir or read error
  }
  return rules;
}

const rules = loadRules();

/** Run all rules against signal snapshot; return array of { incidentType, severity, confidence, recommendedPlaybookId }. */
function runRules(signalSnapshot) {
  const results = [];
  for (const rule of rules) {
    try {
      const out = rule.run(signalSnapshot);
      if (out && out.incidentType) results.push(out);
    } catch (e) {
      // skip broken rule
    }
  }
  return results;
}

/** Select single decision: highest severity, then confidence. High severity requires >=2 corroborating signals. */
function selectDecision(ruleResults, signalSnapshot) {
  if (ruleResults.length === 0) return null;
  const alertsCount = (signalSnapshot?.alerts?.alerts || []).length;
  const corroborating = ruleResults.length >= 2 || (ruleResults.length >= 1 && alertsCount >= 2);
  const sorted = [...ruleResults].sort((a, b) => {
    const sev = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (sev !== 0) return sev;
    return (b.confidence || 0) - (a.confidence || 0);
  });
  const best = sorted[0];
  if (best.severity === "high" && !corroborating) {
    return {
      ...best,
      confidence: Math.min(best.confidence || 0.5, 0.6),
      requiresCorroboration: true,
    };
  }
  return best;
}

/** In-memory hysteresis: last decision and time. Caller can check before acting. */
let lastDecisionAt = null;
let lastDecisionPlaybookId = null;

function getHysteresisState() {
  return { lastDecisionAt, lastDecisionPlaybookId };
}

function setHysteresisState(playbookId) {
  lastDecisionAt = Date.now();
  lastDecisionPlaybookId = playbookId;
}

function isWithinHysteresis(playbookId) {
  if (!lastDecisionAt || lastDecisionPlaybookId !== playbookId) return false;
  return Date.now() - lastDecisionAt < HysteresisMs;
}

/**
 * Run decision engine: snapshot signals, run rules, return single Decision or null.
 * Decision = { incidentType, severity, confidence, recommendedPlaybookId, requiresCorroboration? }.
 */
function run(signalSnapshot) {
  const snapshot = signalSnapshot || opsSignals.getSignalSnapshot();
  const ruleResults = runRules(snapshot);
  const decision = selectDecision(ruleResults, snapshot);
  if (!decision) return null;
  return {
    ...decision,
    at: snapshot.at || new Date().toISOString(),
    signalSnapshot: { at: snapshot.at, alerts: snapshot.alerts, metrics: { attempts: snapshot.metrics?.attempts, completed: snapshot.metrics?.completed, lastCompletedAt: snapshot.metrics?.lastCompletedAt } },
  };
}

module.exports = {
  run,
  loadRules,
  runRules,
  selectDecision,
  getHysteresisState,
  setHysteresisState,
  isWithinHysteresis,
};
