/**
 * @jest-environment node
 */
const mongoose = require("mongoose");
const provenance = require("../contracts/autopilotProposalProvenance.v1");
const {
  deriveIdempotencyKey,
  deriveObservationIdentityHash,
  buildAdvisorySourceRef,
  buildTargetSnapshot,
  canonicalReplayMatches,
} = require("../services/autopilotSafety/idempotencyKey");
const { validateCreateRequest } = require("../services/autopilotSafety/proposalValidation");

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
const { verifyObserverProposalProvenance } = require("../services/autopilotSafety/provenanceVerification");
const proposalService = require("../services/autopilotSafety/proposalService");

const SPEC = "aqa-gcse-biology";
const TOPIC = "aqa-gcse-biology:cell-structure";

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
    ...overrides,
  });
}

function bundleAt(generatedAt, overrides = {}) {
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

describe("autopilotSafety create provenance enforcement S1.4B2", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envBackup };
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "true";
    mongoose.connection.db = {
      admin: () => ({
        command: jest.fn().mockResolvedValue({ setName: "rs0" }),
      }),
    };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  test("buildVerifiedCreateBundle persists canonical coordinates and stable advisorySourceRef", () => {
    const bundle = bundleAt("2026-08-01T12:00:00.000Z");
    const verified = proposalService.buildVerifiedCreateBundle(
      { specKey: SPEC, topicKey: "cell-structure", observationNote: "note" },
      bundle
    );

    const identity = deriveObservationIdentityHash(bundle.sourceEvidence);
    expect(verified.canonicalSpecKey).toBe(SPEC);
    expect(verified.canonicalTopicKey).toBe(TOPIC);
    expect(verified.advisorySourceRef).toBe(buildAdvisorySourceRef(TOPIC, identity));
    expect(verified.targetSnapshot.specKey).toBe(SPEC);
    expect(verified.targetSnapshot.topicKey).toBe(TOPIC);
    expect(verified.idempotencyKey).toBe(
      deriveIdempotencyKey({
        specKey: SPEC,
        topicKey: TOPIC,
        advisoryAction: "CONSIDER_FLASHCARD_REVISION",
        observationIdentityHash: identity,
      })
    );
  });

  test("T1/T2 different audit hashes with same semantic identity share idempotency key", () => {
    const bundleT1 = bundleAt("2026-08-01T12:00:00.000Z");
    const bundleT2 = bundleAt("2026-08-01T12:00:01.000Z");
    const verifiedT1 = proposalService.buildVerifiedCreateBundle(
      { specKey: SPEC, topicKey: TOPIC, observationNote: "" },
      bundleT1
    );
    const verifiedT2 = proposalService.buildVerifiedCreateBundle(
      { specKey: SPEC, topicKey: TOPIC, observationNote: "" },
      bundleT2
    );

    expect(bundleT1.evidenceSnapshotHash).not.toBe(bundleT2.evidenceSnapshotHash);
    expect(verifiedT1.idempotencyKey).toBe(verifiedT2.idempotencyKey);
    expect(verifiedT1.targetSnapshot.targetSnapshotHash).not.toBe(
      verifiedT2.targetSnapshot.targetSnapshotHash
    );
  });

  test("end-to-end temporal retry returns first proposal unchanged", async () => {
    const bundleT1 = bundleAt("2026-08-01T12:00:00.000Z");
    const bundleT2 = bundleAt("2026-08-01T12:00:01.000Z");
    const identity = deriveObservationIdentityHash(bundleT1.sourceEvidence);
    const advisorySourceRef = buildAdvisorySourceRef(TOPIC, identity);
    const existing = {
      actionId: "first-action",
      idempotencyKey: deriveIdempotencyKey({
        specKey: SPEC,
        topicKey: TOPIC,
        advisoryAction: "CONSIDER_FLASHCARD_REVISION",
        observationIdentityHash: identity,
      }),
      status: "PROPOSED",
      specKey: SPEC,
      topicKey: TOPIC,
      sourceEvidence: bundleT1.sourceEvidence,
      evidenceSnapshotHash: bundleT1.evidenceSnapshotHash,
      proposedPayload: { envelopeType: "OBSERVATION_ONLY", observationNote: "" },
      targetSnapshot: buildTargetSnapshot({
        specKey: SPEC,
        topicKey: TOPIC,
        advisoryAction: "CONSIDER_FLASHCARD_REVISION",
        advisorySourceRef,
        evidenceCutoffAt: new Date(bundleT1.sourceEvidence.sourceGeneratedAt),
      }),
    };

    verifyObserverProposalProvenance.mockResolvedValue(bundleT2);
    AutopilotActionProposal.findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(existing),
    });

    const result = await proposalService.createProposal(
      { specKey: SPEC, topicKey: TOPIC, observationNote: "" },
      new mongoose.Types.ObjectId()
    );

    expect(result.idempotentReplay).toBe(true);
    expect(result.proposal.actionId).toBe("first-action");
    expect(result.proposal.evidenceSnapshotHash).toBe(bundleT1.evidenceSnapshotHash);
    expect(AutopilotActionProposal.create).not.toHaveBeenCalled();
    expect(AutopilotActionEvent.create).not.toHaveBeenCalled();
  });

  test("concurrent duplicate create replays after duplicate key race", async () => {
    const bundle = bundleAt("2026-08-01T12:00:00.000Z");
    const identity = deriveObservationIdentityHash(bundle.sourceEvidence);
    const existing = {
      actionId: "winner-action",
      idempotencyKey: deriveIdempotencyKey({
        specKey: SPEC,
        topicKey: TOPIC,
        advisoryAction: "CONSIDER_FLASHCARD_REVISION",
        observationIdentityHash: identity,
      }),
      status: "PROPOSED",
      specKey: SPEC,
      topicKey: TOPIC,
      sourceEvidence: bundle.sourceEvidence,
      evidenceSnapshotHash: bundle.evidenceSnapshotHash,
      proposedPayload: { envelopeType: "OBSERVATION_ONLY", observationNote: "" },
      targetSnapshot: buildTargetSnapshot({
        specKey: SPEC,
        topicKey: TOPIC,
        advisoryAction: "CONSIDER_FLASHCARD_REVISION",
        advisorySourceRef: buildAdvisorySourceRef(TOPIC, identity),
        evidenceCutoffAt: new Date(bundle.sourceEvidence.sourceGeneratedAt),
      }),
    };

    verifyObserverProposalProvenance.mockResolvedValue(bundle);
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);
    AutopilotActionProposal.findOne = jest
      .fn()
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(existing) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(existing) });
    AutopilotActionProposal.create = jest.fn().mockRejectedValue({ code: 11000 });

    const result = await proposalService.createProposal(
      { specKey: SPEC, topicKey: TOPIC, observationNote: "" },
      new mongoose.Types.ObjectId()
    );

    expect(result.idempotentReplay).toBe(true);
    expect(result.proposal.actionId).toBe("winner-action");
    expect(session.abortTransaction).toHaveBeenCalled();
  });

  test("validateCreateRequest accepts alias lookup coordinates only", () => {
    expect(
      validateCreateRequest({
        specKey: SPEC,
        topicKey: "cell-structure",
        observationNote: "note",
      })
    ).toEqual({
      specKey: SPEC,
      topicKey: "cell-structure",
      observationNote: "note",
    });
  });

  test("replay comparator proof for temporal siblings", () => {
    const bundleT1 = bundleAt("2026-08-01T12:00:00.000Z");
    const bundleT2 = bundleAt("2026-08-01T12:00:01.000Z");
    const existing = {
      sourceEvidence: bundleT1.sourceEvidence,
      evidenceSnapshotHash: bundleT1.evidenceSnapshotHash,
      proposedPayload: { observationNote: "same" },
    };
    expect(
      canonicalReplayMatches(
        { observationNote: "same", verifiedSourceEvidence: bundleT2.sourceEvidence },
        existing
      )
    ).toBe(true);
    expect(bundleT1.evidenceSnapshotHash).not.toBe(bundleT2.evidenceSnapshotHash);
  });
});
