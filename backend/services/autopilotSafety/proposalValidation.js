/**
 * Autopilot Safety Foundation — S1.2 proposal request validation.
 * S1.4B2: coordinates-only create contract; provenance is server-verified.
 */
const {
  L4_POLICY_CLASSES,
  L4_POLICY_ALIASES,
  isCanonicalL4Class,
} = require("../../contracts/autopilotSafetyPolicy.v1");

const CREATE_ALLOWED_FIELDS = new Set(["specKey", "topicKey", "observationNote"]);

const SERVER_OWNED_FIELDS = new Set([
  "actionId",
  "idempotencyKey",
  "policyVersion",
  "actionType",
  "status",
  "createdAt",
  "expiresAt",
  "targetType",
  "targetCount",
  "targetSnapshotVersion",
  "targetSnapshotHash",
  "targetSnapshot",
  "approvalSnapshot",
  "reviewedBy",
  "reviewedAt",
  "actorId",
  "actorRole",
  "executionAuthorized",
  "executionEnabled",
  "proposedPayload",
  "advisorySource",
  "sourceEvidence",
  "evidenceSnapshotHash",
]);

const FORBIDDEN_FIELD_PATTERNS = [
  /^studentId$/i,
  /^studentIds$/i,
  /^classId$/i,
  /^classPublicId$/i,
  /^ownerTeacherId$/i,
  /^email$/i,
  /^name$/i,
  /^assignmentId$/i,
  /^notification/i,
  /^publish/i,
  /^grade/i,
  /^execution/i,
  /^execute/i,
  /^prepare/i,
  /^downstream/i,
  /^route$/i,
  /^command$/i,
];

const L4_FIELD_NAMES = new Set([
  ...L4_POLICY_CLASSES,
  ...Object.keys(L4_POLICY_ALIASES),
  "l4PolicyClass",
  "l4Class",
  "l4PolicyClasses",
]);

class AutopilotSafetyError extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.name = "AutopilotSafetyError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function isForbiddenFieldName(key) {
  if (SERVER_OWNED_FIELDS.has(key)) {
    return true;
  }
  if (L4_FIELD_NAMES.has(key)) {
    return true;
  }
  if (isCanonicalL4Class(key)) {
    return true;
  }
  return FORBIDDEN_FIELD_PATTERNS.some((pattern) => pattern.test(key));
}

function assertPlainObject(body, code = "INVALID_PROPOSAL") {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    throw new AutopilotSafetyError(code, "Request body must be a JSON object", 400);
  }
}

function validateNoForbiddenKeys(body, { allowOnly } = {}) {
  assertPlainObject(body);
  for (const key of Object.keys(body)) {
    if (isForbiddenFieldName(key)) {
      if (L4_FIELD_NAMES.has(key) || isCanonicalL4Class(key)) {
        throw new AutopilotSafetyError("L4_PROHIBITED", `Field not permitted: ${key}`, 400);
      }
      throw new AutopilotSafetyError("INVALID_PROPOSAL", `Field not permitted: ${key}`, 400);
    }
    if (allowOnly && !allowOnly.has(key)) {
      throw new AutopilotSafetyError("INVALID_PROPOSAL", `Unexpected field: ${key}`, 400);
    }
    if (key === "targetSnapshotHash") {
      throw new AutopilotSafetyError(
        "INVALID_PROPOSAL",
        "targetSnapshotHash is server-computed and must not be supplied",
        400
      );
    }
  }
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AutopilotSafetyError("INVALID_PROPOSAL", `${fieldName} is required`, 400);
  }
  return value.trim();
}

function validateCreateRequest(body) {
  validateNoForbiddenKeys(body, { allowOnly: CREATE_ALLOWED_FIELDS });

  const specKey = requireNonEmptyString(body.specKey, "specKey");
  const topicKey = requireNonEmptyString(body.topicKey, "topicKey");

  let observationNote = "";
  if (body.observationNote != null) {
    if (typeof body.observationNote !== "string") {
      throw new AutopilotSafetyError("INVALID_PROPOSAL", "observationNote must be a string", 400);
    }
    observationNote = body.observationNote.trim();
    if (observationNote.length > 500) {
      throw new AutopilotSafetyError(
        "INVALID_PROPOSAL",
        "observationNote must be at most 500 characters",
        400
      );
    }
  }

  return {
    specKey,
    topicKey,
    observationNote,
  };
}

function validateRejectRequest(body) {
  validateNoForbiddenKeys(body, { allowOnly: new Set(["rejectionReason"]) });
  const rejectionReason = requireNonEmptyString(body.rejectionReason, "rejectionReason");
  if (rejectionReason.length > 500) {
    throw new AutopilotSafetyError(
      "INVALID_PROPOSAL",
      "rejectionReason must be at most 500 characters",
      400
    );
  }
  return { rejectionReason };
}

function validateExpireRequest(body) {
  if (body == null) {
    return {};
  }
  assertPlainObject(body);
  if (Object.keys(body).length > 0) {
    throw new AutopilotSafetyError("INVALID_PROPOSAL", "Expire request must not include a body", 400);
  }
  return {};
}

module.exports = {
  AutopilotSafetyError,
  CREATE_ALLOWED_FIELDS,
  validateCreateRequest,
  validateRejectRequest,
  validateExpireRequest,
  validateNoForbiddenKeys,
};
