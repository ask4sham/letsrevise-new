/**
 * @jest-environment node
 */
const mongoose = require("mongoose");
const runtime = require("../config/autopilotSafetyRuntime");
const {
  deriveIdempotencyKey,
  computeTargetSnapshotHash,
  buildCanonicalTargetSnapshotFields,
  buildTargetSnapshot,
  canonicalContentMatches,
  buildCanonicalAcceptedCreateContent,
} = require("../services/autopilotSafety/idempotencyKey");
const {
  validateCreateRequest,
  AutopilotSafetyError,
} = require("../services/autopilotSafety/proposalValidation");

jest.mock("../models/AutopilotActionProposal");
jest.mock("../models/AutopilotActionEvent");

const AutopilotActionProposal = require("../models/AutopilotActionProposal");
const AutopilotActionEvent = require("../models/AutopilotActionEvent");
const proposalService = require("../services/autopilotSafety/proposalService");

const validInput = () => ({
  specKey: "aqa_gcse_physics",
  topicKey: "P4.1.1",
  advisoryAction: "CONSIDER_FLASHCARD_REVISION",
  autopilotObserverVersion: "autopilot0-execution-contract-intelligence-v1",
  observer: "execution-contract-intelligence",
  advisorySourceRef: "observer-ref-001",
  evidenceCutoffAt: new Date("2026-08-01T12:00:00.000Z"),
  minimumPermissionLevel: "L2",
  observationNote: "Observation only",
});

