/**
 * @jest-environment node
 */
const mongoose = require("mongoose");
const runtime = require("../config/autopilotPreparationRuntime");
const provenance = require("../contracts/autopilotProposalProvenance.v1");
const {
  POLICY_VERSION: SAFETY_POLICY_VERSION,
  PROPOSED_PAYLOAD_ENVELOPE_TYPE,
} = require("../contracts/autopilotSafetyPolicy.v1");
const {
  PREPARATION_RECORD_EVENT_CREATED,
} = require("../contracts/autopilotPreparationRecordPersistence.v1");
const {
  deriveIdempotencyKey,
  deriveObservationIdentityHash,
  buildCanonicalTargetSnapshotFields,
  computeTargetSnapshotHash,
  buildAdvisorySourceRef,
  buildCanonicalAcceptedCreateContent,
  deriveIdempotencyKeyS12,
} = require("../services/autopilotSafety/idempotencyKey");
const { buildPreparationRecordCandidate } = require("../services/autopilotPreparation/buildPreparationRecordCandidate");

jest.mock("../models/AutopilotActionProposal");
jest.mock("../models/AutopilotPreparationRecord");
jest.mock("../models/AutopilotPreparationRecordEvent");

const AutopilotActionProposal = require("../models/AutopilotActionProposal");
const AutopilotPreparationRecord = require("../models/AutopilotPreparationRecord");
const AutopilotPreparationRecordEvent = require("../models/AutopilotPreparationRecordEvent");
const {
  persistPreparationRecord,
  PreparationRecordPersistenceError,
  resolveReplay,
  isActionIdDuplicateKeyError,
} = require("../services/autopilotPreparation/persistPreparationRecord");

const SPEC = "aqa-gcse-biology";
const TOPIC = "aqa-gcse-biology:cell-structure";
const ACTOR_A = new mongoose.Types.ObjectId();
const ACTOR_B = new mongoose.Types.ObjectId();

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

function mockSession() {
  return {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };
}

function mockFindOneLean(value) {
  return { lean: jest.fn().mockResolvedValue(value) };
}

function mockFindOneSessionLean(value) {
  return {
    session: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(value),
    }),
  };
}

function mockReplicaSetAvailable() {
  mongoose.connection.db = {
    admin: () => ({
      command: jest.fn().mockResolvedValue({ setName: "rs0" }),
    }),
  };
}

