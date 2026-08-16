/**
 * Autopilot Preparation Programme — P1.2 immutable preparation record schema.
 * Stores the exact released P1.1 candidate plus minimal persistence projections.
 */
const mongoose = require("mongoose");
const { PREPARATION_RECORD_CANDIDATE_POLICY_VERSION } = require("../contracts/autopilotPreparationRecordCandidate.v1");

const FORBIDDEN_RECORD_FIELDS = Object.freeze([
  "studentId",
  "studentIds",
  "name",
  "email",
  "classPublicId",
  "classId",
  "ownerTeacherId",
]);

function rejectForbiddenRecordKeys(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_RECORD_FIELDS.includes(key)) {
      throw new Error(`preparation record must not contain ${key}`);
    }
  }
  return value;
}

function scanRecordCandidateForbiddenKeys(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return true;
  }
  function walk(value) {
    if (value == null || typeof value !== "object" || value instanceof Date) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_RECORD_FIELDS.includes(key)) {
        throw new Error(`preparation record must not contain ${key}`);
      }
      walk(value[key]);
    }
  }
  walk(candidate);
  return true;
}

function assertProjectionInvariants(doc) {
  if (!doc.recordCandidate || typeof doc.recordCandidate !== "object") {
    doc.invalidate("recordCandidate", "recordCandidate is required");
    return false;
  }

  const candidate = doc.recordCandidate;
  if (candidate.policyVersion !== PREPARATION_RECORD_CANDIDATE_POLICY_VERSION) {
    doc.invalidate(
      "recordCandidate.policyVersion",
      "recordCandidate.policyVersion must match released P1.1 policy version"
    );
    return false;
  }

  if (String(doc.actionId).trim() !== String(candidate.actionId).trim()) {
    doc.invalidate("actionId", "actionId projection must match recordCandidate.actionId");
    return false;
  }

  if (
    String(doc.preparationRecordSemanticIdentityHash).trim() !==
    String(candidate.preparationRecordSemanticIdentityHash).trim()
  ) {
    doc.invalidate(
      "preparationRecordSemanticIdentityHash",
      "preparationRecordSemanticIdentityHash projection must match recordCandidate"
    );
    return false;
  }

  return true;
}

const AutopilotPreparationRecordSchema = new mongoose.Schema(
  {
    actionId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
    },
    preparationRecordSemanticIdentityHash: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
    },
    recordCandidate: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      immutable: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      immutable: true,
    },
    actorRole: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AutopilotPreparationRecordSchema.path("recordCandidate").set(rejectForbiddenRecordKeys);

AutopilotPreparationRecordSchema.path("actionId").validate(function validateRecordProjections() {
  scanRecordCandidateForbiddenKeys(this.recordCandidate);
  return assertProjectionInvariants(this);
}, "AutopilotPreparationRecord projection validation failed");

module.exports =
  mongoose.models.AutopilotPreparationRecord ||
  mongoose.model("AutopilotPreparationRecord", AutopilotPreparationRecordSchema);

module.exports.AutopilotPreparationRecordSchema = AutopilotPreparationRecordSchema;
module.exports.FORBIDDEN_RECORD_FIELDS = FORBIDDEN_RECORD_FIELDS;
