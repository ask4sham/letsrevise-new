/**
 * @jest-environment node
 */
// S1.3 — verifies A0 observers consume canonical safety policy without behaviour drift.
const policy = require("../contracts/autopilotSafetyPolicy.v1");
const {
  ADVISORY_READINESS_POLICY,
  STUDENT_IMPACTING_BLOCKERS,
  A08_L4_RESPONSE_CLASSES,
  L4_POLICY_CLASSES: A08_L4_EXPORT,
  classifyAdvisoryReadiness,
} = require("../services/autopilot0/actionReadinessIntelligenceService");
const {
  BLOCKER_RULES,
  A09_L4_RESPONSE_CLASSES,
  L4_POLICY_CLASSES: A09_L4_EXPORT,
  buildExecutionContractFromBlockers,
} = require("../services/autopilot0/executionContractIntelligenceService");

const A08_LEGACY_L4 = Object.freeze([
  "AUTOMATIC_DESTRUCTIVE_PRODUCTION_DELETION",
  "AUTOMATIC_CURRICULUM_PUBLISHING",
  "AUTOMATIC_MARKS_OR_GRADES",
  "LOWERING_SAFEGUARDS",
  "AUTH_BILLING_OR_ROLE_MUTATION",
  "IRREVERSIBLE_DESTRUCTIVE_MUTATION",
]);

const A09_LEGACY_L4 = Object.freeze([
  "AUTOMATIC_CURRICULUM_PUBLISHING",
  "AUTOMATIC_QUESTION_PUBLISHING",
  "DESTRUCTIVE_PRODUCTION_DELETION",
  "AUTOMATIC_MARKS_OR_GRADES",
  "AUTH_BILLING_OR_ROLE_MUTATION",
  "LOWERING_SAFEGUARDS",
]);

const STUDENT_BLOCKERS = [
  "NO_STUDENT_SCOPE",
  "NO_AUTOPILOT_ACTION_AUDIT",
  "NO_IDEMPOTENCY",
  "NO_AUTOMATED_ROLLBACK",
  "STUDENT_IMPACTING",
];

describe("autopilotSafetyPolicyConvergence — S1.3", () => {
  test("A0.8 advisory policy is canonical S1 contract reference", () => {
    expect(ADVISORY_READINESS_POLICY).toBe(policy.ADVISORY_READINESS_POLICY);
  });

  test("A0.8 student-impacting blockers match canonical S1 contract", () => {
    expect(STUDENT_IMPACTING_BLOCKERS).toBe(policy.STUDENT_IMPACTING_BLOCKERS);
    expect([...STUDENT_IMPACTING_BLOCKERS]).toEqual([...policy.STUDENT_IMPACTING_BLOCKERS]);
  });

  test("A0.9 BLOCKER_RULES is canonical S1 contract reference", () => {
    expect(BLOCKER_RULES).toBe(policy.BLOCKER_RULES);
  });

  test("STUDENT_IMPACTING remains special-cased before BLOCKER_RULES lookup", () => {
    const { executionContract, missingCapabilities } = buildExecutionContractFromBlockers([
      "STUDENT_IMPACTING",
    ]);
    expect(executionContract.executionRisks).toEqual([
      "STUDENT_IMPACTING",
      "REQUIRES_OWNED_FROZEN_TARGET_SCOPE",
    ]);
    expect(missingCapabilities).toEqual([]);
  });

  test("unknown blocker remains fail-closed", () => {
    expect(() => buildExecutionContractFromBlockers(["UNKNOWN_BLOCKER_X"])).toThrow(
      /Unknown blocking requirement/
    );
    try {
      buildExecutionContractFromBlockers(["UNKNOWN_BLOCKER_X"]);
    } catch (err) {
      expect(err.code).toBe("UNKNOWN_BLOCKER");
    }
  });

  test("A0.8 legacy L4 response list remains exact", () => {
    expect([...A08_L4_RESPONSE_CLASSES]).toEqual([...A08_LEGACY_L4]);
    expect([...A08_L4_EXPORT]).toEqual([...A08_LEGACY_L4]);
  });

  test("A0.9 legacy L4 response list remains exact", () => {
    expect([...A09_L4_RESPONSE_CLASSES]).toEqual([...A09_LEGACY_L4]);
    expect([...A09_L4_EXPORT]).toEqual([...A09_LEGACY_L4]);
  });

  test.each(A08_LEGACY_L4)("A0.8 legacy L4 %s resolves into canonical S1 union", (l4Class) => {
    expect(policy.isCanonicalL4Class(l4Class)).toBe(true);
  });

  test.each(A09_LEGACY_L4)("A0.9 legacy L4 %s resolves into canonical S1 union", (l4Class) => {
    expect(policy.isCanonicalL4Class(l4Class)).toBe(true);
  });

  test("canonical blocker mappings preserve A0.9 student-impacting contract gaps", () => {
    const { executionContract, missingCapabilities } = buildExecutionContractFromBlockers(
      STUDENT_BLOCKERS
    );
    expect(executionContract.targetingReadiness).toBe("MISSING");
    expect(executionContract.auditReadiness).toBe("MISSING");
    expect(executionContract.idempotencyReadiness).toBe("MISSING");
    expect(executionContract.rollbackReadiness).toBe("MISSING");
    expect(executionContract.futurePilotEligible).toBe(false);
    expect(missingCapabilities).toEqual([
      "ACTION_IDEMPOTENCY_CONTRACT",
      "AUTOMATED_ROLLBACK_CONTRACT",
      "AUTOPILOT_ACTION_AUDIT",
      "TARGET_SCOPE_RESOLVER",
    ]);
  });

  test("advisory policy values unchanged for representative advisories", () => {
    expect(classifyAdvisoryReadiness("CONSIDER_MORE_PRACTICE")).toEqual({
      minimumPermissionLevel: "L2",
      readinessClassification: "REQUIRES_L2_PREPARATION",
      blockingRequirements: [...STUDENT_BLOCKERS],
    });
    expect(classifyAdvisoryReadiness("CONSIDER_QUESTION_REVIEW")).toEqual({
      minimumPermissionLevel: "L3",
      readinessClassification: "REQUIRES_HUMAN_APPROVAL",
      blockingRequirements: [
        "CONTENT_MUTATION_RISK",
        "ASSESSMENT_SEMANTICS_RISK",
        "HUMAN_REVIEW_REQUIRED",
      ],
    });
  });

  test("no execution or proposal enablement becomes true", () => {
    expect(policy.AUTOPILOT_LEARNING_PROPOSALS_ENABLED).toBe(false);
    expect(policy.AUTOPILOT_LEARNING_APPROVALS_ENABLED).toBe(false);
    expect(policy.AUTOPILOT_LEARNING_EXECUTION_ENABLED).toBe(false);
    expect(policy.POLICY_VERSION).toBe("autopilot-safety-policy-v1");
  });
});
