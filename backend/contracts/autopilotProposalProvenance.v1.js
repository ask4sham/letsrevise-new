/**
 * Autopilot Safety Foundation — S1.4A observer proposal provenance contract V1.
 * Standalone vocabulary + deterministic evidence integrity helpers only.
 * No persistence, no API behaviour, no service imports.
 */
const crypto = require("crypto");

const PROVENANCE_VERSION = "autopilot-proposal-provenance-v1";

const SOURCE_SYSTEM = "autopilot0";

const SOURCE_OBSERVER = "execution-contract-intelligence";

const SUPPORTED_SOURCE_OBSERVER_VERSIONS = Object.freeze([
  "autopilot0-execution-contract-intelligence-v1",
]);

const SUPPORTED_SOURCE_POLICY_VERSIONS = Object.freeze(["autopilot-safety-policy-v1"]);

const REQUIRED_EVIDENCE_FIELDS = Object.freeze([
  "provenanceVersion",
  "sourceSystem",
  "sourceObserver",
  "sourceObserverVersion",
  "sourcePolicyVersion",
  "sourceGeneratedAt",
  "sourceSpecKey",
  "sourceTopicKey",
  "sourceAdvisoryAction",
  "readinessClassification",
  "minimumPermissionLevel",
  "blockingRequirements",
]);

const OPTIONAL_EVIDENCE_FIELDS = Object.freeze([
  "sourceObservedOutcome",
  "missingCapabilities",
  "executionContract",
]);

const EVIDENCE_SNAPSHOT_FIELDS = Object.freeze([
  ...REQUIRED_EVIDENCE_FIELDS,
  ...OPTIONAL_EVIDENCE_FIELDS,
]);

const ALLOWED_EXECUTION_CONTRACT_KEYS = Object.freeze([
  "auditReadiness",
  "idempotencyReadiness",
  "rollbackReadiness",
  "targetingReadiness",
  "approvalReadiness",
  "futurePilotEligible",
  "executionRisks",
]);

const FORBIDDEN_NESTED_FIELDS = Object.freeze([
  "studentId",
  "studentIds",
  "name",
  "email",
  "classPublicId",
  "ownerTeacherId",
  "classId",
]);

const TRUSTED_HASH_FIELD_NAMES = Object.freeze([
  "evidenceSnapshotHash",
  "targetSnapshotHash",
  "idempotencyKey",
]);

class ProvenanceContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProvenanceContractError";
    this.code = code;
  }
}

function toUtcIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ProvenanceContractError("INVALID_EVIDENCE_SHAPE", "sourceGeneratedAt must be a valid date");
  }
  return date.toISOString();
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortValue(value[key]);
    }
    return sorted;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(sortValue(value));
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function assertPlainObject(value, code = "INVALID_EVIDENCE_SHAPE") {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new ProvenanceContractError(code, "Source evidence must be a plain object");
  }
}

function rejectUnknownKeys(value, allowedKeys, pathPrefix = "") {
  assertPlainObject(value);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      const fieldPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      throw new ProvenanceContractError("UNSUPPORTED_FIELD", `Unsupported field: ${fieldPath}`);
    }
  }
}

function rejectUnknownTopLevelFields(value) {
  rejectUnknownKeys(value, EVIDENCE_SNAPSHOT_FIELDS);
}

function rejectTrustedHashFields(value, path = "") {
  assertPlainObject(value);
  for (const key of Object.keys(value)) {
    const fieldPath = path ? `${path}.${key}` : key;
    if (TRUSTED_HASH_FIELD_NAMES.includes(key)) {
      throw new ProvenanceContractError(
        "CLIENT_SUPPLIED_HASH_NOT_PERMITTED",
        `Client-supplied trusted digest not permitted: ${fieldPath}`
      );
    }
    const nested = value[key];
    if (nested && typeof nested === "object") {
      if (Array.isArray(nested)) {
        for (const item of nested) {
          if (item && typeof item === "object") {
            rejectTrustedHashFields(item, `${fieldPath}[]`);
          }
        }
      } else {
        rejectTrustedHashFields(nested, fieldPath);
      }
    }
  }
}

function rejectForbiddenNestedFields(value, path = "") {
  assertPlainObject(value);
  for (const key of Object.keys(value)) {
    const fieldPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_NESTED_FIELDS.includes(key)) {
      throw new ProvenanceContractError("FORBIDDEN_FIELD", `Forbidden field: ${fieldPath}`);
    }
    const nested = value[key];
    if (nested && typeof nested === "object") {
      if (Array.isArray(nested)) {
        for (const item of nested) {
          if (item && typeof item === "object") {
            rejectForbiddenNestedFields(item, `${fieldPath}[]`);
          }
        }
      } else {
        rejectForbiddenNestedFields(nested, fieldPath);
      }
    }
  }
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProvenanceContractError("MISSING_REQUIRED_FIELD", `${fieldName} is required`);
  }
  return value.trim();
}

function requireStringArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new ProvenanceContractError("INVALID_EVIDENCE_SHAPE", `${fieldName} must be an array`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new ProvenanceContractError(
        "INVALID_EVIDENCE_SHAPE",
        `${fieldName}[${index}] must be a non-empty string`
      );
    }
    return item.trim();
  });
}

