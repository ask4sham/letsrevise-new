/**
 * @jest-environment node
 */
const provenance = require("../contracts/autopilotProposalProvenance.v1");
const {
  BLOCKING_REASONS,
  CLASSIFICATION_ELIGIBLE,
  CLASSIFICATION_NOT_ELIGIBLE,
  POLICY_VERSION,
} = require("../contracts/autopilotSafetyPreparationEligibility.v1");
const {
  POLICY_VERSION: SAFETY_POLICY_VERSION,
  TARGET_SNAPSHOT_VERSION,
  PROPOSED_PAYLOAD_ENVELOPE_TYPE,
} = require("../contracts/autopilotSafetyPolicy.v1");
const runtime = require("../config/autopilotSafetyRuntime");
const {
  deriveIdempotencyKey,
  deriveIdempotencyKeyS12,
  deriveObservationIdentityHash,
  buildCanonicalTargetSnapshotFields,
  computeTargetSnapshotHash,
  buildAdvisorySourceRef,
  buildCanonicalAcceptedCreateContent,
} = require("../services/autopilotSafety/idempotencyKey");
const {
  evaluatePreparationEligibility,
  isProvenanceBoundB2Proposal,
} = require("../services/autopilotSafety/preparationEligibility");

const SPEC = "aqa-gcse-biology";
const TOPIC = "aqa-gcse-biology:cell-structure";
const FIXED_EVALUATED_AT = "2026-08-15T08:00:00.000Z";

function sourceEvidenceAt(generatedAt, overrides = {}) {
  return provenance.canonicaliseEvidenceSnapshot({
    provenanceVersion: provenance.PROVENANCE_VERSION,
    sourceSystem: provenance.SOURCE_SYSTEM,
    sourceObserver: provenance.SOURCE_OBSERVER,
    sourceObserverVersion: provenance.SUPPORTED_SOURCE_OBSERVER_VERSIONS[0],
    sourcePolicyVersion: provenance.SUPPORTED_SOURCE_POLICY_VERSIONS[0],
    sourceGeneratedAt: generatedAt,
    sourceSpecKey: SPEC,
    sourceTopicKey: TOPIC,
    sourceAdvisoryAction: "CONSIDER_FLASHCARD_REVISION",
    readinessClassification: "REQUIRES_L2_PREPARATION",
    minimumPermissionLevel: "L2",
    blockingRequirements: ["NO_AUTOPILOT_ACTION_AUDIT", "NO_IDEMPOTENCY", "NO_AUTOMATED_ROLLBACK"],
    missingCapabilities: ["TARGET_SCOPE_RESOLVER"],
    executionContract: {
      auditReadiness: "MISSING",
      idempotencyReadiness: "MISSING",
      rollbackReadiness: "MISSING",
      targetingReadiness: "MISSING",
      approvalReadiness: "MISSING",
      futurePilotEligible: false,
      executionRisks: ["STUDENT_IMPACTING"],
    },
    ...overrides,
  });
}

function provenanceBundleAt(generatedAt, overrides = {}) {
  const sourceEvidence = sourceEvidenceAt(generatedAt, overrides);
  return {
    sourceEvidence,
    evidenceSnapshotHash: provenance.deriveEvidenceSnapshotHash(sourceEvidence),
  };
}

