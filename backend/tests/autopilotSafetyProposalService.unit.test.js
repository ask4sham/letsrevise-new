/**
 * @jest-environment node
 */
const mongoose = require("mongoose");
const runtime = require("../config/autopilotSafetyRuntime");
const provenance = require("../contracts/autopilotProposalProvenance.v1");
const {
  deriveIdempotencyKey,
  deriveIdempotencyKeyS12,
  deriveObservationIdentityHash,
  computeTargetSnapshotHash,
  buildCanonicalTargetSnapshotFields,
  buildTargetSnapshot,
  buildAdvisorySourceRef,
  buildCanonicalAcceptedCreateContent,
  canonicalContentMatches,
  canonicalReplayMatches,
  canonicalContentMatchesS12,
} = require("../services/autopilotSafety/idempotencyKey");
const {
  validateCreateRequest,
  AutopilotSafetyError,
} = require("../services/autopilotSafety/proposalValidation");

jest.mock("../models/AutopilotActionProposal");
jest.mock("../models/AutopilotActionEvent");
jest.mock("../services/autopilotSafety/provenanceVerification", () => ({
  verifyObserverProposalProvenance: jest.fn(),
  ProvenanceVerificationError: class ProvenanceVerificationError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  },
}));

const AutopilotActionProposal = require("../models/AutopilotActionProposal");
const AutopilotActionEvent = require("../models/AutopilotActionEvent");
const {
  verifyObserverProposalProvenance,
  ProvenanceVerificationError,
} = require("../services/autopilotSafety/provenanceVerification");
const proposalService = require("../services/autopilotSafety/proposalService");

const SPEC = "aqa-gcse-biology";
const TOPIC = "aqa-gcse-biology:cell-structure";

function validInput(overrides = {}) {
  return {
    specKey: SPEC,
    topicKey: TOPIC,
    observationNote: "Observation only",
    ...overrides,
  };
}

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
    blockingRequirements: [
      "NO_STUDENT_SCOPE",
      "NO_AUTOPILOT_ACTION_AUDIT",
      "NO_IDEMPOTENCY",
      "NO_AUTOMATED_ROLLBACK",
      "STUDENT_IMPACTING",
    ],
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

function mockSession() {
  return {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
}

function buildExistingB2Proposal(bundle, observationNote = "Observation only") {
  const observationIdentityHash = deriveObservationIdentityHash(bundle.sourceEvidence);
  const advisorySourceRef = buildAdvisorySourceRef(TOPIC, observationIdentityHash);
  const targetSnapshot = buildTargetSnapshot({
    specKey: SPEC,
    topicKey: TOPIC,
    advisoryAction: bundle.sourceEvidence.sourceAdvisoryAction,
    advisorySourceRef,
    evidenceCutoffAt: new Date(bundle.sourceEvidence.sourceGeneratedAt),
  });
  const idempotencyKey = deriveIdempotencyKey({
    specKey: SPEC,
    topicKey: TOPIC,
    advisoryAction: bundle.sourceEvidence.sourceAdvisoryAction,
    observationIdentityHash,
  });

  return {
    actionId: "existing-action",
    idempotencyKey,
    status: "PROPOSED",
    policyVersion: "autopilot-safety-policy-v1",
    actionType: "OBSERVER_DERIVED_PROPOSAL",
    specKey: SPEC,
    topicKey: TOPIC,
    autopilotObserverVersion: bundle.sourceEvidence.sourceObserverVersion,
    minimumPermissionLevel: bundle.sourceEvidence.minimumPermissionLevel,
    advisorySource: {
      observer: bundle.sourceEvidence.sourceObserver,
      advisoryAction: bundle.sourceEvidence.sourceAdvisoryAction,
      specKey: SPEC,
      topicKey: TOPIC,
    },
    targetSnapshot,
    proposedPayload: {
      envelopeType: "OBSERVATION_ONLY",
      observationNote,
    },
    sourceEvidence: bundle.sourceEvidence,
    evidenceSnapshotHash: bundle.evidenceSnapshotHash,
  };
}

describe("autopilotSafetyRuntime", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  test("gates default OFF", () => {
    delete process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED;
    delete process.env.AUTOPILOT_LEARNING_APPROVALS_ENABLED;
    expect(runtime.isProposalsMutationEnabled()).toBe(false);
    expect(runtime.isApprovalsMutationEnabled()).toBe(false);
  });

  test("strict gate parsing enables only true/1", () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "true";
    process.env.AUTOPILOT_LEARNING_APPROVALS_ENABLED = "1";
    expect(runtime.isProposalsMutationEnabled()).toBe(true);
    expect(runtime.isApprovalsMutationEnabled()).toBe(true);
  });

  test("malformed gate values remain disabled", () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "yes";
    process.env.AUTOPILOT_LEARNING_APPROVALS_ENABLED = "on";
    expect(runtime.isProposalsMutationEnabled()).toBe(false);
    expect(runtime.isApprovalsMutationEnabled()).toBe(false);
  });

  test("execution always false", () => {
    process.env.AUTOPILOT_LEARNING_EXECUTION_ENABLED = "true";
    expect(runtime.isExecutionEnabled()).toBe(false);
  });
});