function mockSession() {
  const session = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
  return session;
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

describe("idempotencyKey", () => {
  test("server computes deterministic targetSnapshotHash", () => {
    const fields = buildCanonicalTargetSnapshotFields(validInput());
    const hashA = computeTargetSnapshotHash(fields);
    const hashB = computeTargetSnapshotHash(fields);
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
  });

  test("deriveIdempotencyKey uses server hash", () => {
    const snapshot = buildTargetSnapshot(validInput());
    const key = deriveIdempotencyKey({
      specKey: validInput().specKey,
      topicKey: validInput().topicKey,
      advisoryAction: validInput().advisoryAction,
      targetSnapshotHash: snapshot.targetSnapshotHash,
      evidenceCutoffAt: validInput().evidenceCutoffAt,
    });
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  test("new evidence cutoff changes identity", () => {
    const snapshot = buildTargetSnapshot(validInput());
    const keyA = deriveIdempotencyKey({
      specKey: validInput().specKey,
      topicKey: validInput().topicKey,
      advisoryAction: validInput().advisoryAction,
      targetSnapshotHash: snapshot.targetSnapshotHash,
      evidenceCutoffAt: validInput().evidenceCutoffAt,
    });
    const keyB = deriveIdempotencyKey({
      specKey: validInput().specKey,
      topicKey: validInput().topicKey,
      advisoryAction: validInput().advisoryAction,
      targetSnapshotHash: snapshot.targetSnapshotHash,
      evidenceCutoffAt: new Date("2026-08-02T12:00:00.000Z"),
    });
    expect(keyA).not.toBe(keyB);
  });
});

describe("proposalValidation", () => {
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

  test("rejects policy permission mismatch", () => {
    expect(() =>
      validateCreateRequest({
        ...validInput(),
        minimumPermissionLevel: "L0",
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

describe("proposalService", () => {
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
    await expect(proposalService.createProposal(validInput(), new mongoose.Types.ObjectId())).rejects.toMatchObject({
      code: "AUTOPILOT_PROPOSALS_DISABLED",
      statusCode: 403,
    });
  });

  test("transaction unavailable returns 503", async () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "true";
    mongoose.connection.db = null;
    await expect(proposalService.createProposal(validInput(), new mongoose.Types.ObjectId())).rejects.toMatchObject({
      code: "TRANSACTIONS_UNAVAILABLE",
      statusCode: 503,
    });
  });

  test("exact replay returns existing without second event", async () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "true";
    mongoose.startSession = jest.fn().mockResolvedValue(mockSession());
    const input = validInput();
    const canonical = buildCanonicalAcceptedCreateContent(input);
    const snapshot = buildTargetSnapshot(input);
    const idempotencyKey = deriveIdempotencyKey({
      specKey: input.specKey,
      topicKey: input.topicKey,
      advisoryAction: input.advisoryAction,
      targetSnapshotHash: snapshot.targetSnapshotHash,
      evidenceCutoffAt: input.evidenceCutoffAt,
    });
    const existing = {
      actionId: "existing-action",
      idempotencyKey,
      status: "PROPOSED",
      policyVersion: canonical.policyVersion,
      actionType: canonical.actionType,
      specKey: canonical.specKey,
      topicKey: canonical.topicKey,
      autopilotObserverVersion: canonical.autopilotObserverVersion,
      minimumPermissionLevel: canonical.minimumPermissionLevel,
      advisorySource: canonical.advisorySource,
      targetSnapshot: canonical.targetSnapshot,
      proposedPayload: canonical.proposedPayload,
    };
    AutopilotActionProposal.findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(existing),
    });

    const result = await proposalService.createProposal(input, new mongoose.Types.ObjectId());
    expect(result.idempotentReplay).toBe(true);
    expect(result.proposal.actionId).toBe("existing-action");
    expect(mongoose.startSession).not.toHaveBeenCalled();
    expect(AutopilotActionEvent.create).not.toHaveBeenCalled();
  });

  test("same key different observationNote conflicts", async () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "true";
    const input = validInput();
    const snapshot = buildTargetSnapshot(input);
    const idempotencyKey = deriveIdempotencyKey({
      specKey: input.specKey,
      topicKey: input.topicKey,
      advisoryAction: input.advisoryAction,
      targetSnapshotHash: snapshot.targetSnapshotHash,
      evidenceCutoffAt: input.evidenceCutoffAt,
    });
    const existing = {
      actionId: "existing-action",
      idempotencyKey,
      status: "PROPOSED",
      specKey: input.specKey,
      topicKey: input.topicKey,
      actionType: "OBSERVER_DERIVED_PROPOSAL",
      policyVersion: "autopilot-safety-policy-v1",
      autopilotObserverVersion: input.autopilotObserverVersion,
      minimumPermissionLevel: input.minimumPermissionLevel,
      advisorySource: {
        observer: input.observer,
        advisoryAction: input.advisoryAction,
        specKey: input.specKey,
        topicKey: input.topicKey,
      },
      targetSnapshot: snapshot,
      proposedPayload: {
        envelopeType: "OBSERVATION_ONLY",
        observationNote: "different note",
      },
    };
    AutopilotActionProposal.findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(existing),
    });

    await expect(
      proposalService.createProposal(input, new mongoose.Types.ObjectId())
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", statusCode: 409 });
    expect(canonicalContentMatches(input, existing)).toBe(false);
  });

  test("REJECTED same identity conflicts", async () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "true";
    const input = validInput();
    const snapshot = buildTargetSnapshot(input);
    AutopilotActionProposal.findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        actionId: "x",
        status: "REJECTED",
        idempotencyKey: "k",
        specKey: input.specKey,
        topicKey: input.topicKey,
        actionType: "OBSERVER_DERIVED_PROPOSAL",
        policyVersion: "autopilot-safety-policy-v1",
        autopilotObserverVersion: input.autopilotObserverVersion,
        minimumPermissionLevel: input.minimumPermissionLevel,
        advisorySource: {
          observer: input.observer,
          advisoryAction: input.advisoryAction,
          specKey: input.specKey,
          topicKey: input.topicKey,
        },
        targetSnapshot: snapshot,
        proposedPayload: {
          envelopeType: "OBSERVATION_ONLY",
          observationNote: input.observationNote,
        },
      }),
    });

    await expect(
      proposalService.createProposal(input, new mongoose.Types.ObjectId())
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  test("create writes proposal and PROPOSED event atomically", async () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "true";
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);
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
      expect.any(Array),
      expect.objectContaining({ session })
    );
    expect(AutopilotActionEvent.create).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "PROPOSED", actorRole: "admin" }),
      ]),
      expect.objectContaining({ session })
    );
    expect(session.commitTransaction).toHaveBeenCalled();
  });

  test("approve uses atomic expiresAt condition and freezes snapshot", async () => {
    process.env.AUTOPILOT_LEARNING_APPROVALS_ENABLED = "true";
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);
    const actorId = new mongoose.Types.ObjectId();
    const future = new Date(Date.now() + 60_000);
    const current = {
      actionId: "a1",
      status: "PROPOSED",
      expiresAt: future,
      toObject: () => ({
        actionId: "a1",
        status: "PROPOSED",
        expiresAt: future,
        policyVersion: "autopilot-safety-policy-v1",
        minimumPermissionLevel: "L2",
        idempotencyKey: "k",
        advisorySource: validInput().advisoryAction && {
          observer: "execution-contract-intelligence",
          advisoryAction: "CONSIDER_FLASHCARD_REVISION",
          specKey: "aqa_gcse_physics",
          topicKey: "P4.1.1",
        },
        targetSnapshot: buildTargetSnapshot(validInput()),
        proposedPayload: { envelopeType: "OBSERVATION_ONLY", observationNote: "" },
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    AutopilotActionProposal.findOne = jest
      .fn()
      .mockReturnValueOnce({ session: jest.fn().mockResolvedValue(current) })
      .mockReturnValueOnce({ session: jest.fn().mockResolvedValue(null).mockReturnValue({ lean: jest.fn() }) });
    AutopilotActionEvent.create = jest.fn().mockResolvedValue([]);

    await proposalService.approveProposal("a1", actorId);
    expect(current.save).toHaveBeenCalledWith(
      expect.objectContaining({ session, validateBeforeSave: true })
    );
    expect(current.approvalSnapshot).toBeDefined();
    expect(AutopilotActionEvent.create).toHaveBeenCalled();
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

  test("terminal transition rejected", async () => {
    process.env.AUTOPILOT_LEARNING_APPROVALS_ENABLED = "true";
    const session = mockSession();
    mongoose.startSession = jest.fn().mockResolvedValue(session);
    AutopilotActionProposal.findOneAndUpdate = jest.fn().mockResolvedValue(null);
    AutopilotActionProposal.findOne = jest.fn().mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ actionId: "a1", status: "APPROVED" }),
      }),
    });

    await expect(
      proposalService.expireProposal("a1", new mongoose.Types.ObjectId())
    ).rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION", statusCode: 409 });
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