function buildB2ApprovedProposal(bundle, overrides = {}) {
  const observationIdentityHash = deriveObservationIdentityHash(bundle.sourceEvidence);
  const advisorySourceRef = buildAdvisorySourceRef(TOPIC, observationIdentityHash);
  const snapshotFields = buildCanonicalTargetSnapshotFields({
    specKey: SPEC,
    topicKey: TOPIC,
    advisoryAction: bundle.sourceEvidence.sourceAdvisoryAction,
    advisorySourceRef,
    evidenceCutoffAt: new Date(bundle.sourceEvidence.sourceGeneratedAt),
  });
  const targetSnapshot = {
    ...snapshotFields,
    targetSnapshotHash: computeTargetSnapshotHash(snapshotFields),
  };
  const idempotencyKey = deriveIdempotencyKey({
    specKey: SPEC,
    topicKey: TOPIC,
    advisoryAction: bundle.sourceEvidence.sourceAdvisoryAction,
    observationIdentityHash,
  });
  const approvalSnapshot = {
    targetSnapshot,
    proposedPayload: {
      envelopeType: PROPOSED_PAYLOAD_ENVELOPE_TYPE,
      observationNote: "Observation only",
    },
    policyVersion: SAFETY_POLICY_VERSION,
    minimumPermissionLevel: bundle.sourceEvidence.minimumPermissionLevel,
    advisorySource: {
      observer: bundle.sourceEvidence.sourceObserver,
      advisoryAction: bundle.sourceEvidence.sourceAdvisoryAction,
      specKey: SPEC,
      topicKey: TOPIC,
    },
    evidenceCutoffAt: targetSnapshot.evidenceCutoffAt,
    idempotencyKey,
    approvedAt: new Date("2026-08-10T12:00:00.000Z"),
    approverId: "507f1f77bcf86cd799439011",
    approverRole: "admin",
    expiresAt: new Date("2026-08-20T12:00:00.000Z"),
    sourceEvidence: bundle.sourceEvidence,
    evidenceSnapshotHash: bundle.evidenceSnapshotHash,
  };

  return {
    actionId: "approved-b2",
    status: "APPROVED",
    actionType: "OBSERVER_DERIVED_PROPOSAL",
    policyVersion: SAFETY_POLICY_VERSION,
    specKey: SPEC,
    topicKey: TOPIC,
    autopilotObserverVersion: bundle.sourceEvidence.sourceObserverVersion,
    minimumPermissionLevel: bundle.sourceEvidence.minimumPermissionLevel,
    advisorySource: approvalSnapshot.advisorySource,
    targetSnapshot,
    proposedPayload: approvalSnapshot.proposedPayload,
    idempotencyKey,
    sourceEvidence: bundle.sourceEvidence,
    evidenceSnapshotHash: bundle.evidenceSnapshotHash,
    approvalSnapshot,
    reviewedBy: "507f1f77bcf86cd799439011",
    reviewedAt: new Date("2026-08-10T12:00:00.000Z"),
    ...overrides,
  };
}

function buildHistoricalApprovedProposal() {
  const legacyInput = {
    specKey: "aqa_gcse_physics",
    topicKey: "P4.1.1",
    advisoryAction: "CONSIDER_FLASHCARD_REVISION",
    autopilotObserverVersion: "autopilot0-execution-contract-intelligence-v1",
    observer: "execution-contract-intelligence",
    advisorySourceRef: "observer-ref-001",
    evidenceCutoffAt: new Date("2026-08-01T12:00:00.000Z"),
    minimumPermissionLevel: "L2",
    observationNote: "Observation only",
  };
  const canonical = buildCanonicalAcceptedCreateContent(legacyInput);
  const idempotencyKey = deriveIdempotencyKeyS12({
    specKey: canonical.specKey,
    topicKey: canonical.topicKey,
    advisoryAction: canonical.advisoryAction,
    targetSnapshotHash: canonical.targetSnapshot.targetSnapshotHash,
    evidenceCutoffAt: legacyInput.evidenceCutoffAt,
  });
  const approvalSnapshot = {
    targetSnapshot: canonical.targetSnapshot,
    proposedPayload: canonical.proposedPayload,
    policyVersion: canonical.policyVersion,
    minimumPermissionLevel: canonical.minimumPermissionLevel,
    advisorySource: canonical.advisorySource,
    evidenceCutoffAt: canonical.targetSnapshot.evidenceCutoffAt,
    idempotencyKey,
    approvedAt: new Date("2026-08-02T12:00:00.000Z"),
    approverId: "507f1f77bcf86cd799439012",
    approverRole: "admin",
    expiresAt: new Date("2026-08-09T12:00:00.000Z"),
  };

  return {
    actionId: "approved-historical",
    status: "APPROVED",
    actionType: canonical.actionType,
    policyVersion: canonical.policyVersion,
    specKey: canonical.specKey,
    topicKey: canonical.topicKey,
    autopilotObserverVersion: canonical.autopilotObserverVersion,
    minimumPermissionLevel: canonical.minimumPermissionLevel,
    advisorySource: canonical.advisorySource,
    targetSnapshot: canonical.targetSnapshot,
    proposedPayload: canonical.proposedPayload,
    idempotencyKey,
    approvalSnapshot,
    reviewedBy: "507f1f77bcf86cd799439012",
    reviewedAt: new Date("2026-08-02T12:00:00.000Z"),
  };
}

