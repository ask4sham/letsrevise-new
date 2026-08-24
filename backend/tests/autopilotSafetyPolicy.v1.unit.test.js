/**
 * @jest-environment node
 */
const policy = require("../contracts/autopilotSafetyPolicy.v1");

describe("autopilotSafetyPolicy.v1", () => {
  test("exact policy version", () => {
    expect(policy.POLICY_VERSION).toBe("autopilot-safety-policy-v1");
  });

  test("canonical L4 union (7 classes)", () => {
    expect(policy.L4_POLICY_CLASSES).toEqual([
      "AUTOMATIC_CURRICULUM_PUBLISHING",
      "AUTOMATIC_QUESTION_PUBLISHING",
      "DESTRUCTIVE_PRODUCTION_DELETION",
      "IRREVERSIBLE_DESTRUCTIVE_MUTATION",
      "AUTOMATIC_MARKS_OR_GRADES",
      "AUTH_BILLING_OR_ROLE_MUTATION",
      "LOWERING_SAFEGUARDS",
    ]);
    expect(policy.L4_POLICY_CLASSES).toHaveLength(7);
  });

  test("destructive-deletion alias resolves to canonical class", () => {
    expect(policy.L4_POLICY_ALIASES.AUTOMATIC_DESTRUCTIVE_PRODUCTION_DELETION).toBe(
      "DESTRUCTIVE_PRODUCTION_DELETION"
    );
    expect(policy.resolveL4Alias("AUTOMATIC_DESTRUCTIVE_PRODUCTION_DELETION")).toBe(
      "DESTRUCTIVE_PRODUCTION_DELETION"
    );
    expect(policy.isCanonicalL4Class("AUTOMATIC_DESTRUCTIVE_PRODUCTION_DELETION")).toBe(true);
  });

  test("no weakening of L4 set — includes A0.8-only and A0.9-only classes", () => {
    expect(policy.L4_POLICY_CLASSES).toContain("IRREVERSIBLE_DESTRUCTIVE_MUTATION");
    expect(policy.L4_POLICY_CLASSES).toContain("AUTOMATIC_QUESTION_PUBLISHING");
    expect(policy.L4_POLICY_CLASSES).toContain("DESTRUCTIVE_PRODUCTION_DELETION");
  });

  test("all safety feature defaults false", () => {
    expect(policy.AUTOPILOT_LEARNING_PROPOSALS_ENABLED).toBe(false);
    expect(policy.AUTOPILOT_LEARNING_APPROVALS_ENABLED).toBe(false);
    expect(policy.AUTOPILOT_LEARNING_EXECUTION_ENABLED).toBe(false);
  });

  test("active S1 states exact", () => {
    expect(policy.S1_ACTIVE_PROPOSAL_STATES).toEqual([
      "PROPOSED",
      "APPROVED",
      "REJECTED",
      "EXPIRED",
    ]);
  });

  test("reserved future states separated", () => {
    expect(policy.S1_RESERVED_FUTURE_STATES).toEqual([
      "PREPARED",
      "AWAITING_APPROVAL",
      "EXECUTING",
      "SUCCEEDED",
      "FAILED",
      "ROLLED_BACK",
      "ROLLBACK_FAILED",
    ]);
  });

  test("active and reserved states do not overlap", () => {
    const overlap = policy.S1_ACTIVE_PROPOSAL_STATES.filter((state) =>
      policy.S1_RESERVED_FUTURE_STATES.includes(state)
    );
    expect(overlap).toEqual([]);
  });

  test("only SPEC_TOPIC_OBSERVATION active target", () => {
    expect(policy.S1_ACTIVE_TARGET_TYPES).toEqual(["SPEC_TOPIC_OBSERVATION"]);
    expect(policy.isActiveTargetType("SPEC_TOPIC_OBSERVATION")).toBe(true);
    expect(policy.isActiveTargetType("SINGLE_STUDENT")).toBe(false);
  });

  test("OBSERVER_DERIVED_PROPOSAL only active action type", () => {
    expect(policy.S1_ACTIVE_ACTION_TYPES).toEqual(["OBSERVER_DERIVED_PROPOSAL"]);
    expect(policy.isActiveActionType("OBSERVER_DERIVED_PROPOSAL")).toBe(true);
    expect(policy.isActiveActionType("ASSIGN_FLASHCARDS")).toBe(false);
  });

  test("execution remains disabled", () => {
    expect(policy.AUTOPILOT_LEARNING_EXECUTION_ENABLED).toBe(false);
  });

  test("blocker/capability vocabulary present for future convergence", () => {
    expect(policy.STUDENT_IMPACTING_BLOCKERS).toContain("NO_IDEMPOTENCY");
    expect(policy.BLOCKER_RULES.NO_IDEMPOTENCY.capability).toBe("ACTION_IDEMPOTENCY_CONTRACT");
    expect(policy.ADVISORY_READINESS_POLICY.CONSIDER_FLASHCARD_REVISION.minimumPermissionLevel).toBe(
      "L2"
    );
  });

  test("authority policy defaults conservatively", () => {
    expect(policy.AUTHORITY_POLICY.adminMayApproveStudentAffectingWithoutTeacherConsent).toBe(false);
    expect(policy.AUTHORITY_POLICY.breakGlassRequiresExplicitPolicy).toBe(true);
  });

  test("default proposal validity is 7 days", () => {
    expect(policy.DEFAULT_PROPOSAL_VALIDITY_DAYS).toBe(7);
  });
});
