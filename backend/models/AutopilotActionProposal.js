/**
 * Autopilot Safety Foundation — S1.1 action proposal schema.
 * SPEC_TOPIC_OBSERVATION only. No student identifiers. No execution.
 * expiresAt is approval-validity deadline — NOT a Mongo TTL deletion index.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const {
  POLICY_VERSION,
  TARGET_SNAPSHOT_VERSION,
  DEFAULT_PROPOSAL_VALIDITY_DAYS,
  S1_ACTIVE_PROPOSAL_STATES,
  S1_ACTIVE_TARGET_TYPES,
  S1_ACTIVE_ACTION_TYPES,
  PROPOSED_PAYLOAD_ENVELOPE_TYPE,
  FORBIDDEN_TARGET_SNAPSHOT_FIELDS,
  isReservedFutureState,
} = require("../contracts/autopilotSafetyPolicy.v1");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const FORBIDDEN_PAYLOAD_FIELDS = Object.freeze([
  "studentId",
  "studentIds",
  "name",
  "email",
  "classPublicId",
  "classId",
  "ownerTeacherId",
  "assignmentId",
  "notificationInstructions",
  "publishInstructions",
  "gradingInstructions",
  "executionRoute",
  "writeCommand",
]);

function defaultExpiresAt() {
  return new Date(Date.now() + DEFAULT_PROPOSAL_VALIDITY_DAYS * MS_PER_DAY);
}

function generateActionId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
}

function rejectForbiddenTargetSnapshotKeys(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_TARGET_SNAPSHOT_FIELDS.includes(key)) {
      throw new Error(`targetSnapshot must not contain ${key}`);
    }
  }
  return value;
}

function rejectForbiddenPayloadKeys(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_PAYLOAD_FIELDS.includes(key)) {
      throw new Error(`proposedPayload must not contain ${key}`);
    }
  }
  return value;
}

const AdvisorySourceSchema = new mongoose.Schema(
  {
    observer: { type: String, required: true, trim: true },
    advisoryAction: { type: String, required: true, trim: true },
    specKey: { type: String, required: true, trim: true },
    topicKey: { type: String, required: true, trim: true },
  },
  { _id: false, strict: true }
);

const TargetSnapshotSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      required: true,
      enum: S1_ACTIVE_TARGET_TYPES,
    },
    specKey: { type: String, required: true, trim: true },
    topicKey: { type: String, required: true, trim: true },
    advisoryAction: { type: String, required: true, trim: true },
    advisorySourceRef: { type: String, required: true, trim: true },
    evidenceCutoffAt: { type: Date, required: true },
    targetCount: {
      type: Number,
      required: true,
      validate: {
        validator(value) {
          return value === 0;
        },
        message: "targetCount must be exactly 0 for S1.1 SPEC_TOPIC_OBSERVATION proposals",
      },
    },
    targetSnapshotHash: { type: String, required: true, trim: true },
    targetSnapshotVersion: {
      type: String,
      required: true,
      enum: [TARGET_SNAPSHOT_VERSION],
      default: TARGET_SNAPSHOT_VERSION,
    },
  },
  { _id: false, strict: "throw" }
);

TargetSnapshotSchema.pre("init", function rejectForbiddenTargetSnapshotInit(_doc, obj) {
  rejectForbiddenTargetSnapshotKeys(obj);
});

const ProposedPayloadSchema = new mongoose.Schema(
  {
    envelopeType: {
      type: String,
      required: true,
      enum: [PROPOSED_PAYLOAD_ENVELOPE_TYPE],
      default: PROPOSED_PAYLOAD_ENVELOPE_TYPE,
    },
    observationNote: { type: String, default: "", trim: true },
  },
  { _id: false, strict: "throw" }
);

ProposedPayloadSchema.pre("init", function rejectForbiddenPayloadInit(_doc, obj) {
  rejectForbiddenPayloadKeys(obj);
});

const ApprovalSnapshotSchema = new mongoose.Schema(
  {
    targetSnapshot: { type: TargetSnapshotSchema, required: true },
    proposedPayload: { type: ProposedPayloadSchema, required: true },
    policyVersion: { type: String, required: true, trim: true },
    minimumPermissionLevel: { type: String, required: true, trim: true },
    advisorySource: { type: AdvisorySourceSchema, required: true },
    evidenceCutoffAt: { type: Date, required: true },
    idempotencyKey: { type: String, required: true, trim: true },
    approvedAt: { type: Date, required: true },
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    approverRole: { type: String, required: true, trim: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false, strict: "throw" }
);

const AutopilotActionProposalSchema = new mongoose.Schema(
  {
    actionId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: generateActionId,
      trim: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
    },
    actionType: {
      type: String,
      required: true,
      immutable: true,
      enum: S1_ACTIVE_ACTION_TYPES,
    },
    policyVersion: {
      type: String,
      required: true,
      immutable: true,
      enum: [POLICY_VERSION],
      default: POLICY_VERSION,
    },
    autopilotObserverVersion: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
    },
    advisorySource: {
      type: AdvisorySourceSchema,
      required: true,
      immutable: true,
    },
    specKey: { type: String, required: true, immutable: true, trim: true },
    topicKey: { type: String, required: true, immutable: true, trim: true },
    minimumPermissionLevel: { type: String, required: true, immutable: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: S1_ACTIVE_PROPOSAL_STATES,
      default: "PROPOSED",
    },
    targetSnapshot: {
      type: TargetSnapshotSchema,
      required: true,
      immutable: true,
      set: rejectForbiddenTargetSnapshotKeys,
    },
    proposedPayload: {
      type: ProposedPayloadSchema,
      required: true,
      immutable: true,
      set: rejectForbiddenPayloadKeys,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: defaultExpiresAt,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null, trim: true },
    approvalSnapshot: { type: ApprovalSnapshotSchema, default: null },
  },
  { timestamps: true }
);

AutopilotActionProposalSchema.path("status").validate(function validateNotReservedState(value) {
  if (isReservedFutureState(value)) {
    return false;
  }
  return S1_ACTIVE_PROPOSAL_STATES.includes(value);
}, "status must be an active S1 proposal state; reserved execution states are forbidden");

function enforceLifecycleShape(doc) {
  let valid = true;

  if (doc.status === "PROPOSED") {
    if (doc.approvalSnapshot != null) {
      doc.invalidate("approvalSnapshot", "PROPOSED proposals must not carry an approval snapshot");
      valid = false;
    }
    if (doc.reviewedBy != null || doc.reviewedAt != null) {
      doc.invalidate("status", "PROPOSED proposals must not have review fields set");
      valid = false;
    }
    if (doc.rejectionReason) {
      doc.invalidate("rejectionReason", "PROPOSED proposals must not have a rejection reason");
      valid = false;
    }
  }

  if (doc.status === "APPROVED") {
    if (!doc.reviewedBy) {
      doc.invalidate("reviewedBy", "APPROVED proposals require reviewedBy");
      valid = false;
    }
    if (!doc.reviewedAt) {
      doc.invalidate("reviewedAt", "APPROVED proposals require reviewedAt");
      valid = false;
    }
    if (!doc.approvalSnapshot) {
      doc.invalidate("approvalSnapshot", "APPROVED proposals require approvalSnapshot");
      valid = false;
    }
  }

  if (doc.status === "REJECTED") {
    if (!doc.reviewedBy) {
      doc.invalidate("reviewedBy", "REJECTED proposals require reviewedBy");
      valid = false;
    }
    if (!doc.reviewedAt) {
      doc.invalidate("reviewedAt", "REJECTED proposals require reviewedAt");
      valid = false;
    }
    if (!doc.rejectionReason || String(doc.rejectionReason).trim().length === 0) {
      doc.invalidate("rejectionReason", "REJECTED proposals require rejectionReason");
      valid = false;
    }
    if (doc.approvalSnapshot != null) {
      doc.invalidate("approvalSnapshot", "REJECTED proposals must not carry an approval snapshot");
      valid = false;
    }
  }

  if (doc.status === "EXPIRED" && doc.approvalSnapshot != null) {
    doc.invalidate("approvalSnapshot", "EXPIRED proposals must not carry an approval snapshot");
    valid = false;
  }

  const snapshot = doc.targetSnapshot;
  if (snapshot) {
    if (snapshot.specKey !== doc.specKey) {
      doc.invalidate("targetSnapshot.specKey", "targetSnapshot.specKey must match proposal specKey");
      valid = false;
    }
    if (snapshot.topicKey !== doc.topicKey) {
      doc.invalidate(
        "targetSnapshot.topicKey",
        "targetSnapshot.topicKey must match proposal topicKey"
      );
      valid = false;
    }
    if (doc.advisorySource) {
      if (snapshot.specKey !== doc.advisorySource.specKey) {
        doc.invalidate(
          "advisorySource.specKey",
          "advisorySource.specKey must match proposal specKey"
        );
        valid = false;
      }
      if (snapshot.topicKey !== doc.advisorySource.topicKey) {
        doc.invalidate(
          "advisorySource.topicKey",
          "advisorySource.topicKey must match proposal topicKey"
        );
        valid = false;
      }
    }
  }

  return valid;
}

AutopilotActionProposalSchema.path("specKey").validate(function validateLifecycle() {
  return enforceLifecycleShape(this);
}, "AutopilotActionProposal lifecycle validation failed");

AutopilotActionProposalSchema.pre("init", function rejectForbiddenProposalInit(_doc, obj) {
  if (obj && obj.targetSnapshot) {
    rejectForbiddenTargetSnapshotKeys(obj.targetSnapshot);
  }
  if (obj && obj.proposedPayload) {
    rejectForbiddenPayloadKeys(obj.proposedPayload);
  }
});

AutopilotActionProposalSchema.index({ status: 1, expiresAt: 1 });

module.exports =
  mongoose.models.AutopilotActionProposal ||
  mongoose.model("AutopilotActionProposal", AutopilotActionProposalSchema);

module.exports.AutopilotActionProposalSchema = AutopilotActionProposalSchema;
module.exports.TargetSnapshotSchema = TargetSnapshotSchema;
module.exports.ProposedPayloadSchema = ProposedPayloadSchema;
module.exports.ApprovalSnapshotSchema = ApprovalSnapshotSchema;
module.exports.generateActionId = generateActionId;
module.exports.defaultExpiresAt = defaultExpiresAt;
