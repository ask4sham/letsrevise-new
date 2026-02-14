// backend/services/opsVerifier.js — Phase 11.4 Verification loop
const { VERIFICATION_DELAY_MS } = require("../contracts/opsAutopilot.v1");
const opsSignals = require("./opsSignals");
const OpsIncident = require("../models/OpsIncident");
const OpsActionAudit = require("../models/OpsActionAudit");
const opsNotifier = require("./opsNotifier");
const { EVENT_TYPES } = require("../contracts/opsNotifications.v1");

/**
 * Wait fixed delay (ms). For testing, pass 0 or small value.
 */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Re-snapshot signals after delay and check improvement.
 * Improvement = error rate decreased and/or COMPLETED rate recovered (if applicable).
 */
async function verifyAfterAction(actionType, beforeSnapshot, options = {}) {
  const delayMs = options.delayMs ?? VERIFICATION_DELAY_MS;
  await wait(delayMs);
  const after = opsSignals.getSignalSnapshot();
  const metricsAfter = after.metrics || {};
  const metricsBefore = beforeSnapshot || {};

  const attemptsBefore = metricsBefore.attempts || 0;
  const completedBefore = metricsBefore.completed || 0;
  const attemptsAfter = metricsAfter.attempts || 0;
  const completedAfter = metricsAfter.completed || 0;

  const rateBefore = attemptsBefore > 0 ? completedBefore / attemptsBefore : 0;
  const rateAfter = attemptsAfter > 0 ? completedAfter / attemptsAfter : 0;

  const openaiBefore = (metricsBefore.byErrorCode || {});
  const openaiAfter = (metricsAfter.byErrorCode || {});
  let openaiCountBefore = 0;
  let openaiCountAfter = 0;
  for (const k of Object.keys(openaiBefore)) if (String(k).startsWith("OPENAI_")) openaiCountBefore += openaiBefore[k];
  for (const k of Object.keys(openaiAfter)) if (String(k).startsWith("OPENAI_")) openaiCountAfter += openaiAfter[k];

  const improved =
    rateAfter >= rateBefore &&
    openaiCountAfter <= openaiCountBefore + 2;

  return {
    improved,
    at: after.at,
    before: { attempts: attemptsBefore, completed: completedBefore },
    after: { attempts: attemptsAfter, completed: completedAfter },
    openaiCountBefore,
    openaiCountAfter,
  };
}

const ESCALATION_DEDUPE_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * If not improved: escalate severity, open incident (or append to existing OPEN same type in 2h), notify admin.
 * Returns { escalated, incidentId? }. Prevents spam: reuses OPEN incident of same type within window.
 */
async function escalateIfNotImproved(decisionId, incidentType, verificationResult, options = {}) {
  if (verificationResult.improved) return { escalated: false };
  const windowStart = new Date(Date.now() - ESCALATION_DEDUPE_WINDOW_MS);
  const existing = await OpsIncident.findOne({
    type: incidentType,
    status: "OPEN",
    createdAt: { $gte: windowStart },
  })
    .sort({ createdAt: -1 })
    .lean();

  let incidentId;
  if (existing) {
    await OpsIncident.updateOne(
      { _id: existing._id },
      {
        $push: {
          actionsTaken: {
            at: new Date(),
            decisionId,
            verificationResult,
            source: "escalation_append",
          },
        },
      }
    );
    incidentId = existing._id;
  } else {
    const incident = await OpsIncident.create({
      type: incidentType,
      severity: "high",
      status: "OPEN",
      title: `Escalation: ${incidentType} not improved after action`,
      details: JSON.stringify(verificationResult),
      decisionSnapshot: { decisionId, verificationResult },
    });
    incidentId = incident._id;
  }

  await OpsActionAudit.create({
    actionType: "NOTIFY_ADMIN",
    payload: { escalation: true, incidentType, incidentId, verificationResult },
    decisionId,
    incidentId,
    result: "SUCCESS",
    afterSnapshot: { at: new Date().toISOString() },
  });

  opsNotifier.notifySafe({
    type: EVENT_TYPES.INCIDENT_ESCALATED,
    incidentId,
    incidentType,
    severity: "high",
    decisionId,
    actionType: "escalation",
    result: "SUCCESS",
    verificationResult,
  }).catch(() => {});

  if (!existing) {
    opsNotifier.notifySafe({
      type: EVENT_TYPES.INCIDENT_OPENED,
      incidentId,
      incidentType,
      severity: "high",
      decisionId,
      title: `Escalation: ${incidentType} not improved after action`,
    }).catch(() => {});
  }

  return { escalated: true, incidentId };
}

module.exports = {
  wait,
  verifyAfterAction,
  escalateIfNotImproved,
};
