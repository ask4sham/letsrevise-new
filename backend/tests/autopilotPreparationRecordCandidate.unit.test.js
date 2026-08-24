/**
 * @jest-environment node
 */
const provenance = require("../contracts/autopilotProposalProvenance.v1");
const { CLASSIFICATION_ELIGIBLE } = require("../contracts/autopilotSafetyPreparationEligibility.v1");
const {
  PREPARATION_RECORD_CANDIDATE_POLICY_VERSION,
  PREPARATION_AUTHORITY_SNAPSHOT_VERSION,
  PreparationRecordCandidateError,
} = require("../contracts/autopilotPreparationRecordCandidate.v1");
const {
  POLICY_VERSION: SAFETY_POLICY_VERSION,
  PROPOSED_PAYLOAD_ENVELOPE_TYPE,
} = require("../contracts/autopilotSafetyPolicy.v1");
const {
  deriveIdempotencyKey,
  deriveObservationIdentityHash,
  buildCanonicalTargetSnapshotFields,
  computeTargetSnapshotHash,
  buildAdvisorySourceRef,
  buildCanonicalAcceptedCreateContent,
  deriveIdempotencyKeyS12,
} = require("../services/autopilotSafety/idempotencyKey");
const {
  buildPreparationRecordCandidate,
  derivePreparationAuthoritySnapshotHash,
  deriveEligibilityAuditHash,
  deriveEligibilitySemanticHash,
  derivePreparationRecordSemanticIdentityHash,
} = require("../services/autopilotPreparation/buildPreparationRecordCandidate");

const SPEC = "aqa-gcse-biology";
const TOPIC = "aqa-gcse-biology:cell-structure";
const EVALUATED_AT_T1 = "2026-08-15T08:00:00.000Z";
const EVALUATED_AT_T2 = "2026-08-15T09:00:00.000Z";

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
  const legacyIdempotencyKey = deriveIdempotencyKeyS12({
    specKey: canonical.specKey,
    topicKey: canonical.topicKey,
    advisoryAction: canonical.advisoryAction,
    targetSnapshotHash: canonical.targetSnapshot.targetSnapshotHash,
    evidenceCutoffAt: legacyInput.evidenceCutoffAt,
  });
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
    idempotencyKey: legacyIdempotencyKey,
    approvalSnapshot: {
      targetSnapshot: canonical.targetSnapshot,
      proposedPayload: canonical.proposedPayload,
      policyVersion: canonical.policyVersion,
      minimumPermissionLevel: canonical.minimumPermissionLevel,
      advisorySource: canonical.advisorySource,
      evidenceCutoffAt: canonical.targetSnapshot.evidenceCutoffAt,
      idempotencyKey: legacyIdempotencyKey,
      approvedAt: new Date("2026-08-02T12:00:00.000Z"),
      approverId: "507f1f77bcf86cd799439012",
      approverRole: "admin",
      expiresAt: new Date("2026-08-09T12:00:00.000Z"),
    },
    reviewedBy: "507f1f77bcf86cd799439012",
    reviewedAt: new Date("2026-08-02T12:00:00.000Z"),
  };
}

