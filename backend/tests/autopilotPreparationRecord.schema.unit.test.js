/**
 * @jest-environment node
 */
const mongoose = require("mongoose");
const { PREPARATION_RECORD_CANDIDATE_POLICY_VERSION } = require("../contracts/autopilotPreparationRecordCandidate.v1");
const {
  PREPARATION_RECORD_PERSISTENCE_POLICY_VERSION,
  PREPARATION_RECORD_EVENT_CREATED,
} = require("../contracts/autopilotPreparationRecordPersistence.v1");
const {
  AutopilotPreparationRecordSchema,
  FORBIDDEN_RECORD_FIELDS,
} = require("../models/AutopilotPreparationRecord");
const {
  AutopilotPreparationRecordEventSchema,
  FORBIDDEN_EVENT_DETAIL_FIELDS,
} = require("../models/AutopilotPreparationRecordEvent");

const AutopilotPreparationRecord = mongoose.model(
  "AutopilotPreparationRecordSchemaTest",
  AutopilotPreparationRecordSchema,
  "autopilot_preparation_records_test"
);

const AutopilotPreparationRecordEvent = mongoose.model(
  "AutopilotPreparationRecordEventSchemaTest",
  AutopilotPreparationRecordEventSchema,
  "autopilot_preparation_record_events_test"
);

const actorId = new mongoose.Types.ObjectId();

function validCandidate(overrides = {}) {
  return {
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
    ...overrides,
  };
}

function validRecordInput(overrides = {}) {
  const candidate = validCandidate(overrides.recordCandidate);
  return {
    actionId: candidate.actionId,
    preparationRecordSemanticIdentityHash: candidate.preparationRecordSemanticIdentityHash,
    recordCandidate: candidate,
    actorId,
    actorRole: "admin",
    ...overrides,
  };
}

function recordIndexes() {
  return AutopilotPreparationRecordSchema.indexes();
}

function eventIndexes() {
  return AutopilotPreparationRecordEventSchema.indexes();
}

function hasUniqueIndexOnField(indexes, fieldName) {
  return indexes.some((entry) => {
    const keys = entry[0] || {};
    const options = entry[1] || {};
    return keys[fieldName] === 1 && options.unique === true;
  });
}

function hasUniqueCompoundIndex(indexes, keyNames) {
  return indexes.some((entry) => {
    const keys = entry[0] || {};
    const options = entry[1] || {};
    return keyNames.every((name) => keys[name] === 1) && options.unique === true;
  });
}

function hasIndexOnField(indexes, fieldName) {
  return indexes.some((entry) => {
    const keys = entry[0] || {};
    return keys[fieldName] === 1;
  });
}