describe("idempotencyKey S1.4B2", () => {
  test("server computes deterministic targetSnapshotHash with evidenceCutoffAt included", () => {
    const fields = buildCanonicalTargetSnapshotFields({
      specKey: SPEC,
      topicKey: TOPIC,
      advisoryAction: "CONSIDER_FLASHCARD_REVISION",
      advisorySourceRef: "provenance:v1:topic:abc",
      evidenceCutoffAt: new Date("2026-08-01T12:00:00.000Z"),
    });
    const hashA = computeTargetSnapshotHash(fields);
    const hashB = computeTargetSnapshotHash(fields);
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    expect(fields.evidenceCutoffAt).toBe("2026-08-01T12:00:00.000Z");
  });

  test("different evidenceCutoffAt changes targetSnapshotHash under V1", () => {
    const base = {
      specKey: SPEC,
      topicKey: TOPIC,
      advisoryAction: "CONSIDER_FLASHCARD_REVISION",
      advisorySourceRef: "provenance:v1:topic:abc",
    };
    const hashA = computeTargetSnapshotHash({
      ...base,
      evidenceCutoffAt: new Date("2026-08-01T12:00:00.000Z"),
    });
    const hashB = computeTargetSnapshotHash({
      ...base,
      evidenceCutoffAt: new Date("2026-08-01T12:00:01.000Z"),
    });
    expect(hashA).not.toBe(hashB);
  });

  test("observationIdentityHash ignores sourceGeneratedAt", () => {
    const bundleT1 = provenanceBundleAt("2026-08-01T12:00:00.000Z");
    const bundleT2 = provenanceBundleAt("2026-08-01T12:00:01.000Z");
    expect(deriveObservationIdentityHash(bundleT1.sourceEvidence)).toBe(
      deriveObservationIdentityHash(bundleT2.sourceEvidence)
    );
    expect(bundleT1.evidenceSnapshotHash).not.toBe(bundleT2.evidenceSnapshotHash);
  });

  test("deriveIdempotencyKey V2 uses observationIdentityHash only", () => {
    const bundle = provenanceBundleAt("2026-08-01T12:00:00.000Z");
    const identity = deriveObservationIdentityHash(bundle.sourceEvidence);
    const keyA = deriveIdempotencyKey({
      specKey: SPEC,
      topicKey: TOPIC,
      advisoryAction: "CONSIDER_FLASHCARD_REVISION",
      observationIdentityHash: identity,
    });
    const keyB = deriveIdempotencyKey({
      specKey: SPEC,
      topicKey: TOPIC,
      advisoryAction: "CONSIDER_FLASHCARD_REVISION",
      observationIdentityHash: identity,
    });
    expect(keyA).toBe(keyB);
    expect(keyA).toMatch(/^[a-f0-9]{64}$/);
  });

  test("substantive advisory change changes observationIdentityHash and idempotency key", () => {
    const bundleA = provenanceBundleAt("2026-08-01T12:00:00.000Z");
    const bundleB = provenanceBundleAt("2026-08-01T12:00:00.000Z", {
      sourceAdvisoryAction: "CONSIDER_RETEACH",
      readinessClassification: "REQUIRES_L2_PREPARATION",
    });
    const keyA = deriveIdempotencyKey({
      specKey: SPEC,
      topicKey: TOPIC,
      advisoryAction: bundleA.sourceEvidence.sourceAdvisoryAction,
      observationIdentityHash: deriveObservationIdentityHash(bundleA.sourceEvidence),
    });
    const keyB = deriveIdempotencyKey({
      specKey: SPEC,
      topicKey: TOPIC,
      advisoryAction: bundleB.sourceEvidence.sourceAdvisoryAction,
      observationIdentityHash: deriveObservationIdentityHash(bundleB.sourceEvidence),
    });
    expect(keyA).not.toBe(keyB);
  });

  test("canonicalReplayMatches ignores temporal audit siblings", () => {
    const bundleT1 = provenanceBundleAt("2026-08-01T12:00:00.000Z");
    const bundleT2 = provenanceBundleAt("2026-08-01T12:00:01.000Z");
    const existing = buildExistingB2Proposal(bundleT1);
    const replay = canonicalReplayMatches(
      {
        observationNote: "Observation only",
        verifiedSourceEvidence: bundleT2.sourceEvidence,
      },
      existing
    );
    expect(replay).toBe(true);
    expect(canonicalContentMatches(
      {
        observationNote: "Observation only",
        verifiedSourceEvidence: bundleT2.sourceEvidence,
      },
      existing
    )).toBe(true);
  });

  test("canonicalReplayMatches rejects note mismatch", () => {
    const bundle = provenanceBundleAt("2026-08-01T12:00:00.000Z");
    const existing = buildExistingB2Proposal(bundle, "first note");
    expect(
      canonicalReplayMatches(
        {
          observationNote: "different note",
          verifiedSourceEvidence: bundle.sourceEvidence,
        },
        existing
      )
    ).toBe(false);
  });

  test("legacy S12 comparator still available for pre-B2 proposals", () => {
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
    const existing = {
      actionType: canonical.actionType,
      policyVersion: canonical.policyVersion,
      specKey: canonical.specKey,
      topicKey: canonical.topicKey,
      autopilotObserverVersion: canonical.autopilotObserverVersion,
      minimumPermissionLevel: canonical.minimumPermissionLevel,
      advisorySource: canonical.advisorySource,
      targetSnapshot: canonical.targetSnapshot,
      proposedPayload: canonical.proposedPayload,
    };
    expect(canonicalContentMatchesS12(legacyInput, existing)).toBe(true);
    expect(canonicalContentMatches(legacyInput, existing)).toBe(true);
  });
});