function evaluate(proposal, overrides = {}) {
  return evaluatePreparationEligibility(proposal, {
    evaluatedAt: FIXED_EVALUATED_AT,
    ...overrides,
  });
}

describe("autopilotSafety preparation eligibility S1.5", () => {
  test("1. valid B2 APPROVED is ELIGIBLE_FOR_FUTURE_PREPARATION", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const result = evaluate(proposal);
    expect(result).toEqual({
      policyVersion: POLICY_VERSION,
      classification: CLASSIFICATION_ELIGIBLE,
      blockingReasons: [],
      evidenceAuthority: "approvalSnapshot",
      evaluatedAt: FIXED_EVALUATED_AT,
    });
  });

  test("2. historical pre-B2 APPROVED is NOT_ELIGIBLE / HISTORICAL_NO_PROVENANCE", () => {
    const proposal = buildHistoricalApprovedProposal();
    expect(isProvenanceBoundB2Proposal(proposal)).toBe(false);
    const result = evaluate(proposal);
    expect(result.classification).toBe(CLASSIFICATION_NOT_ELIGIBLE);
    expect(result.blockingReasons).toEqual([BLOCKING_REASONS.HISTORICAL_NO_PROVENANCE]);
  });

  test("3. B2 APPROVED missing both frozen provenance siblings → MISSING_FROZEN_PROVENANCE", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    delete proposal.approvalSnapshot.sourceEvidence;
    delete proposal.approvalSnapshot.evidenceSnapshotHash;
    const result = evaluate(proposal);
    expect(result.blockingReasons).toEqual([BLOCKING_REASONS.MISSING_FROZEN_PROVENANCE]);
  });

  test("4. only one frozen provenance sibling → INCOMPLETE_PROVENANCE_SIBLINGS", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    delete proposal.approvalSnapshot.evidenceSnapshotHash;
    const result = evaluate(proposal);
    expect(result.blockingReasons).toEqual([BLOCKING_REASONS.INCOMPLETE_PROVENANCE_SIBLINGS]);
  });

  test("5. corrupted frozen evidence hash → PROVENANCE_INTEGRITY_FAILURE", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposal.approvalSnapshot.evidenceSnapshotHash = `${"f".repeat(64)}`;
    const result = evaluate(proposal);
    expect(result.blockingReasons).toEqual([BLOCKING_REASONS.PROVENANCE_INTEGRITY_FAILURE]);
  });

  test("6. frozen provenance differs from proposal B2 provenance → SNAPSHOT_PROVENANCE_MISMATCH", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const alternate = provenanceBundleAt("2026-08-01T12:00:01.000Z");
    proposal.sourceEvidence = alternate.sourceEvidence;
    proposal.evidenceSnapshotHash = alternate.evidenceSnapshotHash;
    const result = evaluate(proposal);
    expect(result.blockingReasons).toContain(BLOCKING_REASONS.SNAPSHOT_PROVENANCE_MISMATCH);
  });

  test.each(["PROPOSED", "REJECTED", "EXPIRED"])(
    "7-9. %s → WRONG_LIFECYCLE_STATUS",
    (status) => {
      const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"), {
        status,
      });
      const result = evaluate(proposal);
      expect(result.blockingReasons).toEqual([BLOCKING_REASONS.WRONG_LIFECYCLE_STATUS]);
    }
  );

  test("10. NOT_AN_ACTION advisory → NOT_AN_ACTION_ADVISORY", () => {
    const bundle = provenanceBundleAt("2026-08-01T12:00:00.000Z", {
      sourceAdvisoryAction: "CONTINUE_CURRENT_PATH",
      readinessClassification: "NOT_AN_ACTION",
      minimumPermissionLevel: "L0",
      blockingRequirements: [],
    });
    const proposal = buildB2ApprovedProposal(bundle);
    const result = evaluate(proposal);
    expect(result.blockingReasons).toContain(BLOCKING_REASONS.NOT_AN_ACTION_ADVISORY);
  });

  test("11. unknown readiness → UNSUPPORTED_READINESS_CLASSIFICATION", () => {
    const bundle = provenanceBundleAt("2026-08-01T12:00:00.000Z", {
      readinessClassification: "UNKNOWN_CLASS",
    });
    const proposal = buildB2ApprovedProposal(bundle);
    const result = evaluate(proposal);
    expect(result.blockingReasons).toContain(
      BLOCKING_REASONS.UNSUPPORTED_READINESS_CLASSIFICATION
    );
  });

  test("12. wrong policyVersion → POLICY_VERSION_MISMATCH", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposal.approvalSnapshot.policyVersion = "autopilot-safety-policy-v0";
    const result = evaluate(proposal);
    expect(result.blockingReasons).toContain(BLOCKING_REASONS.POLICY_VERSION_MISMATCH);
  });

  test("13. wrong minimumPermissionLevel → PERMISSION_LEVEL_MISMATCH", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposal.approvalSnapshot.minimumPermissionLevel = "L0";
    const result = evaluate(proposal);
    expect(result.blockingReasons).toContain(BLOCKING_REASONS.PERMISSION_LEVEL_MISMATCH);
  });

  test("14. tampered target snapshot hash → TARGET_SNAPSHOT_INTEGRITY_FAILURE", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposal.approvalSnapshot.targetSnapshot.targetSnapshotHash = `${"a".repeat(64)}`;
    const result = evaluate(proposal);
    expect(result.blockingReasons).toContain(BLOCKING_REASONS.TARGET_SNAPSHOT_INTEGRITY_FAILURE);
  });

  test("15. frozen target snapshot differs from proposal target → TARGET_SNAPSHOT_MISMATCH", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposal.targetSnapshot = {
      ...proposal.targetSnapshot,
      advisoryAction: "CONSIDER_RETEACH",
    };
    const result = evaluate(proposal);
    expect(result.blockingReasons).toContain(BLOCKING_REASONS.TARGET_SNAPSHOT_MISMATCH);
  });

  test("16. wrong actionType → UNSUPPORTED_ACTION_TYPE", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"), {
      actionType: "MANUAL_OVERRIDE",
    });
    const result = evaluate(proposal);
    expect(result.blockingReasons).toContain(BLOCKING_REASONS.UNSUPPORTED_ACTION_TYPE);
  });

  test("17. wrong targetType → UNSUPPORTED_TARGET_TYPE", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposal.approvalSnapshot.targetSnapshot.targetType = "UNKNOWN_TARGET";
    const result = evaluate(proposal);
    expect(result.blockingReasons).toContain(BLOCKING_REASONS.UNSUPPORTED_TARGET_TYPE);
  });

  test("18. targetCount > 0 → NON_ZERO_TARGET_COUNT", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposal.approvalSnapshot.targetSnapshot.targetCount = 1;
    const result = evaluate(proposal);
    expect(result.blockingReasons).toContain(BLOCKING_REASONS.NON_ZERO_TARGET_COUNT);
  });

  test("19. student/class identifier present → STUDENT_CLASS_TARGET_FORBIDDEN", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposal.approvalSnapshot.targetSnapshot.studentId = "student-123";
    const result = evaluate(proposal);
    expect(result.blockingReasons).toContain(BLOCKING_REASONS.STUDENT_CLASS_TARGET_FORBIDDEN);
  });

  test("20. invalid B2 advisorySourceRef → UNSUPPORTED_ADVISORY_SOURCE_REF", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposal.approvalSnapshot.targetSnapshot.advisorySourceRef = "observer-ref-legacy";
    const result = evaluate(proposal);
    expect(result.blockingReasons).toContain(BLOCKING_REASONS.UNSUPPORTED_ADVISORY_SOURCE_REF);
  });

  test("21. explicit preparation-safety capability blocker → PLATFORM_CAPABILITY_BLOCKER", () => {
    const bundle = provenanceBundleAt("2026-08-01T12:00:00.000Z", {
      blockingRequirements: ["NO_STUDENT_SCOPE", "NO_AUTOPILOT_ACTION_AUDIT"],
    });
    const proposal = buildB2ApprovedProposal(bundle);
    const result = evaluate(proposal);
    expect(result.blockingReasons).toContain(BLOCKING_REASONS.PLATFORM_CAPABILITY_BLOCKER);
    expect(result.blockingReasons).not.toContain(BLOCKING_REASONS.NOT_AN_ACTION_ADVISORY);
  });

  test("21b. non-preparation blockers alone do not disqualify", () => {
    const bundle = provenanceBundleAt("2026-08-01T12:00:00.000Z", {
      blockingRequirements: ["NO_AUTOPILOT_ACTION_AUDIT", "NO_IDEMPOTENCY", "NO_AUTOMATED_ROLLBACK"],
    });
    const proposal = buildB2ApprovedProposal(bundle);
    const result = evaluate(proposal);
    expect(result.blockingReasons).not.toContain(BLOCKING_REASONS.PLATFORM_CAPABILITY_BLOCKER);
    expect(result.classification).toBe(CLASSIFICATION_ELIGIBLE);
  });

  test("22. isExecutionEnabled remains false (invariant PASS)", () => {
    expect(runtime.isExecutionEnabled()).toBe(false);
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const result = evaluate(proposal);
    expect(result.blockingReasons).not.toContain(BLOCKING_REASONS.EXECUTION_INVARIANT_FAILURE);
  });

  test("23. evaluator has no DB/A0.9/proposal mutation dependencies", () => {
    const serviceSource = require("fs").readFileSync(
      require("path").join(__dirname, "../services/autopilotSafety/preparationEligibility.js"),
      "utf8"
    );
    expect(serviceSource).not.toMatch(/mongoose|AutopilotActionProposal|provenanceVerification|approveProposal/);
  });

  test("24. input object remains unchanged after evaluation", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const before = JSON.stringify(proposal);
    evaluate(proposal);
    expect(JSON.stringify(proposal)).toBe(before);
  });

  test("25. fixed evaluatedAt produces deterministic deep-equal output", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const first = evaluate(proposal);
    const second = evaluate(proposal);
    expect(first).toEqual(second);
  });

  test("evaluatedAt is required", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    expect(() => evaluatePreparationEligibility(proposal, {})).toThrow(/evaluatedAt is required/);
  });

  test("missing approval snapshot returns only MISSING_APPROVAL_SNAPSHOT", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    delete proposal.approvalSnapshot;
    const result = evaluate(proposal);
    expect(result.blockingReasons).toEqual([BLOCKING_REASONS.MISSING_APPROVAL_SNAPSHOT]);
  });

  test("reserved student target type → STUDENT_CLASS_TARGET_FORBIDDEN", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposal.approvalSnapshot.targetSnapshot.targetType = "SINGLE_STUDENT";
    const result = evaluate(proposal);
    expect(result.blockingReasons).toContain(BLOCKING_REASONS.STUDENT_CLASS_TARGET_FORBIDDEN);
  });
});