describe("AutopilotPreparationRecord schema", () => {
  test("valid record with exact P1.1 candidate projection invariants", () => {
    const doc = new AutopilotPreparationRecord(validRecordInput());
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  test("actionId unique index declared", () => {
    expect(hasUniqueIndexOnField(recordIndexes(), "actionId")).toBe(true);
  });

  test("preparationRecordSemanticIdentityHash is stored but not indexed", () => {
    expect(hasIndexOnField(recordIndexes(), "preparationRecordSemanticIdentityHash")).toBe(false);
    expect(AutopilotPreparationRecordSchema.path("preparationRecordSemanticIdentityHash").options.index).not.toBe(
      true
    );
  });

  test("record has createdAt only and no updatedAt", () => {
    expect(AutopilotPreparationRecordSchema.path("createdAt")).toBeDefined();
    expect(AutopilotPreparationRecordSchema.path("updatedAt")).toBeUndefined();
    expect(AutopilotPreparationRecordSchema.options.timestamps).toEqual({
      createdAt: true,
      updatedAt: false,
    });
  });

  test("record fields are immutable", () => {
    const path = (name) => AutopilotPreparationRecordSchema.path(name);
    expect(path("actionId").options.immutable).toBe(true);
    expect(path("preparationRecordSemanticIdentityHash").options.immutable).toBe(true);
    expect(path("recordCandidate").options.immutable).toBe(true);
    expect(path("actorId").options.immutable).toBe(true);
    expect(path("actorRole").options.immutable).toBe(true);
  });

  test("rejects projection mismatch on actionId", () => {
    const doc = new AutopilotPreparationRecord(
      validRecordInput({ actionId: "different-action-id" })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.actionId).toBeDefined();
  });

  test("rejects projection mismatch on semantic identity hash", () => {
    const doc = new AutopilotPreparationRecord(
      validRecordInput({ preparationRecordSemanticIdentityHash: "e".repeat(64) })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.preparationRecordSemanticIdentityHash).toBeDefined();
  });

  test.each(FORBIDDEN_RECORD_FIELDS)("forbidden field %s rejected in recordCandidate", (field) => {
    const candidate = validCandidate({ [field]: "forbidden" });
    const doc = new AutopilotPreparationRecord(validRecordInput({ recordCandidate: candidate }));
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.message).toMatch(new RegExp(field));
  });
});

describe("AutopilotPreparationRecordEvent schema", () => {
  test("valid PREPARATION_RECORD_CREATED event", () => {
    const recordId = new mongoose.Types.ObjectId();
    const doc = new AutopilotPreparationRecordEvent({
      actionId: "approved-b2",
      eventType: PREPARATION_RECORD_EVENT_CREATED,
      policyVersion: PREPARATION_RECORD_PERSISTENCE_POLICY_VERSION,
      preparationRecordId: recordId,
      preparationRecordSemanticIdentityHash: "d".repeat(64),
      actorId,
      actorRole: "admin",
      timestamp: new Date("2026-08-15T08:00:01.000Z"),
      details: {
        preparationAuthoritySnapshotHash: "a".repeat(64),
        eligibilityAuditHash: "b".repeat(64),
        eligibilitySemanticHash: "c".repeat(64),
      },
    });
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  test("unique compound index on preparationRecordId and eventType only", () => {
    const indexes = eventIndexes();
    expect(hasUniqueCompoundIndex(indexes, ["preparationRecordId", "eventType"])).toBe(true);
    expect(indexes).toHaveLength(1);
    expect(hasIndexOnField(indexes, "actionId")).toBe(false);
  });

  test("event uses explicit timestamp only with no mongoose timestamps", () => {
    expect(AutopilotPreparationRecordEventSchema.path("timestamp")).toBeDefined();
    expect(AutopilotPreparationRecordEventSchema.path("createdAt")).toBeUndefined();
    expect(AutopilotPreparationRecordEventSchema.path("updatedAt")).toBeUndefined();
    expect(AutopilotPreparationRecordEventSchema.options.timestamps).toBe(false);
  });

  test("event identity fields are immutable", () => {
    const path = (name) => AutopilotPreparationRecordEventSchema.path(name);
    expect(path("actionId").options.immutable).toBe(true);
    expect(path("eventType").options.immutable).toBe(true);
    expect(path("preparationRecordId").options.immutable).toBe(true);
    expect(path("timestamp").options.immutable).toBe(true);
    expect(path("details").options.immutable).toBe(true);
  });

  test.each(FORBIDDEN_EVENT_DETAIL_FIELDS)(
    "forbidden detail field %s rejected",
    (field) => {
      const recordId = new mongoose.Types.ObjectId();
      const doc = new AutopilotPreparationRecordEvent({
        actionId: "approved-b2",
        eventType: PREPARATION_RECORD_EVENT_CREATED,
        policyVersion: PREPARATION_RECORD_PERSISTENCE_POLICY_VERSION,
        preparationRecordId: recordId,
        preparationRecordSemanticIdentityHash: "d".repeat(64),
        actorId,
        actorRole: "admin",
        details: {
          preparationAuthoritySnapshotHash: "a".repeat(64),
          eligibilityAuditHash: "b".repeat(64),
          eligibilitySemanticHash: "c".repeat(64),
          [field]: "forbidden",
        },
      });
      const err = doc.validateSync();
      expect(err).toBeDefined();
    }
  );
});