describe("proposalValidation S1.4B2", () => {
  test("accepts minimal coordinates-only body", () => {
    expect(validateCreateRequest(validInput())).toEqual({
      specKey: SPEC,
      topicKey: TOPIC,
      observationNote: "Observation only",
    });
  });

  test("rejects deprecated authority fields", () => {
    expect(() =>
      validateCreateRequest({
        ...validInput(),
        advisoryAction: "CONSIDER_FLASHCARD_REVISION",
      })
    ).toThrow(expect.objectContaining({ code: "INVALID_PROPOSAL" }));
  });

  test("rejects supplied targetSnapshotHash", () => {
    expect(() =>
      validateCreateRequest({
        ...validInput(),
        targetSnapshotHash: "client-hash",
      })
    ).toThrow(AutopilotSafetyError);
  });

  test("rejects student identifiers", () => {
    expect(() =>
      validateCreateRequest({
        ...validInput(),
        studentId: new mongoose.Types.ObjectId().toString(),
      })
    ).toThrow(AutopilotSafetyError);
  });

  test("rejects L4 field", () => {
    expect(() =>
      validateCreateRequest({
        ...validInput(),
        l4PolicyClass: "AUTOMATIC_MARKS_OR_GRADES",
      })
    ).toThrow(expect.objectContaining({ code: "L4_PROHIBITED" }));
  });
});

