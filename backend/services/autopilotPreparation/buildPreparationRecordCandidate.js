/**
 * Autopilot Preparation Programme — P1.1 pure preparation record candidate builder.
 * No DB, no mongoose, no persistence, no runtime gate, no A0.9, no execution.
 */
const { canonicaliseEvidenceSnapshot } = require("../../contracts/autopilotProposalProvenance.v1");
const {
  CLASSIFICATION_ELIGIBLE,
} = require("../../contracts/autopilotSafetyPreparationEligibility.v1");
const {
  PREPARATION_RECORD_CANDIDATE_POLICY_VERSION,
  PREPARATION_AUTHORITY_SNAPSHOT_VERSION,
  RELEASED_OBSERVATION_NOTE_MAX_LENGTH,
  PreparationRecordCandidateError,
} = require("../../contracts/autopilotPreparationRecordCandidate.v1");
const { evaluatePreparationEligibility, canonicalTargetSnapshotContent } = require("../autopilotSafety/preparationEligibility");
const { canonicalJson, sha256Hex } = require("../autopilotSafety/idempotencyKey");

const RELEASED_ISO_8601_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

function toUtcIsoDate(value, fieldName) {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new PreparationRecordCandidateError(
        "INVALID_AUTHORITY_SNAPSHOT",
        `${fieldName} must be a valid date`,
        { field: fieldName }
      );
    }
    return value.toISOString();
  }

  if (typeof value === "number") {
    throw new PreparationRecordCandidateError(
      "INVALID_AUTHORITY_SNAPSHOT",
      `${fieldName} must be a Date instance or ISO-8601 string`,
      { field: fieldName, receivedType: "number" }
    );
  }

  if (typeof value !== "string") {
    throw new PreparationRecordCandidateError(
      "INVALID_AUTHORITY_SNAPSHOT",
      `${fieldName} must be a Date instance or ISO-8601 string`,
      { field: fieldName, receivedType: typeof value }
    );
  }

  const trimmed = value.trim();
  if (!RELEASED_ISO_8601_INSTANT_PATTERN.test(trimmed)) {
    throw new PreparationRecordCandidateError(
      "INVALID_AUTHORITY_SNAPSHOT",
      `${fieldName} must be an ISO-8601 UTC or offset instant`,
      { field: fieldName }
    );
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new PreparationRecordCandidateError(
      "INVALID_AUTHORITY_SNAPSHOT",
      `${fieldName} must be a valid date`,
      { field: fieldName }
    );
  }

  return date.toISOString();
}

function canonicalizeObservationNote(value) {
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new PreparationRecordCandidateError(
      "INVALID_AUTHORITY_SNAPSHOT",
      "observationNote must be a string",
      { field: "observationNote" }
    );
  }
  const trimmed = value.trim();
  if (trimmed.length > RELEASED_OBSERVATION_NOTE_MAX_LENGTH) {
    throw new PreparationRecordCandidateError(
      "INVALID_AUTHORITY_SNAPSHOT",
      "observationNote exceeds released maximum length",
      {
        field: "observationNote",
        maxLength: RELEASED_OBSERVATION_NOTE_MAX_LENGTH,
        actualLength: trimmed.length,
      }
    );
  }
  return trimmed;
}

function toApproverIdString(value) {
  if (value == null) {
    return "";
  }
  if (typeof value === "object" && typeof value.toString === "function") {
    return String(value.toString()).trim();
  }
  return String(value).trim();
}

function buildPreparationAuthoritySnapshot(proposalPlain) {
  const approvalSnapshot = proposalPlain.approvalSnapshot;
  const canonicalEvidence = canonicaliseEvidenceSnapshot(approvalSnapshot.sourceEvidence);

  return {
    preparationAuthoritySnapshotVersion: PREPARATION_AUTHORITY_SNAPSHOT_VERSION,
    actionId: String(proposalPlain.actionId).trim(),
    safetyPolicyVersion: String(approvalSnapshot.policyVersion).trim(),
    advisorySource: {
      observer: String(approvalSnapshot.advisorySource.observer).trim(),
      advisoryAction: String(approvalSnapshot.advisorySource.advisoryAction).trim(),
      specKey: String(approvalSnapshot.advisorySource.specKey).trim(),
      topicKey: String(approvalSnapshot.advisorySource.topicKey).trim(),
    },
    targetSnapshot: canonicalTargetSnapshotContent(approvalSnapshot.targetSnapshot),
    proposedPayload: {
      envelopeType: String(approvalSnapshot.proposedPayload.envelopeType).trim(),
      observationNote: canonicalizeObservationNote(approvalSnapshot.proposedPayload.observationNote),
    },
    minimumPermissionLevel: String(approvalSnapshot.minimumPermissionLevel).trim(),
    evidenceCutoffAt: toUtcIsoDate(approvalSnapshot.evidenceCutoffAt, "evidenceCutoffAt"),
    proposalIdempotencyKey: String(approvalSnapshot.idempotencyKey).trim(),
    sourceEvidence: canonicalEvidence,
    evidenceSnapshotHash: String(approvalSnapshot.evidenceSnapshotHash).trim(),
    approvalMetadata: {
      approvedAt: toUtcIsoDate(approvalSnapshot.approvedAt, "approvedAt"),
      approverId: toApproverIdString(approvalSnapshot.approverId),
      approverRole: String(approvalSnapshot.approverRole).trim(),
    },
  };
}

