/**
 * @jest-environment node
 */
const mongoose = require("mongoose");
const runtime = require("../config/autopilotPreparationRuntime");
const { PREPARATION_RECORD_CANDIDATE_POLICY_VERSION } = require("../contracts/autopilotPreparationRecordCandidate.v1");

jest.mock("../models/AutopilotPreparationRecord");

const AutopilotPreparationRecord = require("../models/AutopilotPreparationRecord");
const {
  getPreparationRecord,
  PreparationRecordRetrievalError,
} = require("../services/autopilotPreparation/getPreparationRecord");

const ACTOR_ID = new mongoose.Types.ObjectId();
const RECORD_ID = new mongoose.Types.ObjectId();

function validStoredRecord(overrides = {}) {
  const recordCandidate = {
    policyVersion: PREPARATION_RECORD_CANDIDATE_POLICY_VERSION,
    actionId: "approved-b2",
    preparationAuthoritySnapshot: {
      preparationAuthoritySnapshotVersion: "autopilot-preparation-authority-snapshot-v1",
      actionId: "approved-b2",
    },
    preparationAuthoritySnapshotHash: "a".repeat(64),
    eligibilitySnapshot: {
      policyVersion: "autopilot-safety-preparation-eligibility-v1",
      classification: "ELIGIBLE_FOR_FUTURE_PREPARATION",
      blockingReasons: [],
      evidenceAuthority: "approvalSnapshot",
      evaluatedAt: "2026-08-15T08:00:00.000Z",
    },
    eligibilityAuditHash: "b".repeat(64),
    eligibilitySemanticHash: "c".repeat(64),
    preparationRecordSemanticIdentityHash: "d".repeat(64),
  };

  return {
    _id: RECORD_ID,
    actionId: "approved-b2",
    preparationRecordSemanticIdentityHash: recordCandidate.preparationRecordSemanticIdentityHash,
    recordCandidate,
    actorId: ACTOR_ID,
    actorRole: "admin",
    createdAt: new Date("2026-08-16T10:00:00.000Z"),
    ...overrides,
  };
}

function mockFindOneLean(result) {
  return {
    lean: jest.fn().mockResolvedValue(result),
  };
}

describe("autopilot preparation record retrieval P1.3", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_RETRIEVAL_ENABLED;
  });

  test("retrieval gate is strict default-OFF", () => {
    expect(runtime.isPreparationRecordRetrievalEnabled()).toBe(false);
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_RETRIEVAL_ENABLED = "true";
    expect(runtime.isPreparationRecordRetrievalEnabled()).toBe(true);
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_RETRIEVAL_ENABLED = "1";
    expect(runtime.isPreparationRecordRetrievalEnabled()).toBe(true);
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_RETRIEVAL_ENABLED = "yes";
    expect(runtime.isPreparationRecordRetrievalEnabled()).toBe(false);
  });

  test("gate disabled throws PREPARATION_RECORD_RETRIEVAL_DISABLED", async () => {
    await expect(getPreparationRecord("approved-b2")).rejects.toMatchObject({
      code: "PREPARATION_RECORD_RETRIEVAL_DISABLED",
    });
    expect(AutopilotPreparationRecord.findOne).not.toHaveBeenCalled();
  });

  test("missing actionId throws INVALID_RETRIEVAL_REQUEST", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_RETRIEVAL_ENABLED = "true";

    await expect(getPreparationRecord("   ")).rejects.toMatchObject({
      code: "INVALID_RETRIEVAL_REQUEST",
    });
    expect(AutopilotPreparationRecord.findOne).not.toHaveBeenCalled();
  });

  test("record not found throws PREPARATION_RECORD_NOT_FOUND", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_RETRIEVAL_ENABLED = "true";
    AutopilotPreparationRecord.findOne.mockReturnValue(mockFindOneLean(null));

    await expect(getPreparationRecord("missing")).rejects.toMatchObject({
      code: "PREPARATION_RECORD_NOT_FOUND",
      details: { actionId: "missing" },
    });
  });

  test("happy path returns lean persisted snapshot with ObjectId and Date fidelity", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_RETRIEVAL_ENABLED = "true";
    const stored = validStoredRecord();
    AutopilotPreparationRecord.findOne.mockReturnValue(mockFindOneLean(stored));

    const result = await getPreparationRecord("approved-b2");

    expect(result).toBe(stored);
    expect(result._id).toEqual(RECORD_ID);
    expect(result.actorId).toEqual(ACTOR_ID);
    expect(result.createdAt).toEqual(new Date("2026-08-16T10:00:00.000Z"));
    expect(result.save).toBeUndefined();
    expect(typeof result.toObject).toBe("undefined");
    expect(AutopilotPreparationRecord.findOne).toHaveBeenCalledWith({ actionId: "approved-b2" });
  });

  test("repeat reads return the same lean snapshot reference from query", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_RETRIEVAL_ENABLED = "true";
    const stored = validStoredRecord();
    AutopilotPreparationRecord.findOne.mockReturnValue(mockFindOneLean(stored));

    const first = await getPreparationRecord("approved-b2");
    const second = await getPreparationRecord("approved-b2");

    expect(first).toBe(second);
    expect(first).toBe(stored);
  });

  test("service does not read proposal model or revalidate authority", async () => {
    const source = require("fs").readFileSync(
      require("path").join(__dirname, "../services/autopilotPreparation/getPreparationRecord.js"),
      "utf8"
    );
    expect(source).not.toMatch(/AutopilotActionProposal/);
    expect(source).not.toMatch(/evaluatePreparationEligibility/);
    expect(source).not.toMatch(/buildPreparationRecordCandidate/);
    expect(source).not.toMatch(/\.save\s*\(/);
    expect(source).not.toMatch(/findOneAndUpdate/);
    expect(source).not.toMatch(/\.create\s*\(/);
    expect(source).not.toMatch(/JSON\.parse/);
    expect(source).not.toMatch(/JSON\.stringify/);
    expect(source).not.toMatch(/structuredClone/);
  });

  test("PreparationRecordRetrievalError is defined", () => {
    expect(PreparationRecordRetrievalError).toBeDefined();
    const err = new PreparationRecordRetrievalError("TEST", "test");
    expect(err.name).toBe("PreparationRecordRetrievalError");
    expect(err.code).toBe("TEST");
    expect(err.statusCode).toBeUndefined();
  });
});