describe("proposalService S1.4B2", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envBackup };
    delete process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED;
    delete process.env.AUTOPILOT_LEARNING_APPROVALS_ENABLED;
    mongoose.connection.db = {
      admin: () => ({
        command: jest.fn().mockResolvedValue({ setName: "rs0" }),
      }),
    };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  test("create disabled when proposals gate OFF", async () => {
    await expect(
      proposalService.createProposal(validInput(), new mongoose.Types.ObjectId())
    ).rejects.toMatchObject({
      code: "AUTOPILOT_PROPOSALS_DISABLED",
      statusCode: 403,
    });
  });

  test("transaction unavailable returns 503", async () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "true";
    mongoose.connection.db = null;
    await expect(
      proposalService.createProposal(validInput(), new mongoose.Types.ObjectId())
    ).rejects.toMatchObject({
      code: "TRANSACTIONS_UNAVAILABLE",
      statusCode: 503,
    });
  });

  test("temporal retry replays first proposal unchanged", async () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "true";
    mongoose.startSession = jest.fn().mockResolvedValue(mockSession());

    const bundleT1 = provenanceBundleAt("2026-08-01T12:00:00.000Z");
    const bundleT2 = provenanceBundleAt("2026-08-01T12:00:01.000Z");
    const existing = buildExistingB2Proposal(bundleT1);

    verifyObserverProposalProvenance.mockResolvedValue(bundleT2);
    AutopilotActionProposal.findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(existing),
    });

    const result = await proposalService.createProposal(validInput(), new mongoose.Types.ObjectId());
    expect(result.idempotentReplay).toBe(true);
    expect(result.proposal.actionId).toBe("existing-action");
    expect(result.proposal.evidenceSnapshotHash).toBe(bundleT1.evidenceSnapshotHash);
    expect(new Date(result.proposal.targetSnapshot.evidenceCutoffAt).toISOString()).toBe(
      "2026-08-01T12:00:00.000Z"
    );
    expect(mongoose.startSession).not.toHaveBeenCalled();
    expect(AutopilotActionEvent.create).not.toHaveBeenCalled();
  });

  test("same identity different observationNote conflicts", async () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "true";
    const bundle = provenanceBundleAt("2026-08-01T12:00:00.000Z");
    const existing = buildExistingB2Proposal(bundle, "different note");

    verifyObserverProposalProvenance.mockResolvedValue(bundle);
    AutopilotActionProposal.findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(existing),
    });

    await expect(
      proposalService.createProposal(validInput(), new mongoose.Types.ObjectId())
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", statusCode: 409 });
  });

  test("NOT_AN_ACTION maps to UNSUPPORTED_ADVISORY", async () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "true";
    verifyObserverProposalProvenance.mockRejectedValue(
      new ProvenanceVerificationError("NOT_AN_ACTION", "not actionable")
    );

    await expect(
      proposalService.createProposal(validInput(), new mongoose.Types.ObjectId())
    ).rejects.toMatchObject({ code: "UNSUPPORTED_ADVISORY", statusCode: 422 });
  });

  test("integration verifier failure maps to OBSERVER_EVIDENCE_UNAVAILABLE", async () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "true";
    verifyObserverProposalProvenance.mockRejectedValue(
      new ProvenanceVerificationError("UNSUPPORTED_OBSERVER_VERSION", "bad version")
    );

    await expect(
      proposalService.createProposal(validInput(), new mongoose.Types.ObjectId())
    ).rejects.toMatchObject({ code: "OBSERVER_EVIDENCE_UNAVAILABLE", statusCode: 503 });
  });

  test("create writes proposal provenance and PROPOSED event hash atomically", async () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "true";
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);
    const bundle = provenanceBundleAt("2026-08-01T12:00:00.000Z");
    verifyObserverProposalProvenance.mockResolvedValue(bundle);
    AutopilotActionProposal.findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    const createdDoc = {
      actionId: "new-action",
      toObject: () => ({ actionId: "new-action", status: "PROPOSED" }),
    };
    AutopilotActionProposal.create = jest.fn().mockResolvedValue([createdDoc]);
    AutopilotActionEvent.create = jest.fn().mockResolvedValue([]);

    const result = await proposalService.createProposal(validInput(), new mongoose.Types.ObjectId());
    expect(result.idempotentReplay).toBe(false);
    expect(AutopilotActionProposal.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          specKey: SPEC,
          topicKey: TOPIC,
          sourceEvidence: bundle.sourceEvidence,
          evidenceSnapshotHash: bundle.evidenceSnapshotHash,
        }),
      ],
      expect.objectContaining({ session })
    );
    expect(AutopilotActionEvent.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          eventType: "PROPOSED",
          details: expect.objectContaining({
            evidenceSnapshotHash: bundle.evidenceSnapshotHash,
          }),
        }),
      ],
      expect.objectContaining({ session })
    );
    expect(session.commitTransaction).toHaveBeenCalled();
  });

  test("approve freezes provenance for B2 proposals", async () => {
    process.env.AUTOPILOT_LEARNING_APPROVALS_ENABLED = "true";
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);
    const actorId = new mongoose.Types.ObjectId();
    const future = new Date(Date.now() + 60_000);
    const bundle = provenanceBundleAt("2026-08-01T12:00:00.000Z");
    const existing = buildExistingB2Proposal(bundle);
    const current = {
      actionId: "a1",
      status: "PROPOSED",
      expiresAt: future,
      sourceEvidence: existing.sourceEvidence,
      evidenceSnapshotHash: existing.evidenceSnapshotHash,
      toObject: () => ({
        ...existing,
        actionId: "a1",
        status: "PROPOSED",
        expiresAt: future,
        policyVersion: "autopilot-safety-policy-v1",
        idempotencyKey: existing.idempotencyKey,
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    AutopilotActionProposal.findOne = jest
      .fn()
      .mockReturnValueOnce({ session: jest.fn().mockResolvedValue(current) })
      .mockReturnValueOnce({ session: jest.fn().mockResolvedValue(null).mockReturnValue({ lean: jest.fn() }) });
    AutopilotActionEvent.create = jest.fn().mockResolvedValue([]);

    await proposalService.approveProposal("a1", actorId);
    expect(current.approvalSnapshot.sourceEvidence).toEqual(existing.sourceEvidence);
    expect(current.approvalSnapshot.evidenceSnapshotHash).toBe(existing.evidenceSnapshotHash);
    expect(current.save).toHaveBeenCalledWith(
      expect.objectContaining({ session, validateBeforeSave: true })
    );
  });

  test("approve after deadline is PROPOSAL_EXPIRED", async () => {
    process.env.AUTOPILOT_LEARNING_APPROVALS_ENABLED = "true";
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);
    const past = new Date(Date.now() - 60_000);
    AutopilotActionProposal.findOne = jest
      .fn()
      .mockReturnValueOnce({ session: jest.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ actionId: "a1", status: "PROPOSED", expiresAt: past }),
        }),
      });

    await expect(
      proposalService.approveProposal("a1", new mongoose.Types.ObjectId())
    ).rejects.toMatchObject({ code: "PROPOSAL_EXPIRED", statusCode: 409 });
  });

  test("read meta does not mutate expired PROPOSED", () => {
    const meta = proposalService.buildReadMeta({
      status: "PROPOSED",
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(meta.isPastApprovalDeadline).toBe(true);
    expect(meta.approvalEligible).toBe(false);
    expect(meta.executionAuthorized).toBe(false);
  });
});

