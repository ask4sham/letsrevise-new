/**
 * @jest-environment node
 */
const mongoose = require("mongoose");
const policy = require("../contracts/autopilotSafetyPolicy.v1");
const {
  AutopilotActionProposalSchema,
  defaultExpiresAt,
} = require("../models/AutopilotActionProposal");
const {
  AutopilotActionEventSchema,
  S1_RESERVED_FUTURE_EVENT_TYPES,
} = require("../models/AutopilotActionEvent");

const AutopilotActionProposal = mongoose.model(
  "AutopilotActionProposalTest",
  AutopilotActionProposalSchema,
  "autopilot_action_proposals_test"
);

const AutopilotActionEvent = mongoose.model(
  "AutopilotActionEventTest",
  AutopilotActionEventSchema,
  "autopilot_action_events_test"
);

const uid = () => new mongoose.Types.ObjectId();

function validTargetSnapshot(overrides = {}) {
  return {
    targetType: "SPEC_TOPIC_OBSERVATION",
    specKey: "aqa_gcse_physics",
    topicKey: "P4.1.1",
    advisoryAction: "CONSIDER_FLASHCARD_REVISION",
    advisorySourceRef: "execution-contract-intelligence:hash-abc",
    evidenceCutoffAt: new Date("2026-08-01T12:00:00.000Z"),
    targetCount: 0,
    targetSnapshotHash: "sha256:deadbeef",
    targetSnapshotVersion: policy.TARGET_SNAPSHOT_VERSION,
    ...overrides,
  };
}

function validProposalInput(overrides = {}) {
  const specKey = overrides.specKey || "aqa_gcse_physics";
  const topicKey = overrides.topicKey || "P4.1.1";
  return {
    idempotencyKey: overrides.idempotencyKey || "idem-key-001",
    actionType: "OBSERVER_DERIVED_PROPOSAL",
    autopilotObserverVersion: "autopilot0-execution-contract-intelligence-v1",
    advisorySource: {
      observer: "execution-contract-intelligence",
      advisoryAction: "CONSIDER_FLASHCARD_REVISION",
      specKey,
      topicKey,
    },
    specKey,
    topicKey,
    minimumPermissionLevel: "L2",
    targetSnapshot: validTargetSnapshot({ specKey, topicKey }),
    proposedPayload: {
      envelopeType: "OBSERVATION_ONLY",
      observationNote: "Observer-derived observation only — not executable.",
    },
    ...overrides,
  };
}

function proposalIndexes() {
  return AutopilotActionProposalSchema.indexes();
}

function eventIndexes() {
  return AutopilotActionEventSchema.indexes();
}

function hasTtlDeletionIndex(indexes) {
  return indexes.some((entry) => {
    const options = entry[1] || {};
    return options.expireAfterSeconds != null;
  });
}

function hasUniqueIndexOnField(indexes, fieldName) {
  return indexes.some((entry) => {
    const keys = entry[0] || {};
    const options = entry[1] || {};
    return keys[fieldName] === 1 && options.unique === true;
  });
}

