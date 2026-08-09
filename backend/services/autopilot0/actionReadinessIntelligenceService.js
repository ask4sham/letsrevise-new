/**
 * Autopilot 0 — Safe Action Readiness Observer V1.
 * L0 read-only: policy classification over A0.7 grounded next-action advisories.
 * No writes. No L1 execution. No student targeting.
 */
const {
  buildGroundedNextActionIntelligence,
  DB_OPERATION_COUNT: A07_DB_OPERATION_COUNT,
} = require("./groundedNextActionIntelligenceService");
const {
  ADVISORY_READINESS_POLICY,
  STUDENT_IMPACTING_BLOCKERS,
} = require("../../contracts/autopilotSafetyPolicy.v1");

const VERSION = "autopilot0-action-readiness-intelligence-v1";
const LEVEL = "L0";

/** Documented DB operation count — delegated entirely to A0.7 (no additional queries). */
const DB_OPERATION_COUNT = A07_DB_OPERATION_COUNT;

/** A0.8 legacy response adapter — not the canonical S1 7-class union. */
const A08_L4_RESPONSE_CLASSES = Object.freeze([
  "AUTOMATIC_DESTRUCTIVE_PRODUCTION_DELETION",
  "AUTOMATIC_CURRICULUM_PUBLISHING",
  "AUTOMATIC_MARKS_OR_GRADES",
  "LOWERING_SAFEGUARDS",
  "AUTH_BILLING_OR_ROLE_MUTATION",
  "IRREVERSIBLE_DESTRUCTIVE_MUTATION",
]);

/** @deprecated Use A08_L4_RESPONSE_CLASSES — kept for existing test/export parity. */
const L4_POLICY_CLASSES = A08_L4_RESPONSE_CLASSES;

function classifyAdvisoryReadiness(advisoryAction) {
  const policy = ADVISORY_READINESS_POLICY[advisoryAction];
  if (!policy) {
    const err = new Error(`Unknown advisory action for readiness policy: ${advisoryAction}`);
    err.code = "UNKNOWN_ADVISORY_ACTION";
    throw err;
  }
  return {
    minimumPermissionLevel: policy.minimumPermissionLevel,
    readinessClassification: policy.readinessClassification,
    blockingRequirements: [...policy.blockingRequirements],
  };
}

function mapTopicReadinessRow(advisoryRow) {
  const readiness = classifyAdvisoryReadiness(advisoryRow.advisoryAction);
  return {
    topicKey: advisoryRow.topicKey,
    advisoryAction: advisoryRow.advisoryAction,
    observedOutcome: advisoryRow.observedOutcome ?? null,
    minimumPermissionLevel: readiness.minimumPermissionLevel,
    readinessClassification: readiness.readinessClassification,
    blockingRequirements: readiness.blockingRequirements,
  };
}

function computeReadinessSummary(topicReadiness) {
  const l1EligibleCount = topicReadiness.filter(
    (row) => row.readinessClassification === "SAFE_L1_CANDIDATE"
  ).length;

  if (topicReadiness.length === 0) {
    return { overallStatus: "UNKNOWN", humanReviewRequired: true, l1EligibleCount: 0 };
  }

  const hasAmber = topicReadiness.some(
    (row) =>
      row.readinessClassification === "REQUIRES_L2_PREPARATION" ||
      row.readinessClassification === "REQUIRES_HUMAN_APPROVAL"
  );
  if (hasAmber) {
    return { overallStatus: "AMBER", humanReviewRequired: true, l1EligibleCount };
  }

  const allGreen = topicReadiness.every(
    (row) =>
      row.advisoryAction === "CONTINUE_CURRENT_PATH" ||
      row.advisoryAction === "NO_FURTHER_WEAKNESS_OBSERVED"
  );
  if (allGreen) {
    return { overallStatus: "GREEN", humanReviewRequired: false, l1EligibleCount };
  }

  return { overallStatus: "UNKNOWN", humanReviewRequired: true, l1EligibleCount };
}

/**
 * @param {{ specKey: string, limit?: number, now?: Date|string|number }} opts
 */
async function buildActionReadinessIntelligence(opts = {}) {
  const a07Report = await buildGroundedNextActionIntelligence(opts);

  const topicReadiness = (a07Report.topicAdvisories || []).map(mapTopicReadinessRow);
  const summary = computeReadinessSummary(topicReadiness);

  return {
    version: VERSION,
    level: LEVEL,
    generatedAt: a07Report.generatedAt,
    cohort: a07Report.cohort,
    topicReadiness,
    policy: {
      currentAutopilotLevel: "L0",
      l1ExecutionEnabled: false,
      l4Classes: [...A08_L4_RESPONSE_CLASSES],
    },
    summary,
  };
}

module.exports = {
  VERSION,
  LEVEL,
  DB_OPERATION_COUNT,
  ADVISORY_READINESS_POLICY,
  A08_L4_RESPONSE_CLASSES,
  L4_POLICY_CLASSES,
  STUDENT_IMPACTING_BLOCKERS,
  classifyAdvisoryReadiness,
  mapTopicReadinessRow,
  computeReadinessSummary,
  buildActionReadinessIntelligence,
};