describe("autopilot preparation record persistence P1.2", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envBackup };
    delete process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED;
    mockReplicaSetAvailable();
    mongoose.startSession = jest.fn();
  });

  afterAll(() => {
    process.env = envBackup;
  });

  test("gate default-off fails closed", async () => {
    await expect(
      persistPreparationRecord("approved-b2", { actorId: ACTOR_A, actorRole: "admin" })
    ).rejects.toMatchObject({
      code: "PREPARATION_RECORD_PERSISTENCE_DISABLED",
      statusCode: 403,
    });
    expect(AutopilotActionProposal.findOne).not.toHaveBeenCalled();
  });

  test("gate enables only with strict true/1 semantics", () => {
    expect(runtime.isPreparationRecordPersistenceEnabled()).toBe(false);
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED = "true";
    expect(runtime.isPreparationRecordPersistenceEnabled()).toBe(true);
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED = "1";
    expect(runtime.isPreparationRecordPersistenceEnabled()).toBe(true);
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED = "yes";
    expect(runtime.isPreparationRecordPersistenceEnabled()).toBe(false);
  });

  test("NOT_ELIGIBLE fails closed with no writes", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED = "true";
    AutopilotActionProposal.findOne.mockReturnValue(
      mockFindOneLean(buildHistoricalApprovedProposal())
    );
    AutopilotPreparationRecord.findOne.mockReturnValue(mockFindOneLean(null));

    await expect(
      persistPreparationRecord("approved-historical", { actorId: ACTOR_A, actorRole: "admin" })
    ).rejects.toMatchObject({ code: "NOT_ELIGIBLE", statusCode: 422 });

    expect(mongoose.startSession).not.toHaveBeenCalled();
    expect(AutopilotPreparationRecord.create).not.toHaveBeenCalled();
    expect(AutopilotPreparationRecordEvent.create).not.toHaveBeenCalled();
  });

  test("happy path persists record and creation event atomically", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED = "true";
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);

    AutopilotActionProposal.findOne
      .mockReturnValueOnce(mockFindOneLean(proposal))
      .mockReturnValueOnce(mockFindOneSessionLean(proposal));
    AutopilotPreparationRecord.findOne
      .mockReturnValueOnce(mockFindOneLean(null))
      .mockReturnValueOnce(mockFindOneSessionLean(null));

    const recordId = new mongoose.Types.ObjectId();
    const createdRecord = {
      _id: recordId,
      actionId: proposal.actionId,
      actorId: ACTOR_A,
      actorRole: "admin",
      toObject: () => ({
        _id: recordId,
        actionId: proposal.actionId,
        actorId: ACTOR_A,
        actorRole: "admin",
      }),
    };
    AutopilotPreparationRecord.create = jest.fn().mockResolvedValue([createdRecord]);
    AutopilotPreparationRecordEvent.create = jest.fn().mockResolvedValue([]);

    const result = await persistPreparationRecord("approved-b2", {
      actorId: ACTOR_A,
      actorRole: "admin",
    });

    expect(result.idempotentReplay).toBe(false);
    expect(AutopilotPreparationRecord.create).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: "approved-b2",
          actorId: ACTOR_A,
          actorRole: "admin",
          recordCandidate: expect.objectContaining({
            actionId: "approved-b2",
            preparationRecordSemanticIdentityHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          }),
        }),
      ]),
      { session }
    );
    expect(AutopilotPreparationRecordEvent.create).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: "approved-b2",
          eventType: PREPARATION_RECORD_EVENT_CREATED,
          preparationRecordId: recordId,
          actorId: ACTOR_A,
          actorRole: "admin",
        }),
      ]),
      { session }
    );
    expect(session.commitTransaction).toHaveBeenCalled();
  });

  test("equivalent retry returns existing record without writes and preserves first actor", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED = "true";
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const candidate = buildPreparationRecordCandidate(proposal, {
      evaluatedAt: "2026-08-15T08:00:00.000Z",
    });
    const existing = {
      actionId: proposal.actionId,
      preparationRecordSemanticIdentityHash: candidate.preparationRecordSemanticIdentityHash,
      actorId: ACTOR_A,
      actorRole: "admin",
      recordCandidate: candidate,
    };

    AutopilotActionProposal.findOne.mockReturnValue(mockFindOneLean(proposal));
    AutopilotPreparationRecord.findOne.mockReturnValue(mockFindOneLean(existing));

    const result = await persistPreparationRecord("approved-b2", {
      actorId: ACTOR_B,
      actorRole: "operator",
    });

    expect(result.idempotentReplay).toBe(true);
    expect(result.record.actorId).toEqual(ACTOR_A);
    expect(result.record.actorRole).toBe("admin");
    expect(mongoose.startSession).not.toHaveBeenCalled();
    expect(AutopilotPreparationRecord.create).not.toHaveBeenCalled();
    expect(AutopilotPreparationRecordEvent.create).not.toHaveBeenCalled();
  });

  test("identity conflict on same actionId with different semantic hash", async () => {
    const existing = {
      actionId: "approved-b2",
      preparationRecordSemanticIdentityHash: "a".repeat(64),
    };
    const candidate = {
      actionId: "approved-b2",
      preparationRecordSemanticIdentityHash: "b".repeat(64),
    };

    expect(() => resolveReplay(existing, candidate)).toThrow(
      expect.objectContaining({ code: "PREPARATION_IDENTITY_CONFLICT", statusCode: 409 })
    );
  });

  test("STALE_PROPOSAL_AUTHORITY when transactional re-read changes semantic identity", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED = "true";
    const proposalA = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const proposalB = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:01.000Z"));
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);

    AutopilotActionProposal.findOne
      .mockReturnValueOnce(mockFindOneLean(proposalA))
      .mockReturnValueOnce(mockFindOneSessionLean(proposalB));
    AutopilotPreparationRecord.findOne.mockReturnValue(mockFindOneLean(null));

    await expect(
      persistPreparationRecord("approved-b2", { actorId: ACTOR_A, actorRole: "admin" })
    ).rejects.toMatchObject({ code: "STALE_PROPOSAL_AUTHORITY", statusCode: 409 });

    expect(session.abortTransaction).toHaveBeenCalled();
    expect(AutopilotPreparationRecord.create).not.toHaveBeenCalled();
  });

  test("duplicate-key race converges to idempotent replay", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED = "true";
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const candidate = buildPreparationRecordCandidate(proposal, {
      evaluatedAt: "2026-08-15T08:00:00.000Z",
    });
    const existing = {
      actionId: proposal.actionId,
      preparationRecordSemanticIdentityHash: candidate.preparationRecordSemanticIdentityHash,
      actorId: ACTOR_A,
      actorRole: "admin",
      recordCandidate: candidate,
    };
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);

    AutopilotActionProposal.findOne
      .mockReturnValueOnce(mockFindOneLean(proposal))
      .mockReturnValueOnce(mockFindOneSessionLean(proposal));
    AutopilotPreparationRecord.findOne
      .mockReturnValueOnce(mockFindOneLean(null))
      .mockReturnValueOnce(mockFindOneSessionLean(null))
      .mockReturnValue(mockFindOneLean(existing));

    const duplicateError = new Error("duplicate");
    duplicateError.code = 11000;
    duplicateError.keyPattern = { actionId: 1 };
    AutopilotPreparationRecord.create = jest.fn().mockRejectedValue(duplicateError);

    const result = await persistPreparationRecord("approved-b2", {
      actorId: ACTOR_B,
      actorRole: "operator",
    });

    expect(result.idempotentReplay).toBe(true);
    expect(result.record.actorId).toEqual(ACTOR_A);
    expect(AutopilotPreparationRecordEvent.create).not.toHaveBeenCalled();
  });

  test("actionId duplicate-key race with non-equivalent existing record conflicts", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED = "true";
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);

    AutopilotActionProposal.findOne
      .mockReturnValueOnce(mockFindOneLean(proposal))
      .mockReturnValueOnce(mockFindOneSessionLean(proposal));
    AutopilotPreparationRecord.findOne
      .mockReturnValueOnce(mockFindOneLean(null))
      .mockReturnValueOnce(mockFindOneSessionLean(null))
      .mockReturnValue(
        mockFindOneLean({
          actionId: proposal.actionId,
          preparationRecordSemanticIdentityHash: "f".repeat(64),
        })
      );

    const duplicateError = new Error("duplicate");
    duplicateError.code = 11000;
    duplicateError.keyPattern = { actionId: 1 };
    AutopilotPreparationRecord.create = jest.fn().mockRejectedValue(duplicateError);

    await expect(
      persistPreparationRecord("approved-b2", { actorId: ACTOR_A, actorRole: "admin" })
    ).rejects.toMatchObject({ code: "PREPARATION_IDENTITY_CONFLICT", statusCode: 409 });
  });

  test("event duplicate-key error is not treated as idempotent replay", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED = "true";
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);

    AutopilotActionProposal.findOne
      .mockReturnValueOnce(mockFindOneLean(proposal))
      .mockReturnValueOnce(mockFindOneSessionLean(proposal));
    AutopilotPreparationRecord.findOne
      .mockReturnValueOnce(mockFindOneLean(null))
      .mockReturnValueOnce(mockFindOneSessionLean(null));

    const recordId = new mongoose.Types.ObjectId();
    AutopilotPreparationRecord.create = jest.fn().mockResolvedValue([
      {
        _id: recordId,
        actionId: proposal.actionId,
        toObject: () => ({ _id: recordId, actionId: proposal.actionId }),
      },
    ]);

    const eventDuplicateError = new Error("event duplicate");
    eventDuplicateError.code = 11000;
    eventDuplicateError.keyPattern = { preparationRecordId: 1, eventType: 1 };
    AutopilotPreparationRecordEvent.create = jest.fn().mockRejectedValue(eventDuplicateError);

    await expect(
      persistPreparationRecord("approved-b2", { actorId: ACTOR_A, actorRole: "admin" })
    ).rejects.toBe(eventDuplicateError);

    expect(session.abortTransaction).toHaveBeenCalled();
    expect(AutopilotPreparationRecord.findOne).toHaveBeenCalledTimes(2);
  });

  test("unrelated duplicate-key error is not treated as idempotent replay", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED = "true";
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);

    AutopilotActionProposal.findOne
      .mockReturnValueOnce(mockFindOneLean(proposal))
      .mockReturnValueOnce(mockFindOneSessionLean(proposal));
    AutopilotPreparationRecord.findOne
      .mockReturnValueOnce(mockFindOneLean(null))
      .mockReturnValueOnce(mockFindOneSessionLean(null));

    const unrelatedDuplicateError = new Error("unrelated duplicate");
    unrelatedDuplicateError.code = 11000;
    unrelatedDuplicateError.keyPattern = { unrelatedField: 1 };
    AutopilotPreparationRecord.create = jest.fn().mockRejectedValue(unrelatedDuplicateError);

    await expect(
      persistPreparationRecord("approved-b2", { actorId: ACTOR_A, actorRole: "admin" })
    ).rejects.toBe(unrelatedDuplicateError);
  });

  test("non-duplicate event failure aborts transaction without replay", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED = "true";
    const proposal = buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"));
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);

    AutopilotActionProposal.findOne
      .mockReturnValueOnce(mockFindOneLean(proposal))
      .mockReturnValueOnce(mockFindOneSessionLean(proposal));
    AutopilotPreparationRecord.findOne
      .mockReturnValueOnce(mockFindOneLean(null))
      .mockReturnValueOnce(mockFindOneSessionLean(null));

    const recordId = new mongoose.Types.ObjectId();
    AutopilotPreparationRecord.create = jest.fn().mockResolvedValue([
      {
        _id: recordId,
        actionId: proposal.actionId,
        toObject: () => ({ _id: recordId, actionId: proposal.actionId }),
      },
    ]);

    const eventFailure = new Error("event write failed");
    AutopilotPreparationRecordEvent.create = jest.fn().mockRejectedValue(eventFailure);

    await expect(
      persistPreparationRecord("approved-b2", { actorId: ACTOR_A, actorRole: "admin" })
    ).rejects.toBe(eventFailure);

    expect(session.abortTransaction).toHaveBeenCalled();
    expect(session.commitTransaction).not.toHaveBeenCalled();
  });

  test("isActionIdDuplicateKeyError classifies only actionId duplicate keys", () => {
    const actionIdDup = new Error("dup");
    actionIdDup.code = 11000;
    actionIdDup.keyPattern = { actionId: 1 };
    expect(isActionIdDuplicateKeyError(actionIdDup)).toBe(true);

    const eventDup = new Error("dup");
    eventDup.code = 11000;
    eventDup.keyPattern = { preparationRecordId: 1, eventType: 1 };
    expect(isActionIdDuplicateKeyError(eventDup)).toBe(false);

    const unrelatedDup = new Error("dup");
    unrelatedDup.code = 11000;
    unrelatedDup.keyPattern = { unrelatedField: 1 };
    expect(isActionIdDuplicateKeyError(unrelatedDup)).toBe(false);
  });

  test("proposal not found", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED = "true";
    AutopilotActionProposal.findOne.mockReturnValue(mockFindOneLean(null));

    await expect(
      persistPreparationRecord("missing", { actorId: ACTOR_A, actorRole: "admin" })
    ).rejects.toMatchObject({ code: "PROPOSAL_NOT_FOUND", statusCode: 404 });
  });

  test("proposal not approved", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_PERSISTENCE_ENABLED = "true";
    AutopilotActionProposal.findOne.mockReturnValue(
      mockFindOneLean(
        buildB2ApprovedProposal(provenanceBundleAt("2026-08-01T12:00:00.000Z"), {
          status: "PROPOSED",
        })
      )
    );

    await expect(
      persistPreparationRecord("approved-b2", { actorId: ACTOR_A, actorRole: "admin" })
    ).rejects.toMatchObject({ code: "PROPOSAL_NOT_APPROVED", statusCode: 409 });
  });

  test("service does not mutate proposal model", async () => {
    const source = require("fs").readFileSync(
      require("path").join(__dirname, "../services/autopilotPreparation/persistPreparationRecord.js"),
      "utf8"
    );
    expect(source).not.toMatch(/\.save\s*\(/);
    expect(source).not.toMatch(/findOneAndUpdate/);
    expect(source).not.toMatch(/AutopilotActionEvent/);
  });
});
