/**
 * Autopilot Safety Foundation — S1 shared policy contract V1.
 * Future source of truth for safety vocabulary. NOT wired into A0 observers in S1.1.
 * Contract defaults only — no environment reads, no runtime config.
 */

const POLICY_VERSION = "autopilot-safety-policy-v1";

const TARGET_SNAPSHOT_VERSION = "autopilot-target-snapshot-v1";

const DEFAULT_PROPOSAL_VALIDITY_DAYS = 7;

/** Canonical L4 hard-boundary classes (union of A0.8 + A0.9; no weakening). */
const L4_POLICY_CLASSES = Object.freeze([
  "AUTOMATIC_CURRICULUM_PUBLISHING",
  "AUTOMATIC_QUESTION_PUBLISHING",
  "DESTRUCTIVE_PRODUCTION_DELETION",
  "IRREVERSIBLE_DESTRUCTIVE_MUTATION",
  "AUTOMATIC_MARKS_OR_GRADES",
  "AUTH_BILLING_OR_ROLE_MUTATION",
  "LOWERING_SAFEGUARDS",
]);

/** Documented alias — A0.8 name maps to canonical S1 class. */
const L4_POLICY_ALIASES = Object.freeze({
  AUTOMATIC_DESTRUCTIVE_PRODUCTION_DELETION: "DESTRUCTIVE_PRODUCTION_DELETION",
});

