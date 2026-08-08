/**
 * Autopilot 0 — Execution Contract Intelligence Observer V1.
 * L0 read-only: execution-contract gap analysis over A0.8 action readiness.
 * No writes. No L1/L2 execution. No targeting. No preparation.
 */
const {
  buildActionReadinessIntelligence,
  DB_OPERATION_COUNT: A08_DB_OPERATION_COUNT,
} = require("./actionReadinessIntelligenceService");

const VERSION = "autopilot0-execution-contract-intelligence-v1";
const LEVEL = "L0";

/** Documented DB operation count — delegated entirely to A0.8/A0.7 (no additional queries). */
const DB_OPERATION_COUNT = A08_DB_OPERATION_COUNT;

const NOT_AN_ACTION_ADVISORIES = Object.freeze([
  "CONTINUE_CURRENT_PATH",
  "NO_FURTHER_WEAKNESS_OBSERVED",
  "INSUFFICIENT_EVIDENCE",
]);

const BLOCKER_RULES = Object.freeze({
  NO_STUDENT_SCOPE: {
    dimension: "targetingReadiness",
    capability: "TARGET_SCOPE_RESOLVER",
  },
  NO_AUTOPILOT_ACTION_AUDIT: {
    dimension: "auditReadiness",
    capability: "AUTOPILOT_ACTION_AUDIT",
  },
  NO_IDEMPOTENCY: {
    dimension: "idempotencyReadiness",
    capability: "ACTION_IDEMPOTENCY_CONTRACT",
  },
  NO_AUTOMATED_ROLLBACK: {
    dimension: "rollbackReadiness",
    capability: "AUTOMATED_ROLLBACK_CONTRACT",
  },
  ASSESSMENT_ADJACENT: {
    capability: "ASSESSMENT_EXECUTION_GUARD",
  },
  CONTENT_MUTATION_RISK: {
    dimension: "approvalReadiness",
    capability: "IMMUTABLE_APPROVAL_SNAPSHOT",
  },
  ASSESSMENT_SEMANTICS_RISK: {
    dimension: "approvalReadiness",
    capability: "ASSESSMENT_CHANGE_APPROVAL",
  },
  HUMAN_REVIEW_REQUIRED: {
    dimension: "approvalReadiness",
    capability: "HUMAN_APPROVAL_WORKFLOW",
  },
});

const L4_POLICY_CLASSES = Object.freeze([
  "AUTOMATIC_CURRICULUM_PUBLISHING",
  "AUTOMATIC_QUESTION_PUBLISHING",
  "DESTRUCTIVE_PRODUCTION_DELETION",
  "AUTOMATIC_MARKS_OR_GRADES",
  "AUTH_BILLING_OR_ROLE_MUTATION",
  "LOWERING_SAFEGUARDS",
]);

const EXECUTION_STATE_VOCABULARY = Object.freeze([
  "PROPOSED",
  "PREPARED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "EXECUTING",
  "SUCCEEDED",
  "FAILED",
  "REJECTED",
  "EXPIRED",
  "ROLLED_BACK",
  "ROLLBACK_FAILED",
]);

const INFRASTRUCTURE_PATTERNS = Object.freeze({
  auditPatterns: ["AdminAuditLog", "OpsActionAudit", "AutopilotRun", "LessonApproval"],
  idempotencyPatterns: ["PracticeSet", "LessonPurchase"],
  targetingPatterns: ["StudentTeacherLink", "StudentClass", "StudentClassMembership"],
  rollbackPatterns: ["assignment deactivation/close patterns"],
});

const RECOMMENDED_FUTURE_L2_PILOT = "CONSIDER_FLASHCARD_REVISION";

const NOT_APPLICABLE_CONTRACT = Object.freeze({
  auditReadiness: "NOT_APPLICABLE",
  idempotencyReadiness: "NOT_APPLICABLE",
  rollbackReadiness: "NOT_APPLICABLE",
  targetingReadiness: "NOT_APPLICABLE",
  approvalReadiness: "NOT_APPLICABLE",
  futurePilotEligible: false,
  executionRisks: [],
});

function isNotAnAction(advisoryAction) {
  return NOT_AN_ACTION_ADVISORIES.includes(advisoryAction);
}