function canonicaliseExecutionContract(value) {
  assertPlainObject(value);
  rejectUnknownKeys(value, ALLOWED_EXECUTION_CONTRACT_KEYS, "executionContract");
  const canonical = {};
  for (const key of ALLOWED_EXECUTION_CONTRACT_KEYS) {
    if (!(key in value)) {
      continue;
    }
    if (key === "executionRisks") {
      canonical.executionRisks = requireStringArray(value.executionRisks, "executionContract.executionRisks").sort();
      continue;
    }
    if (key === "futurePilotEligible") {
      if (typeof value.futurePilotEligible !== "boolean") {
        throw new ProvenanceContractError(
          "INVALID_EVIDENCE_SHAPE",
          "executionContract.futurePilotEligible must be a boolean"
        );
      }
      canonical.futurePilotEligible = value.futurePilotEligible;
      continue;
    }
    canonical[key] = requireNonEmptyString(value[key], `executionContract.${key}`);
  }
  return canonical;
}

function canonicaliseEvidenceSnapshot(input) {
  assertPlainObject(input);
  rejectTrustedHashFields(input);
  rejectForbiddenNestedFields(input);
  rejectUnknownTopLevelFields(input);

  const provenanceVersion = requireNonEmptyString(input.provenanceVersion, "provenanceVersion");
  if (provenanceVersion !== PROVENANCE_VERSION) {
    throw new ProvenanceContractError(
      "UNSUPPORTED_PROVENANCE_VERSION",
      `Unsupported provenance version: ${provenanceVersion}`
    );
  }

  const sourceSystem = requireNonEmptyString(input.sourceSystem, "sourceSystem");
  if (sourceSystem !== SOURCE_SYSTEM) {
    throw new ProvenanceContractError("UNSUPPORTED_SOURCE_SYSTEM", `Unsupported source system: ${sourceSystem}`);
  }

  const sourceObserver = requireNonEmptyString(input.sourceObserver, "sourceObserver");
  if (sourceObserver !== SOURCE_OBSERVER) {
    throw new ProvenanceContractError("UNKNOWN_OBSERVER", `Unknown source observer: ${sourceObserver}`);
  }

  const sourceObserverVersion = requireNonEmptyString(
    input.sourceObserverVersion,
    "sourceObserverVersion"
  );
  if (!SUPPORTED_SOURCE_OBSERVER_VERSIONS.includes(sourceObserverVersion)) {
    throw new ProvenanceContractError(
      "UNSUPPORTED_OBSERVER_VERSION",
      `Unsupported source observer version: ${sourceObserverVersion}`
    );
  }

  const sourcePolicyVersion = requireNonEmptyString(input.sourcePolicyVersion, "sourcePolicyVersion");
  if (!SUPPORTED_SOURCE_POLICY_VERSIONS.includes(sourcePolicyVersion)) {
    throw new ProvenanceContractError(
      "UNSUPPORTED_POLICY_VERSION",
      `Unsupported source policy version: ${sourcePolicyVersion}`
    );
  }

  const canonical = {
    provenanceVersion,
    sourceSystem,
    sourceObserver,
    sourceObserverVersion,
    sourcePolicyVersion,
    sourceGeneratedAt: toUtcIsoDate(input.sourceGeneratedAt),
    sourceSpecKey: requireNonEmptyString(input.sourceSpecKey, "sourceSpecKey"),
    sourceTopicKey: requireNonEmptyString(input.sourceTopicKey, "sourceTopicKey"),
    sourceAdvisoryAction: requireNonEmptyString(input.sourceAdvisoryAction, "sourceAdvisoryAction"),
    readinessClassification: requireNonEmptyString(
      input.readinessClassification,
      "readinessClassification"
    ),
    minimumPermissionLevel: requireNonEmptyString(
      input.minimumPermissionLevel,
      "minimumPermissionLevel"
    ),
    blockingRequirements: requireStringArray(input.blockingRequirements, "blockingRequirements").sort(),
  };

  if (input.sourceObservedOutcome != null) {
    if (typeof input.sourceObservedOutcome !== "string") {
      throw new ProvenanceContractError(
        "INVALID_EVIDENCE_SHAPE",
        "sourceObservedOutcome must be a string when provided"
      );
    }
    canonical.sourceObservedOutcome = input.sourceObservedOutcome.trim();
  }

  if (input.missingCapabilities != null) {
    canonical.missingCapabilities = requireStringArray(
      input.missingCapabilities,
      "missingCapabilities"
    ).sort();
  }

  if (input.executionContract != null) {
    canonical.executionContract = canonicaliseExecutionContract(input.executionContract);
  }

  return canonical;
}

function deriveEvidenceSnapshotHash(input) {
  const canonical = canonicaliseEvidenceSnapshot(input);
  return sha256Hex(canonicalJson(canonical));
}

function validateSourceEvidence(input) {
  const canonical = canonicaliseEvidenceSnapshot(input);
  return {
    ...canonical,
    evidenceSnapshotHash: deriveEvidenceSnapshotHash(canonical),
  };
}

module.exports = {
  PROVENANCE_VERSION,
  SOURCE_SYSTEM,
  SOURCE_OBSERVER,
  SUPPORTED_SOURCE_OBSERVER_VERSIONS,
  SUPPORTED_SOURCE_POLICY_VERSIONS,
  REQUIRED_EVIDENCE_FIELDS,
  OPTIONAL_EVIDENCE_FIELDS,
  EVIDENCE_SNAPSHOT_FIELDS,
  ALLOWED_EXECUTION_CONTRACT_KEYS,
  FORBIDDEN_NESTED_FIELDS,
  TRUSTED_HASH_FIELD_NAMES,
  ProvenanceContractError,
  canonicaliseEvidenceSnapshot,
  deriveEvidenceSnapshotHash,
  validateSourceEvidence,
  canonicalJson,
  sha256Hex,
};