const STUDENT_IMPACTING_BLOCKERS = Object.freeze([
  "NO_STUDENT_SCOPE",
  "NO_AUTOPILOT_ACTION_AUDIT",
  "NO_IDEMPOTENCY",
  "NO_AUTOMATED_ROLLBACK",
  "STUDENT_IMPACTING",
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
  STUDENT_IMPACTING: {
    capability: "OWNED_FROZEN_TARGET_SCOPE",
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

const ADVISORY_READINESS_POLICY = Object.freeze({
  CONTINUE_CURRENT_PATH: {
    minimumPermissionLevel: "L0",
    readinessClassification: "NOT_AN_ACTION",
    blockingRequirements: [],
  },
  NO_FURTHER_WEAKNESS_OBSERVED: {
    minimumPermissionLevel: "L0",
    readinessClassification: "NOT_AN_ACTION",
    blockingRequirements: [],
  },
  INSUFFICIENT_EVIDENCE: {
    minimumPermissionLevel: "L0",
    readinessClassification: "NOT_AN_ACTION",
    blockingRequirements: [],
  },
  CONSIDER_RETEACH: {
    minimumPermissionLevel: "L2",
    readinessClassification: "REQUIRES_L2_PREPARATION",
    blockingRequirements: [...STUDENT_IMPACTING_BLOCKERS],
  },
  CONSIDER_MORE_PRACTICE: {
    minimumPermissionLevel: "L2",
    readinessClassification: "REQUIRES_L2_PREPARATION",
    blockingRequirements: [...STUDENT_IMPACTING_BLOCKERS],
  },
  CONSIDER_EXAM_PRACTICE: {
    minimumPermissionLevel: "L2",
    readinessClassification: "REQUIRES_L2_PREPARATION",
    blockingRequirements: [...STUDENT_IMPACTING_BLOCKERS, "ASSESSMENT_ADJACENT"],
  },
  CONSIDER_FLASHCARD_REVISION: {
    minimumPermissionLevel: "L2",
    readinessClassification: "REQUIRES_L2_PREPARATION",
    blockingRequirements: [...STUDENT_IMPACTING_BLOCKERS],
  },
  CONSIDER_QUESTION_REVIEW: {
    minimumPermissionLevel: "L3",
    readinessClassification: "REQUIRES_HUMAN_APPROVAL",
    blockingRequirements: [
      "CONTENT_MUTATION_RISK",
      "ASSESSMENT_SEMANTICS_RISK",
      "HUMAN_REVIEW_REQUIRED",
    ],
  },
});

/** S1.1 active proposal lifecycle states only. */
const S1_ACTIVE_PROPOSAL_STATES = Object.freeze([
  "PROPOSED",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
]);

/** Reserved for future execution/preparation phases — rejected by S1.1 schemas. */
const S1_RESERVED_FUTURE_STATES = Object.freeze([
  "PREPARED",
  "AWAITING_APPROVAL",
  "EXECUTING",
  "SUCCEEDED",
  "FAILED",
  "ROLLED_BACK",
  "ROLLBACK_FAILED",
]);

/** S1.1 active target type — observation only, zero student identifiers. */
const S1_ACTIVE_TARGET_TYPES = Object.freeze(["SPEC_TOPIC_OBSERVATION"]);

/** Documented reserved target types — not accepted by S1.1 schema. */
const S1_RESERVED_TARGET_TYPES = Object.freeze([
  "SINGLE_STUDENT",
  "EXPLICIT_STUDENT_LIST",
  "TEACHER_CLASS_SNAPSHOT",
  "ASSIGNMENT_COHORT",
  "TOPIC_COHORT_AUTO",
]);

/** S1.1 active action type — non-executable observation envelope only. */
const S1_ACTIVE_ACTION_TYPES = Object.freeze(["OBSERVER_DERIVED_PROPOSAL"]);

const PROPOSED_PAYLOAD_ENVELOPE_TYPE = "OBSERVATION_ONLY";

/** Contract defaults — all safety features disabled. Not read from environment. */
const AUTOPILOT_LEARNING_PROPOSALS_ENABLED = false;
const AUTOPILOT_LEARNING_APPROVALS_ENABLED = false;
const AUTOPILOT_LEARNING_EXECUTION_ENABLED = false;

/**
 * Future authority policy (documentation only in S1.1).
 * Admin approval of student-affecting proposals without teacher owner consent is NOT permitted.
 * Any exception requires an explicitly designed break-glass policy.
 */
const AUTHORITY_POLICY = Object.freeze({
  adminMayApproveStudentAffectingWithoutTeacherConsent: false,
  breakGlassRequiresExplicitPolicy: true,
});

const FORBIDDEN_TARGET_SNAPSHOT_FIELDS = Object.freeze([
  "studentId",
  "studentIds",
  "name",
  "email",
  "classPublicId",
  "ownerTeacherId",
]);

function isActiveProposalState(state) {
  return S1_ACTIVE_PROPOSAL_STATES.includes(state);
}

function isReservedFutureState(state) {
  return S1_RESERVED_FUTURE_STATES.includes(state);
}

function isActiveTargetType(targetType) {
  return S1_ACTIVE_TARGET_TYPES.includes(targetType);
}

function isActiveActionType(actionType) {
  return S1_ACTIVE_ACTION_TYPES.includes(actionType);
}

function resolveL4Alias(l4Class) {
  return L4_POLICY_ALIASES[l4Class] || l4Class;
}

function isCanonicalL4Class(l4Class) {
  const resolved = resolveL4Alias(l4Class);
  return L4_POLICY_CLASSES.includes(resolved);
}

module.exports = {
  POLICY_VERSION,
  TARGET_SNAPSHOT_VERSION,
  DEFAULT_PROPOSAL_VALIDITY_DAYS,
  L4_POLICY_CLASSES,
  L4_POLICY_ALIASES,
  STUDENT_IMPACTING_BLOCKERS,
  BLOCKER_RULES,
  ADVISORY_READINESS_POLICY,
  S1_ACTIVE_PROPOSAL_STATES,
  S1_RESERVED_FUTURE_STATES,
  S1_ACTIVE_TARGET_TYPES,
  S1_RESERVED_TARGET_TYPES,
  S1_ACTIVE_ACTION_TYPES,
  PROPOSED_PAYLOAD_ENVELOPE_TYPE,
  AUTOPILOT_LEARNING_PROPOSALS_ENABLED,
  AUTOPILOT_LEARNING_APPROVALS_ENABLED,
  AUTOPILOT_LEARNING_EXECUTION_ENABLED,
  AUTHORITY_POLICY,
  FORBIDDEN_TARGET_SNAPSHOT_FIELDS,
  isActiveProposalState,
  isReservedFutureState,
  isActiveTargetType,
  isActiveActionType,
  resolveL4Alias,
  isCanonicalL4Class,
};
