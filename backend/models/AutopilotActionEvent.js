/**
 * Autopilot Safety Foundation — S1.1 append-only lifecycle event schema.
 * No execution or rollback event types. No student PII. No TTL deletion index.
 */
const mongoose = require("mongoose");
const {
  POLICY_VERSION,
  S1_ACTIVE_PROPOSAL_STATES,
  S1_RESERVED_FUTURE_STATES,
  isReservedFutureState,
} = require("../contracts/autopilotSafetyPolicy.v1");

const S1_ACTIVE_EVENT_TYPES = S1_ACTIVE_PROPOSAL_STATES;

const EventDetailsSchema = new mongoose.Schema(
  {
    note: { type: String, default: "", trim: true },
    previousStatus: { type: String, default: null, trim: true },
    newStatus: { type: String, default: null, trim: true },
    policyVersion: { type: String, default: POLICY_VERSION, trim: true },
  },
  { _id: false, strict: "throw" }
);

EventDetailsSchema.pre("init", function rejectForbiddenEventDetailInit(_doc, obj) {
  rejectForbiddenEventDetailKeys(obj);
});

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
      throw new Error(`event details must not contain ${key}`);
    }
  }
  return value;
}

const AutopilotActionEventSchema = new mongoose.Schema(
  {
    actionId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      immutable: true,
      enum: S1_ACTIVE_EVENT_TYPES,
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
    policyVersion: {
      type: String,
      required: true,
      immutable: true,
      enum: [POLICY_VERSION],
      default: POLICY_VERSION,
    },
    timestamp: {
      type: Date,
      required: true,
      immutable: true,
      default: Date.now,
    },
    details: {
      type: EventDetailsSchema,
      default: () => ({}),
      immutable: true,
      set: rejectForbiddenEventDetailKeys,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AutopilotActionEventSchema.path("eventType").validate(function validateEventType(value) {
  if (isReservedFutureState(value)) {
    return false;
  }
  return S1_ACTIVE_EVENT_TYPES.includes(value);
}, "eventType must be an active S1 lifecycle event; execution/rollback events are forbidden");

AutopilotActionEventSchema.pre("init", function rejectForbiddenEventInit(_doc, obj) {
  if (obj && obj.details) {
    rejectForbiddenEventDetailKeys(obj.details);
  }
});

AutopilotActionEventSchema.index({ actionId: 1, timestamp: -1 });

module.exports =
  mongoose.models.AutopilotActionEvent ||
  mongoose.model("AutopilotActionEvent", AutopilotActionEventSchema);

module.exports.AutopilotActionEventSchema = AutopilotActionEventSchema;
module.exports.S1_ACTIVE_EVENT_TYPES = S1_ACTIVE_EVENT_TYPES;
module.exports.S1_RESERVED_FUTURE_EVENT_TYPES = S1_RESERVED_FUTURE_STATES;