describe("autopilot preparation record candidate P1.1", () => {
  test("eligible APPROVED proposal produces deterministic candidate", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const candidate = buildPreparationRecordCandidate(proposal, { evaluatedAt: EVALUATED_AT_T1 });

    expect(candidate.policyVersion).toBe(PREPARATION_RECORD_CANDIDATE_POLICY_VERSION);
    expect(candidate.actionId).toBe("approved-b2");
    expect(candidate.preparationAuthoritySnapshot.preparationAuthoritySnapshotVersion).toBe(
      PREPARATION_AUTHORITY_SNAPSHOT_VERSION
    );
    expect(candidate.eligibilitySnapshot.classification).toBe(CLASSIFICATION_ELIGIBLE);
    expect(candidate.eligibilitySnapshot.evidenceAuthority).toBe("approvalSnapshot");
    expect(candidate.eligibilitySnapshot.evaluatedAt).toBe(EVALUATED_AT_T1);
    expect(candidate.preparationAuthoritySnapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(candidate.eligibilityAuditHash).toMatch(/^[a-f0-9]{64}$/);
    expect(candidate.eligibilitySemanticHash).toMatch(/^[a-f0-9]{64}$/);
    expect(candidate.preparationRecordSemanticIdentityHash).toMatch(/^[a-f0-9]{64}$/);
    expect(candidate).not.toHaveProperty("preparationAuthorized");
    expect(candidate).not.toHaveProperty("preparationPlanEnvelope");
    expect(candidate).not.toHaveProperty("preparationId");
  });

  test("NOT_ELIGIBLE fails closed with no candidate", () => {
    const proposal = buildHistoricalApprovedProposal();
    expect(() =>
      buildPreparationRecordCandidate(proposal, { evaluatedAt: EVALUATED_AT_T1 })
    ).toThrow(
      expect.objectContaining({
        code: "NOT_ELIGIBLE",
        details: expect.objectContaining({
          blockingReasons: expect.arrayContaining(["HISTORICAL_NO_PROVENANCE"]),
        }),
      })
    );
    expect(PreparationRecordCandidateError).toBeDefined();
  });

  test("platform capability blocker fails closed", () => {
    const bundle = provenanceBundleAt("2026-08-01T12:00:00.000Z", {
      blockingRequirements: ["NO_STUDENT_SCOPE"],
    });
    const proposal = buildB2ApprovedProposal(bundle);
    expect(() =>
      buildPreparationRecordCandidate(proposal, { evaluatedAt: EVALUATED_AT_T1 })
    ).toThrow(expect.objectContaining({ code: "NOT_ELIGIBLE" }));
  });

  test("authority hash is deterministic", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const first = buildPreparationRecordCandidate(proposal, { evaluatedAt: EVALUATED_AT_T1 });
    const second = buildPreparationRecordCandidate(proposal, { evaluatedAt: EVALUATED_AT_T1 });
    expect(first.preparationAuthoritySnapshotHash).toBe(second.preparationAuthoritySnapshotHash);
    expect(first).toEqual(second);
  });

  test("same frozen authority with later evaluatedAt keeps semantic identity", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const atT1 = buildPreparationRecordCandidate(proposal, { evaluatedAt: EVALUATED_AT_T1 });
    const atT2 = buildPreparationRecordCandidate(proposal, { evaluatedAt: EVALUATED_AT_T2 });

    expect(atT1.preparationAuthoritySnapshotHash).toBe(atT2.preparationAuthoritySnapshotHash);
    expect(atT1.eligibilitySemanticHash).toBe(atT2.eligibilitySemanticHash);
    expect(atT1.preparationRecordSemanticIdentityHash).toBe(atT2.preparationRecordSemanticIdentityHash);
    expect(atT1.eligibilityAuditHash).not.toBe(atT2.eligibilityAuditHash);
    expect(atT1.eligibilitySnapshot.evaluatedAt).toBe(EVALUATED_AT_T1);
    expect(atT2.eligibilitySnapshot.evaluatedAt).toBe(EVALUATED_AT_T2);
  });

  test("changed authority produces different semantic identity", () => {
    const proposalA = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const proposalB = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposalB.approvalSnapshot.targetSnapshot.advisoryAction = "CONSIDER_RETEACH";
    proposalB.targetSnapshot.advisoryAction = "CONSIDER_RETEACH";

    const candidateA = buildPreparationRecordCandidate(proposalA, { evaluatedAt: EVALUATED_AT_T1 });
    expect(() =>
      buildPreparationRecordCandidate(proposalB, { evaluatedAt: EVALUATED_AT_T1 })
    ).toThrow(expect.objectContaining({ code: "NOT_ELIGIBLE" }));

    expect(candidateA.preparationRecordSemanticIdentityHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("substantive authority change on eligible proposal changes semantic identity", () => {
    const bundleA = provenanceBundleAt("2026-08-01T12:00:00.000Z");
    const bundleB = provenanceBundleAt("2026-08-01T12:00:01.000Z");
    const proposalA = buildB2ApprovedProposal(bundleA);
    const proposalB = buildB2ApprovedProposal(bundleB);

    const candidateA = buildPreparationRecordCandidate(proposalA, { evaluatedAt: EVALUATED_AT_T1 });
    const candidateB = buildPreparationRecordCandidate(proposalB, { evaluatedAt: EVALUATED_AT_T1 });

    expect(candidateA.preparationAuthoritySnapshotHash).not.toBe(
      candidateB.preparationAuthoritySnapshotHash
    );
    expect(candidateA.preparationRecordSemanticIdentityHash).not.toBe(
      candidateB.preparationRecordSemanticIdentityHash
    );
  });

  test("evaluatedAt is required", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    expect(() => buildPreparationRecordCandidate(proposal, {})).toThrow(/evaluatedAt is required/);
  });

  test("input proposal is not mutated", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const before = JSON.stringify(proposal);
    buildPreparationRecordCandidate(proposal, { evaluatedAt: EVALUATED_AT_T1 });
    expect(JSON.stringify(proposal)).toBe(before);
  });

  test("builder has no DB, mongoose, A0, or execution dependencies", () => {
    const source = require("fs").readFileSync(
      require("path").join(__dirname, "../services/autopilotPreparation/buildPreparationRecordCandidate.js"),
      "utf8"
    );
    const requireLines = source
      .split("\n")
      .filter((line) => /require\s*\(/.test(line))
      .join("\n");
    expect(requireLines).not.toMatch(/mongoose|AutopilotActionProposal|provenanceVerification|isExecutionEnabled/);
    expect(source).not.toMatch(/\bnew Date\s*\(\s*\)/);
    expect(source).not.toMatch(/\bDate\.now\s*\(/);
    expect(source).not.toMatch(/randomUUID|Math\.random/);
  });

  test("equivalent date representations canonicalise to the same authority hash", () => {
    const proposalZulu = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposalZulu.approvalSnapshot.approvedAt = "2026-08-10T12:00:00.000Z";

    const proposalOffset = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposalOffset.approvalSnapshot.approvedAt = "2026-08-10T13:00:00+01:00";

    const proposalDateInstance = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposalDateInstance.approvalSnapshot.approvedAt = new Date("2026-08-10T12:00:00.000Z");

    const zulu = buildPreparationRecordCandidate(proposalZulu, { evaluatedAt: EVALUATED_AT_T1 });
    const offset = buildPreparationRecordCandidate(proposalOffset, { evaluatedAt: EVALUATED_AT_T1 });
    const dateInstance = buildPreparationRecordCandidate(proposalDateInstance, {
      evaluatedAt: EVALUATED_AT_T1,
    });

    expect(zulu.preparationAuthoritySnapshot.approvalMetadata.approvedAt).toBe(
      "2026-08-10T12:00:00.000Z"
    );
    expect(offset.preparationAuthoritySnapshot.approvalMetadata.approvedAt).toBe(
      "2026-08-10T12:00:00.000Z"
    );
    expect(dateInstance.preparationAuthoritySnapshot.approvalMetadata.approvedAt).toBe(
      "2026-08-10T12:00:00.000Z"
    );
    expect(zulu.preparationAuthoritySnapshotHash).toBe(offset.preparationAuthoritySnapshotHash);
    expect(zulu.preparationAuthoritySnapshotHash).toBe(dateInstance.preparationAuthoritySnapshotHash);
  });

  test.each([
    ["numeric timestamp", 1_721_222_400_000],
    ["non-ISO prose", "August 10, 2026"],
    ["invalid Date instance", new Date("not-a-real-date")],
  ])("rejects unsupported approvedAt representation: %s", (_label, approvedAt) => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposal.approvalSnapshot.approvedAt = approvedAt;

    expect(() =>
      buildPreparationRecordCandidate(proposal, { evaluatedAt: EVALUATED_AT_T1 })
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_AUTHORITY_SNAPSHOT",
        details: expect.objectContaining({ field: "approvedAt" }),
      })
    );
  });

  test("observation note over released maximum fails closed without truncation", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposal.approvalSnapshot.proposedPayload.observationNote = `${"x".repeat(501)}`;

    expect(() =>
      buildPreparationRecordCandidate(proposal, { evaluatedAt: EVALUATED_AT_T1 })
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_AUTHORITY_SNAPSHOT",
        details: expect.objectContaining({
          field: "observationNote",
          maxLength: 500,
          actualLength: 501,
        }),
      })
    );
  });

  test("distinct observation notes within released maximum do not collide", () => {
    const noteA = `${"a".repeat(500)}`;
    const noteB = `${"b".repeat(500)}`;
    const proposalA = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const proposalB = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    proposalA.approvalSnapshot.proposedPayload.observationNote = noteA;
    proposalB.approvalSnapshot.proposedPayload.observationNote = noteB;

    const candidateA = buildPreparationRecordCandidate(proposalA, { evaluatedAt: EVALUATED_AT_T1 });
    const candidateB = buildPreparationRecordCandidate(proposalB, { evaluatedAt: EVALUATED_AT_T1 });

    expect(candidateA.preparationAuthoritySnapshot.proposedPayload.observationNote).toBe(noteA);
    expect(candidateB.preparationAuthoritySnapshot.proposedPayload.observationNote).toBe(noteB);
    expect(candidateA.preparationAuthoritySnapshotHash).not.toBe(
      candidateB.preparationAuthoritySnapshotHash
    );
  });

  test("candidate contains no learner identifiers", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const candidate = buildPreparationRecordCandidate(proposal, { evaluatedAt: EVALUATED_AT_T1 });
    const serialized = JSON.stringify(candidate);
    expect(serialized).not.toMatch(/studentId|classPublicId|ownerTeacherId|classId/);
  });

  test("hash helpers align with candidate output", () => {
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const candidate = buildPreparationRecordCandidate(proposal, { evaluatedAt: EVALUATED_AT_T1 });

    expect(derivePreparationAuthoritySnapshotHash(candidate.preparationAuthoritySnapshot)).toBe(
      candidate.preparationAuthoritySnapshotHash
    );
    expect(deriveEligibilityAuditHash(candidate.eligibilitySnapshot)).toBe(
      candidate.eligibilityAuditHash
    );
    expect(deriveEligibilitySemanticHash(candidate.eligibilitySnapshot)).toBe(
      candidate.eligibilitySemanticHash
    );
    expect(
      derivePreparationRecordSemanticIdentityHash({
        actionId: candidate.actionId,
        preparationAuthoritySnapshotHash: candidate.preparationAuthoritySnapshotHash,
        eligibilitySemanticHash: candidate.eligibilitySemanticHash,
      })
    ).toBe(candidate.preparationRecordSemanticIdentityHash);
  });
});