function derivePreparationAuthoritySnapshotHash(preparationAuthoritySnapshot) {
  return sha256Hex(canonicalJson(preparationAuthoritySnapshot));
}

function freezeEligibilitySnapshot(eligibilityResult) {
  return {
    policyVersion: eligibilityResult.policyVersion,
    classification: eligibilityResult.classification,
    blockingReasons: [...eligibilityResult.blockingReasons],
    evidenceAuthority: eligibilityResult.evidenceAuthority,
    evaluatedAt: eligibilityResult.evaluatedAt,
  };
}

function deriveEligibilityAuditHash(eligibilitySnapshot) {
  return sha256Hex(canonicalJson(eligibilitySnapshot));
}

function deriveEligibilitySemanticHash(eligibilitySnapshot) {
  const { evaluatedAt, ...semanticMaterial } = eligibilitySnapshot;
  return sha256Hex(canonicalJson(semanticMaterial));
}

function derivePreparationRecordSemanticIdentityHash({
  actionId,
  preparationAuthoritySnapshotHash,
  eligibilitySemanticHash,
}) {
  const material = {
    policyVersion: PREPARATION_RECORD_CANDIDATE_POLICY_VERSION,
    actionId: String(actionId).trim(),
    preparationAuthoritySnapshotHash: String(preparationAuthoritySnapshotHash).trim(),
    eligibilitySemanticHash: String(eligibilitySemanticHash).trim(),
  };
  return sha256Hex(canonicalJson(material));
}

function buildPreparationRecordCandidate(proposalPlain, options = {}) {
  const evaluatedAt = options.evaluatedAt;
  if (!evaluatedAt) {
    throw new Error("evaluatedAt is required for deterministic preparation record candidate construction");
  }

  const eligibilityResult = evaluatePreparationEligibility(proposalPlain, { evaluatedAt });
  if (eligibilityResult.classification !== CLASSIFICATION_ELIGIBLE) {
    throw new PreparationRecordCandidateError(
      "NOT_ELIGIBLE",
      "Proposal is not eligible for future preparation",
      {
        classification: eligibilityResult.classification,
        blockingReasons: eligibilityResult.blockingReasons,
      }
    );
  }

  const preparationAuthoritySnapshot = buildPreparationAuthoritySnapshot(proposalPlain);
  const preparationAuthoritySnapshotHash =
    derivePreparationAuthoritySnapshotHash(preparationAuthoritySnapshot);
  const eligibilitySnapshot = freezeEligibilitySnapshot(eligibilityResult);
  const eligibilityAuditHash = deriveEligibilityAuditHash(eligibilitySnapshot);
  const eligibilitySemanticHash = deriveEligibilitySemanticHash(eligibilitySnapshot);
  const preparationRecordSemanticIdentityHash = derivePreparationRecordSemanticIdentityHash({
    actionId: preparationAuthoritySnapshot.actionId,
    preparationAuthoritySnapshotHash,
    eligibilitySemanticHash,
  });

  return {
    policyVersion: PREPARATION_RECORD_CANDIDATE_POLICY_VERSION,
    actionId: preparationAuthoritySnapshot.actionId,
    preparationAuthoritySnapshot,
    preparationAuthoritySnapshotHash,
    eligibilitySnapshot,
    eligibilityAuditHash,
    eligibilitySemanticHash,
    preparationRecordSemanticIdentityHash,
  };
}

module.exports = {
  buildPreparationRecordCandidate,
  buildPreparationAuthoritySnapshot,
  derivePreparationAuthoritySnapshotHash,
  freezeEligibilitySnapshot,
  deriveEligibilityAuditHash,
  deriveEligibilitySemanticHash,
  derivePreparationRecordSemanticIdentityHash,
  PreparationRecordCandidateError,
};
