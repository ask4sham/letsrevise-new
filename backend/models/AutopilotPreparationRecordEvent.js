/**
 * Autopilot Preparation Programme — P1.2 append-only preparation record event schema.
 * Separate from frozen AutopilotActionEvent proposal lifecycle events.
 */
const mongoose = require("mongoose");
const {
  PREPARATION_RECORD_PERSISTENCE_POLICY_VERSION,
  PREPARATION_RECORD_ACTIVE_EVENT_TYPES,
} = require("../contracts/autopilotPreparationRecordPersistence.v1");

const FORBIDDEN_EVENT_DETAIL_FIELDS = Object.freeze([
  "studentId",
  "studentIds",
  "name",
  "email",
  "classPublicId",
  "ownerTeacherId",
]);

function rejectForbiddenEventDetailKeys(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_EVENT_DETAIL_FIELDS.includes(key)) {
      throw new Error(`preparation record event details must not contain ${key}`);
    }
  }
  return value;
}

const PreparationRecordEventDetailsSchema = new mongoose.Schema(
  {
    preparationAuthoritySnapshotHash: { type: String, required: true, trim: true },
    eligibilityAuditHash: { type: String, required: true, trim: true },
    eligibilitySemanticHash: { type: String, required: true, trim: true },
  },
  { _id: false, strict: "throw" }
);

PreparationRecordEventDetailsSchema.path("preparationAuthoritySnapshotHash").validate(
  function validateEventDetailsForbiddenKeys() {
    rejectForbiddenEventDetailKeys(this.toObject());
    return true;
  },
  "preparation record event details contain forbidden fields"
);

const AutopilotPreparationRecordEventSchema = new mongoose.Schema(
  {
    actionId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      immutable: true,
      enum: PREPARATION_RECORD_ACTIVE_EVENT_TYPES,
    },
    policyVersion: {
      type: String,
      required: true,
      immutable: true,
      enum: [PREPARATION_RECORD_PERSISTENCE_POLICY_VERSION],
      default: PREPARATION_RECORD_PERSISTENCE_POLICY_VERSION,
    },
    preparationRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AutopilotPreparationRecord",
      required: true,
      immutable: true,
    },
    preparationRecordSemanticIdentityHash: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
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
    timestamp: {
      type: Date,
      required: true,
      immutable: true,
      default: Date.now,
    },
    details: {
      type: PreparationRecordEventDetailsSchema,
      required: true,
      immutable: true,
    },
  },
  { timestamps: false }
);

AutopilotPreparationRecordEventSchema.pre("init", function rejectForbiddenEventInit(_doc, obj) {
  if (obj && obj.details) {
    rejectForbiddenEventDetailKeys(obj.details);
  }
});

AutopilotPreparationRecordEventSchema.index(
  { preparationRecordId: 1, eventType: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.AutopilotPreparationRecordEvent ||
  mongoose.model("AutopilotPreparationRecordEvent", AutopilotPreparationRecordEventSchema);

module.exports.AutopilotPreparationRecordEventSchema = AutopilotPreparationRecordEventSchema;
module.exports.FORBIDDEN_EVENT_DETAIL_FIELDS = FORBIDDEN_EVENT_DETAIL_FIELDS;