function buildExecutionContractFromBlockers(blockingRequirements) {
  const executionContract = {
    auditReadiness: "MISSING",
    idempotencyReadiness: "MISSING",
    rollbackReadiness: "MISSING",
    targetingReadiness: "MISSING",
    approvalReadiness: "MISSING",
    futurePilotEligible: false,
    executionRisks: [],
  };

  const capabilities = new Set();

  for (const blocker of blockingRequirements || []) {
    if (blocker === "STUDENT_IMPACTING") {
      executionContract.executionRisks.push("STUDENT_IMPACTING");
      executionContract.executionRisks.push("REQUIRES_OWNED_FROZEN_TARGET_SCOPE");
      continue;
    }

    const rule = BLOCKER_RULES[blocker];
    if (!rule) {
      const err = new Error(`Unknown blocking requirement for execution contract: ${blocker}`);
      err.code = "UNKNOWN_BLOCKER";
      throw err;
    }

    if (rule.dimension) {
      executionContract[rule.dimension] = "MISSING";
    }
    if (rule.capability) {
      capabilities.add(rule.capability);
    }
  }

  executionContract.executionRisks = [...new Set(executionContract.executionRisks)];

  return {
    executionContract,
    missingCapabilities: [...capabilities].sort(),
  };
}

function mapTopicExecutionReadinessRow(topicReadinessRow) {
  if (isNotAnAction(topicReadinessRow.advisoryAction)) {
    return {
      topicKey: topicReadinessRow.topicKey,
      advisoryAction: topicReadinessRow.advisoryAction,
      observedOutcome: topicReadinessRow.observedOutcome ?? null,
      readinessClassification: topicReadinessRow.readinessClassification,
      minimumPermissionLevel: topicReadinessRow.minimumPermissionLevel,
      executionContract: { ...NOT_APPLICABLE_CONTRACT, executionRisks: [] },
      missingCapabilities: [],
    };
  }

  const { executionContract, missingCapabilities } = buildExecutionContractFromBlockers(
    topicReadinessRow.blockingRequirements
  );

  return {
    topicKey: topicReadinessRow.topicKey,
    advisoryAction: topicReadinessRow.advisoryAction,
    observedOutcome: topicReadinessRow.observedOutcome ?? null,
    readinessClassification: topicReadinessRow.readinessClassification,
    minimumPermissionLevel: topicReadinessRow.minimumPermissionLevel,
    executionContract,
    missingCapabilities,
  };
}

function computeExecutionContractSummary(topicExecutionReadiness) {
  const futurePilotEligibleCount = topicExecutionReadiness.filter(
    (row) => row.executionContract.futurePilotEligible === true
  ).length;

  return { futurePilotEligibleCount };
}

/**
 * @param {{ specKey: string, limit?: number, now?: Date|string|number }} opts
 */
async function buildExecutionContractIntelligence(opts = {}) {
  const a08Report = await buildActionReadinessIntelligence(opts);

  const topicExecutionReadiness = (a08Report.topicReadiness || []).map(mapTopicExecutionReadinessRow);
  const summary = computeExecutionContractSummary(topicExecutionReadiness);

  return {
    version: VERSION,
    level: LEVEL,
    generatedAt: a08Report.generatedAt,
    cohort: a08Report.cohort,
    topicExecutionReadiness,
    policy: {
      currentAutopilotLevel: "L0",
      executionEnabled: false,
      l1ExecutionEnabled: false,
      l2PreparationEnabled: false,
      recommendedFutureL2Pilot: RECOMMENDED_FUTURE_L2_PILOT,
      executionStateVocabulary: [...EXECUTION_STATE_VOCABULARY],
      l4Classes: [...L4_POLICY_CLASSES],
      infrastructurePatterns: {
        auditPatterns: [...INFRASTRUCTURE_PATTERNS.auditPatterns],
        idempotencyPatterns: [...INFRASTRUCTURE_PATTERNS.idempotencyPatterns],
        targetingPatterns: [...INFRASTRUCTURE_PATTERNS.targetingPatterns],
        rollbackPatterns: [...INFRASTRUCTURE_PATTERNS.rollbackPatterns],
      },
    },
    summary,
  };
}

module.exports = {
  VERSION,
  LEVEL,
  DB_OPERATION_COUNT,
  NOT_AN_ACTION_ADVISORIES,
  BLOCKER_RULES,
  L4_POLICY_CLASSES,
  EXECUTION_STATE_VOCABULARY,
  INFRASTRUCTURE_PATTERNS,
  RECOMMENDED_FUTURE_L2_PILOT,
  isNotAnAction,
  buildExecutionContractFromBlockers,
  mapTopicExecutionReadinessRow,
  computeExecutionContractSummary,
  buildExecutionContractIntelligence,
};