describe("AutopilotActionProposal schema", () => {
  test("valid minimal PROPOSED proposal", () => {
    const doc = new AutopilotActionProposal(validProposalInput());
    const err = doc.validateSync();
    expect(err).toBeUndefined();
    expect(doc.actionId).toBeTruthy();
    expect(doc.status).toBe("PROPOSED");
  });

  test("default status is PROPOSED", () => {
    const doc = new AutopilotActionProposal(validProposalInput());
    expect(doc.status).toBe("PROPOSED");
  });

  test("default expiresAt is approximately 7 days ahead", () => {
    const before = Date.now();
    const expiresAt = defaultExpiresAt();
    const after = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  test("expiresAt is NOT backed by TTL deletion index", () => {
    const indexes = proposalIndexes();
    expect(hasTtlDeletionIndex(indexes)).toBe(false);
    const expiresAtIndex = indexes.find((entry) => entry[0].expiresAt != null);
    expect(expiresAtIndex).toBeDefined();
    expect(expiresAtIndex[1].expireAfterSeconds).toBeUndefined();
  });

  test("actionId uniqueness declared", () => {
    expect(hasUniqueIndexOnField(proposalIndexes(), "actionId")).toBe(true);
  });

  test("idempotencyKey uniqueness declared", () => {
    expect(hasUniqueIndexOnField(proposalIndexes(), "idempotencyKey")).toBe(true);
  });

  test("immutable stable identity fields", () => {
    const path = (name) => AutopilotActionProposalSchema.path(name);
    expect(path("actionId").options.immutable).toBe(true);
    expect(path("idempotencyKey").options.immutable).toBe(true);
    expect(path("actionType").options.immutable).toBe(true);
    expect(path("policyVersion").options.immutable).toBe(true);
    expect(path("targetSnapshot").options.immutable).toBe(true);
  });

  test("only SPEC_TOPIC_OBSERVATION accepted as targetType", () => {
    const doc = new AutopilotActionProposal(
      validProposalInput({
        targetSnapshot: validTargetSnapshot({ targetType: "SINGLE_STUDENT" }),
      })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors["targetSnapshot.targetType"]).toBeDefined();
  });

  test("targetCount must be 0", () => {
    const doc = new AutopilotActionProposal(
      validProposalInput({
        targetSnapshot: validTargetSnapshot({ targetCount: 1 }),
      })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors["targetSnapshot.targetCount"]).toBeDefined();
  });

  test("student identifiers rejected via strict target snapshot", () => {
    const doc = new AutopilotActionProposal(
      validProposalInput({
        targetSnapshot: {
          ...validTargetSnapshot(),
          studentId: uid(),
        },
      })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.targetSnapshot).toBeDefined();
  });

  test("class/teacher target fields rejected via strict target snapshot", () => {
    let doc = new AutopilotActionProposal(
      validProposalInput({
        targetSnapshot: {
          ...validTargetSnapshot(),
          classPublicId: "class-123",
        },
      })
    );
    let err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.targetSnapshot).toBeDefined();

    doc = new AutopilotActionProposal(
      validProposalInput({
        targetSnapshot: {
          ...validTargetSnapshot(),
          ownerTeacherId: uid(),
        },
      })
    );
    err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.targetSnapshot).toBeDefined();
  });

  test("proposal spec/topic must match target snapshot", () => {
    const doc = new AutopilotActionProposal(
      validProposalInput({
        specKey: "aqa_gcse_physics",
        topicKey: "P4.1.1",
        targetSnapshot: validTargetSnapshot({ specKey: "edexcel_gcse_physics", topicKey: "P4.1.1" }),
      })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors["targetSnapshot.specKey"]).toBeDefined();
  });

  test("reserved future execution status rejected", () => {
    for (const reservedState of policy.S1_RESERVED_FUTURE_STATES) {
      const doc = new AutopilotActionProposal(
        validProposalInput({ status: reservedState })
      );
      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.status).toBeDefined();
    }
  });

  test("APPROVED requires review fields and approval snapshot", () => {
    const reviewer = uid();
    const doc = new AutopilotActionProposal(
      validProposalInput({
        status: "APPROVED",
        reviewedBy: reviewer,
        reviewedAt: new Date(),
      })
    );
    let err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.approvalSnapshot).toBeDefined();

    const approved = new AutopilotActionProposal(
      validProposalInput({
        status: "APPROVED",
        reviewedBy: reviewer,
        reviewedAt: new Date(),
        approvalSnapshot: {
          targetSnapshot: validTargetSnapshot(),
          proposedPayload: { envelopeType: "OBSERVATION_ONLY" },
          policyVersion: policy.POLICY_VERSION,
          minimumPermissionLevel: "L2",
          advisorySource: {
            observer: "execution-contract-intelligence",
            advisoryAction: "CONSIDER_FLASHCARD_REVISION",
            specKey: "aqa_gcse_physics",
            topicKey: "P4.1.1",
          },
          evidenceCutoffAt: new Date("2026-08-01T12:00:00.000Z"),
          idempotencyKey: "idem-key-001",
          approvedAt: new Date(),
          approverId: reviewer,
          approverRole: "admin",
          expiresAt: defaultExpiresAt(),
        },
      })
    );
    err = approved.validateSync();
    expect(err).toBeUndefined();
  });

  test("REJECTED requires reviewer and reason", () => {
    const doc = new AutopilotActionProposal(
      validProposalInput({ status: "REJECTED" })
    );
    let err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.reviewedBy).toBeDefined();
    expect(err.errors.rejectionReason).toBeDefined();

    const rejected = new AutopilotActionProposal(
      validProposalInput({
        status: "REJECTED",
        reviewedBy: uid(),
        reviewedAt: new Date(),
        rejectionReason: "Not appropriate at this time",
      })
    );
    err = rejected.validateSync();
    expect(err).toBeUndefined();
  });

  test("PROPOSED cannot carry approval snapshot", () => {
    const doc = new AutopilotActionProposal(
      validProposalInput({
        approvalSnapshot: {
          targetSnapshot: validTargetSnapshot(),
          proposedPayload: { envelopeType: "OBSERVATION_ONLY" },
          policyVersion: policy.POLICY_VERSION,
          minimumPermissionLevel: "L2",
          advisorySource: {
            observer: "execution-contract-intelligence",
            advisoryAction: "CONSIDER_FLASHCARD_REVISION",
            specKey: "aqa_gcse_physics",
            topicKey: "P4.1.1",
          },
          evidenceCutoffAt: new Date("2026-08-01T12:00:00.000Z"),
          idempotencyKey: "idem-key-001",
          approvedAt: new Date(),
          approverId: uid(),
          approverRole: "admin",
          expiresAt: defaultExpiresAt(),
        },
      })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.approvalSnapshot).toBeDefined();
  });

  test("proposedPayload rejects executable Mixed-style fields", () => {
    const doc = new AutopilotActionProposal(
      validProposalInput({
        proposedPayload: {
          envelopeType: "OBSERVATION_ONLY",
          studentIds: [uid().toString()],
        },
      })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.proposedPayload).toBeDefined();
  });

  test("only OBSERVER_DERIVED_PROPOSAL actionType accepted", () => {
    const doc = new AutopilotActionProposal(
      validProposalInput({ actionType: "ASSIGN_FLASHCARDS" })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.actionType).toBeDefined();
  });
});