describe("approval provenance integrity S1.4B2", () => {
  const envBackup = { ...process.env };

  function buildProposedForApprove({ bundle, provenanceOverrides = {} } = {}) {
    const resolvedBundle = bundle || provenanceBundleAt("2026-08-01T12:00:00.000Z");
    const existing = buildExistingB2Proposal(resolvedBundle);
    const future = new Date(Date.now() + 60_000);
    const proposal = {
      actionId: "a1",
      status: "PROPOSED",
      expiresAt: future,
      ...existing,
      ...provenanceOverrides,
      toObject: () => ({
        ...existing,
        actionId: "a1",
        status: "PROPOSED",
        expiresAt: future,
        policyVersion: "autopilot-safety-policy-v1",
        idempotencyKey: existing.idempotencyKey,
        ...provenanceOverrides,
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    return { proposal, bundle: resolvedBundle, future };
  }

  function mockApproveSession(proposal) {
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);
    AutopilotActionProposal.findOne = jest.fn().mockReturnValue({
      session: jest.fn().mockResolvedValue(proposal),
    });
    AutopilotActionEvent.create = jest.fn().mockResolvedValue([]);
    return session;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envBackup };
    process.env.AUTOPILOT_LEARNING_APPROVALS_ENABLED = "true";
    mongoose.connection.db = {
      admin: () => ({
        command: jest.fn().mockResolvedValue({ setName: "rs0" }),
      }),
    };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  test("assertApprovalProvenanceIntegrity passes for matching B2 siblings", () => {
    const bundle = provenanceBundleAt("2026-08-01T12:00:00.000Z");
    const proposal = buildExistingB2Proposal(bundle);
    expect(() => proposalService.assertApprovalProvenanceIntegrity(proposal)).not.toThrow();
  });

  test("assertApprovalProvenanceIntegrity fails closed on corrupted evidence hash", () => {
    const bundle = provenanceBundleAt("2026-08-01T12:00:00.000Z");
    const proposal = buildExistingB2Proposal(bundle);
    proposal.evidenceSnapshotHash = `${"a".repeat(64)}`;

    expect(() => proposalService.assertApprovalProvenanceIntegrity(proposal)).toThrow(
      expect.objectContaining({
        code: "PROPOSAL_INTEGRITY_ERROR",
        statusCode: 500,
      })
    );
  });

  test("assertApprovalProvenanceIntegrity no-ops for historical proposals without provenance", () => {
    expect(() =>
      proposalService.assertApprovalProvenanceIntegrity({
        actionId: "legacy-a1",
        status: "PROPOSED",
      })
    ).not.toThrow();
  });

  test("approve rejects corrupted B2 provenance with PROPOSAL_INTEGRITY_ERROR", async () => {
    const actorId = new mongoose.Types.ObjectId();
    const { proposal } = buildProposedForApprove({
      provenanceOverrides: {
        evidenceSnapshotHash: `${"b".repeat(64)}`,
      },
    });
    const session = mockApproveSession(proposal);

    await expect(proposalService.approveProposal("a1", actorId)).rejects.toMatchObject({
      code: "PROPOSAL_INTEGRITY_ERROR",
      statusCode: 500,
    });

    expect(proposal.save).not.toHaveBeenCalled();
    expect(session.abortTransaction).toHaveBeenCalled();
    expect(verifyObserverProposalProvenance).not.toHaveBeenCalled();
  });

  test("approve does not persist approval snapshot when provenance integrity fails", async () => {
    const actorId = new mongoose.Types.ObjectId();
    const { proposal } = buildProposedForApprove({
      provenanceOverrides: {
        evidenceSnapshotHash: `${"c".repeat(64)}`,
      },
    });
    mockApproveSession(proposal);

    await expect(proposalService.approveProposal("a1", actorId)).rejects.toMatchObject({
      code: "PROPOSAL_INTEGRITY_ERROR",
      statusCode: 500,
    });

    expect(proposal.status).toBe("PROPOSED");
    expect(proposal.approvalSnapshot).toBeUndefined();
    expect(AutopilotActionEvent.create).not.toHaveBeenCalled();
  });

  test("historical unprovenanced proposal approves without provenance siblings", async () => {
    const actorId = new mongoose.Types.ObjectId();
    const future = new Date(Date.now() + 60_000);
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
    const proposal = {
      actionId: "legacy-a1",
      status: "PROPOSED",
      expiresAt: future,
      policyVersion: canonical.policyVersion,
      actionType: canonical.actionType,
      specKey: canonical.specKey,
      topicKey: canonical.topicKey,
      autopilotObserverVersion: canonical.autopilotObserverVersion,
      minimumPermissionLevel: canonical.minimumPermissionLevel,
      advisorySource: canonical.advisorySource,
      targetSnapshot: canonical.targetSnapshot,
      proposedPayload: canonical.proposedPayload,
      idempotencyKey: legacyIdempotencyKey,
      toObject: () => ({
        actionId: "legacy-a1",
        status: "PROPOSED",
        expiresAt: future,
        policyVersion: canonical.policyVersion,
        actionType: canonical.actionType,
        specKey: canonical.specKey,
        topicKey: canonical.topicKey,
        autopilotObserverVersion: canonical.autopilotObserverVersion,
        minimumPermissionLevel: canonical.minimumPermissionLevel,
        advisorySource: canonical.advisorySource,
        targetSnapshot: canonical.targetSnapshot,
        proposedPayload: canonical.proposedPayload,
        idempotencyKey: legacyIdempotencyKey,
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const session = mockApproveSession(proposal);

    await proposalService.approveProposal("legacy-a1", actorId);

    expect(proposal.approvalSnapshot.sourceEvidence).toBeUndefined();
    expect(proposal.approvalSnapshot.evidenceSnapshotHash).toBeUndefined();
    expect(proposal.approvalSnapshot.targetSnapshot).toEqual(canonical.targetSnapshot);
    expect(proposal.save).toHaveBeenCalled();
    expect(session.commitTransaction).toHaveBeenCalled();
    expect(verifyObserverProposalProvenance).not.toHaveBeenCalled();
  });

  test("approve does not re-query observer or refresh provenance from A0.9", async () => {
    const actorId = new mongoose.Types.ObjectId();
    const { proposal, bundle } = buildProposedForApprove();
    mockApproveSession(proposal);

    await proposalService.approveProposal("a1", actorId);

    expect(verifyObserverProposalProvenance).not.toHaveBeenCalled();
    expect(proposal.approvalSnapshot.sourceEvidence).toEqual(bundle.sourceEvidence);
    expect(proposal.approvalSnapshot.evidenceSnapshotHash).toBe(bundle.evidenceSnapshotHash);
  });
});
