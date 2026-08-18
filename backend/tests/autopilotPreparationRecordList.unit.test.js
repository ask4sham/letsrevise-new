/**
 * @jest-environment node
 */
const mongoose = require("mongoose");
const runtime = require("../config/autopilotPreparationRuntime");
const { PREPARATION_RECORD_CANDIDATE_POLICY_VERSION } = require("../contracts/autopilotPreparationRecordCandidate.v1");
const { PreparationRecordListError } = require("../contracts/autopilotPreparationRecordList.v1");

jest.mock("../models/AutopilotPreparationRecord");

const AutopilotPreparationRecord = require("../models/AutopilotPreparationRecord");
const {
  listPreparationRecords,
  parseListQuery,
} = require("../services/autopilotPreparation/listPreparationRecords");

const ACTOR_ID = new mongoose.Types.ObjectId();
const RECORD_ID_A = new mongoose.Types.ObjectId();
const RECORD_ID_B = new mongoose.Types.ObjectId();

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
    _id: RECORD_ID_A,
    actionId: "approved-b2",
    preparationRecordSemanticIdentityHash: recordCandidate.preparationRecordSemanticIdentityHash,
    recordCandidate,
    actorId: ACTOR_ID,
    actorRole: "admin",
    createdAt: new Date("2026-08-16T10:00:00.000Z"),
    ...overrides,
  };
}

function mockFindChain(records) {
  const lean = jest.fn().mockResolvedValue(records);
  const limit = jest.fn().mockReturnValue({ lean });
  const skip = jest.fn().mockReturnValue({ limit });
  const sort = jest.fn().mockReturnValue({ skip });
  return { sort, skip, limit, lean };
}

describe("autopilot preparation record list P1.5", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_RETRIEVAL_ENABLED;
  });

  test("list reuses strict default-OFF retrieval gate", () => {
    expect(runtime.isPreparationRecordRetrievalEnabled()).toBe(false);
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_RETRIEVAL_ENABLED = "true";
    expect(runtime.isPreparationRecordRetrievalEnabled()).toBe(true);
  });

  test("gate disabled throws PREPARATION_RECORD_RETRIEVAL_DISABLED", async () => {
    await expect(listPreparationRecords({})).rejects.toMatchObject({
      code: "PREPARATION_RECORD_RETRIEVAL_DISABLED",
    });
    expect(AutopilotPreparationRecord.find).not.toHaveBeenCalled();
  });

  test("parseListQuery defaults limit 20 and offset 0", () => {
    expect(parseListQuery({})).toEqual({ limit: 20, offset: 0 });
  });

  test("parseListQuery caps limit at 50 and floors offset at 0", () => {
    expect(parseListQuery({ limit: "999", offset: "-5" })).toEqual({ limit: 50, offset: 0 });
  });

  test("parseListQuery rejects non-numeric limit", () => {
    expect(() => parseListQuery({ limit: "abc" })).toThrow(PreparationRecordListError);
    try {
      parseListQuery({ limit: "abc" });
    } catch (err) {
      expect(err.code).toBe("INVALID_LIST_REQUEST");
    }
  });

  test("parseListQuery rejects non-numeric offset", () => {
    expect(() => parseListQuery({ offset: "xyz" })).toThrow(PreparationRecordListError);
    try {
      parseListQuery({ offset: "xyz" });
    } catch (err) {
      expect(err.code).toBe("INVALID_LIST_REQUEST");
    }
  });

  test("happy path returns lean records with bounded pagination", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_RETRIEVAL_ENABLED = "true";
    const records = [
      validStoredRecord(),
      validStoredRecord({
        _id: RECORD_ID_B,
        actionId: "approved-a1",
        createdAt: new Date("2026-08-15T09:00:00.000Z"),
      }),
    ];
    const chain = mockFindChain(records);
    AutopilotPreparationRecord.find.mockReturnValue(chain);
    AutopilotPreparationRecord.countDocuments.mockResolvedValue(2);

    const result = await listPreparationRecords({ limit: "10", offset: "0" });

    expect(result.records).toBe(records);
    expect(result.pagination).toEqual({ limit: 10, offset: 0, total: 2 });
    expect(AutopilotPreparationRecord.find).toHaveBeenCalledWith({});
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1, actionId: -1 });
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(chain.lean).toHaveBeenCalled();
  });

  test("empty collection returns zero records and total 0", async () => {
    process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_RETRIEVAL_ENABLED = "true";
    const chain = mockFindChain([]);
    AutopilotPreparationRecord.find.mockReturnValue(chain);
    AutopilotPreparationRecord.countDocuments.mockResolvedValue(0);

    const result = await listPreparationRecords({});

    expect(result.records).toEqual([]);
    expect(result.pagination).toEqual({ limit: 20, offset: 0, total: 0 });
  });

  test("service does not read proposals, events, or mutate records", async () => {
    const source = require("fs").readFileSync(
      require("path").join(__dirname, "../services/autopilotPreparation/listPreparationRecords.js"),
      "utf8"
    );
    expect(source).not.toMatch(/AutopilotActionProposal/);
    expect(source).not.toMatch(/AutopilotPreparationRecordEvent/);
    expect(source).not.toMatch(/evaluatePreparationEligibility/);
    expect(source).not.toMatch(/buildPreparationRecordCandidate/);
    expect(source).not.toMatch(/persistPreparationRecord/);
    expect(source).not.toMatch(/getPreparationRecord/);
    expect(source).not.toMatch(/\.save\s*\(/);
    expect(source).not.toMatch(/findOneAndUpdate/);
    expect(source).not.toMatch(/\.create\s*\(/);
  });

  test("PreparationRecordListError is defined", () => {
    const err = new PreparationRecordListError("TEST", "test");
    expect(err.name).toBe("PreparationRecordListError");
    expect(err.code).toBe("TEST");
  });
});