describe("AutopilotActionEvent schema", () => {
  test("valid PROPOSED event", () => {
    const doc = new AutopilotActionEvent({
      actionId: "action-001",
      eventType: "PROPOSED",
      actorRole: "admin",
      actorId: uid(),
      details: { note: "proposal created" },
    });
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  test.each(["APPROVED", "REJECTED", "EXPIRED"])("accepts %s event type", (eventType) => {
    const doc = new AutopilotActionEvent({
      actionId: "action-001",
      eventType,
      actorRole: "admin",
      actorId: uid(),
    });
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  test("execution/rollback event types rejected", () => {
    for (const reservedType of S1_RESERVED_FUTURE_EVENT_TYPES) {
      const doc = new AutopilotActionEvent({
        actionId: "action-001",
        eventType: reservedType,
        actorRole: "admin",
      });
      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.eventType).toBeDefined();
    }
  });

  test("no student PII fields in event details schema", () => {
    const doc = new AutopilotActionEvent({
      actionId: "action-001",
      eventType: "PROPOSED",
      actorRole: "admin",
      details: {
        note: "ok",
        email: "student@example.com",
      },
    });
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.details).toBeDefined();
  });

  test("no TTL event deletion index", () => {
    expect(hasTtlDeletionIndex(eventIndexes())).toBe(false);
  });

  test("event identity fields are immutable", () => {
    const path = (name) => AutopilotActionEventSchema.path(name);
    expect(path("actionId").options.immutable).toBe(true);
    expect(path("eventType").options.immutable).toBe(true);
    expect(path("timestamp").options.immutable).toBe(true);
    expect(path("details").options.immutable).toBe(true);
  });

  test("actionId + timestamp lookup index declared", () => {
    const indexes = eventIndexes();
    const lookup = indexes.find(
      (entry) => entry[0].actionId === 1 && entry[0].timestamp === -1
    );
    expect(lookup).toBeDefined();
  });
});
