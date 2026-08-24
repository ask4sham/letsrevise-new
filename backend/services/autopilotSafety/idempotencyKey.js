/**
 * Autopilot Safety Foundation — S1.2 idempotency identity and canonical comparison.
 * S1.4B2: observationIdentityHash drives deduplication; evidenceSnapshotHash is audit-only.
 */
const crypto = require("crypto");
const {
  POLICY_VERSION,
  TARGET_SNAPSHOT_VERSION,
  S1_ACTIVE_ACTION_TYPES,
  S1_ACTIVE_TARGET_TYPES,
  PROPOSED_PAYLOAD_ENVELOPE_TYPE,
} = require("../../contracts/autopilotSafetyPolicy.v1");
const { canonicaliseEvidenceSnapshot } = require("../../contracts/autopilotProposalProvenance.v1");

const ACTION_TYPE = S1_ACTIVE_ACTION_TYPES[0];
const TARGET_TYPE = S1_ACTIVE_TARGET_TYPES[0];

function toUtcIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
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

function normalizeObservationNote(value) {
  if (value == null) {
    return "";
  }
  return String(value).trim().slice(0, 500);
}

function deriveObservationIdentityHash(sourceEvidence) {
  const canonical = canonicaliseEvidenceSnapshot(sourceEvidence);
  const { sourceGeneratedAt, ...identityMaterial } = canonical;
  return sha256Hex(canonicalJson(identityMaterial));
}

function buildAdvisorySourceRef(canonicalTopicKey, observationIdentityHash) {
  return `provenance:v1:${String(canonicalTopicKey).trim()}:${String(observationIdentityHash).trim()}`;
}

function buildCanonicalTargetSnapshotFields({
  specKey,
  topicKey,
  advisoryAction,
  advisorySourceRef,
  evidenceCutoffAt,
}) {
  const evidenceIso = toUtcIsoDate(evidenceCutoffAt);
  return {
    targetType: TARGET_TYPE,
    specKey: String(specKey).trim(),
    topicKey: String(topicKey).trim(),
    advisoryAction: String(advisoryAction).trim(),
    advisorySourceRef: String(advisorySourceRef).trim(),
    evidenceCutoffAt: evidenceIso,
    targetCount: 0,
    targetSnapshotVersion: TARGET_SNAPSHOT_VERSION,
  };
}

function computeTargetSnapshotHash(snapshotFields) {
  return sha256Hex(canonicalJson(snapshotFields));
}

function buildTargetSnapshot(snapshotFields) {
  return {
    ...snapshotFields,
    targetSnapshotHash: computeTargetSnapshotHash(snapshotFields),
  };
}

function deriveIdempotencyKey({ specKey, topicKey, advisoryAction, observationIdentityHash }) {
  const material = [
    POLICY_VERSION,
    ACTION_TYPE,
    String(specKey).trim(),
    String(topicKey).trim(),
    String(advisoryAction).trim(),
    String(observationIdentityHash).trim(),
  ].join("|");
  return sha256Hex(material);
}

/** @deprecated S1.2 pre-provenance idempotency material — legacy replay only. */
function deriveIdempotencyKeyS12({
  specKey,
  topicKey,
  advisoryAction,
  targetSnapshotHash,
  evidenceCutoffAt,
}) {
  const evidenceIso = toUtcIsoDate(evidenceCutoffAt);
  const material = [
    POLICY_VERSION,
    ACTION_TYPE,
    String(specKey).trim(),
    String(topicKey).trim(),
    String(advisoryAction).trim(),
    String(targetSnapshotHash).trim(),
    evidenceIso,
  ].join("|");
  return sha256Hex(material);
}

function buildCanonicalAcceptedCreateContent(input) {
  const observationNote = normalizeObservationNote(input.observationNote);
  const snapshotFields = buildCanonicalTargetSnapshotFields(input);
  const targetSnapshotHash = computeTargetSnapshotHash(snapshotFields);

  return {
    policyVersion: POLICY_VERSION,
    actionType: ACTION_TYPE,
    specKey: String(input.specKey).trim(),
    topicKey: String(input.topicKey).trim(),
    advisoryAction: String(input.advisoryAction).trim(),
    autopilotObserverVersion: String(input.autopilotObserverVersion).trim(),
    observer: String(input.observer).trim(),
    advisorySourceRef: String(input.advisorySourceRef).trim(),
    evidenceCutoffAt: toUtcIsoDate(input.evidenceCutoffAt),
    minimumPermissionLevel: String(input.minimumPermissionLevel).trim(),
    observationNote,
    targetSnapshot: {
      ...snapshotFields,
      targetSnapshotHash,
    },
    proposedPayload: {
      envelopeType: PROPOSED_PAYLOAD_ENVELOPE_TYPE,
      observationNote,
    },
    advisorySource: {
      observer: String(input.observer).trim(),
      advisoryAction: String(input.advisoryAction).trim(),
      specKey: String(input.specKey).trim(),
      topicKey: String(input.topicKey).trim(),
    },
  };
}

function buildCanonicalPersistedProposalContent(proposal) {
  const plain =
    proposal && typeof proposal.toObject === "function"
      ? proposal.toObject({ flattenMaps: false })
      : proposal;
  const observationNote = normalizeObservationNote(plain.proposedPayload?.observationNote);

  return {
    policyVersion: plain.policyVersion,
    actionType: plain.actionType,
    specKey: plain.specKey,
    topicKey: plain.topicKey,
    advisoryAction: plain.advisorySource?.advisoryAction || plain.targetSnapshot?.advisoryAction,
    autopilotObserverVersion: plain.autopilotObserverVersion,
    observer: plain.advisorySource?.observer,
    advisorySourceRef: plain.targetSnapshot?.advisorySourceRef,
    evidenceCutoffAt: toUtcIsoDate(
      plain.targetSnapshot?.evidenceCutoffAt || plain.advisorySource?.evidenceCutoffAt
    ),
    minimumPermissionLevel: plain.minimumPermissionLevel,
    observationNote,
    targetSnapshot: {
      targetType: plain.targetSnapshot?.targetType,
      specKey: plain.targetSnapshot?.specKey,
      topicKey: plain.targetSnapshot?.topicKey,
      advisoryAction: plain.targetSnapshot?.advisoryAction,
      advisorySourceRef: plain.targetSnapshot?.advisorySourceRef,
      evidenceCutoffAt: toUtcIsoDate(plain.targetSnapshot?.evidenceCutoffAt),
      targetCount: plain.targetSnapshot?.targetCount,
      targetSnapshotVersion: plain.targetSnapshot?.targetSnapshotVersion,
      targetSnapshotHash: plain.targetSnapshot?.targetSnapshotHash,
    },
    proposedPayload: {
      envelopeType: plain.proposedPayload?.envelopeType,
      observationNote,
    },
    advisorySource: {
      observer: plain.advisorySource?.observer,
      advisoryAction: plain.advisorySource?.advisoryAction,
      specKey: plain.advisorySource?.specKey,
      topicKey: plain.advisorySource?.topicKey,
    },
  };
}

function canonicalContentMatchesS12(leftInput, rightProposal) {
  const left = buildCanonicalAcceptedCreateContent(leftInput);
  const right = buildCanonicalPersistedProposalContent(rightProposal);
  return canonicalJson(left) === canonicalJson(right);
}

function canonicalReplayMatches(createInput, existingProposal) {
  const leftNote = normalizeObservationNote(createInput.observationNote);
  const rightNote = normalizeObservationNote(existingProposal.proposedPayload?.observationNote);
  if (leftNote !== rightNote) {
    return false;
  }

  const leftEvidence = createInput.verifiedSourceEvidence;
  if (!leftEvidence || !existingProposal.sourceEvidence) {
    return false;
  }

  return (
    deriveObservationIdentityHash(leftEvidence) ===
    deriveObservationIdentityHash(existingProposal.sourceEvidence)
  );
}

function canonicalContentMatches(leftInput, rightProposal) {
  if (rightProposal?.sourceEvidence) {
    return canonicalReplayMatches(leftInput, rightProposal);
  }
  return canonicalContentMatchesS12(leftInput, rightProposal);
}

function canonicalPersistedMatches(leftProposal, rightProposal) {
  const left = buildCanonicalPersistedProposalContent(leftProposal);
  const right = buildCanonicalPersistedProposalContent(rightProposal);
  return canonicalJson(left) === canonicalJson(right);
}

module.exports = {
  ACTION_TYPE,
  TARGET_TYPE,
  canonicalJson,
  sha256Hex,
  normalizeObservationNote,
  deriveObservationIdentityHash,
  buildAdvisorySourceRef,
  buildCanonicalTargetSnapshotFields,
  computeTargetSnapshotHash,
  buildTargetSnapshot,
  deriveIdempotencyKey,
  deriveIdempotencyKeyS12,
  buildCanonicalAcceptedCreateContent,
  buildCanonicalPersistedProposalContent,
  canonicalContentMatches,
  canonicalContentMatchesS12,
  canonicalReplayMatches,
  canonicalPersistedMatches,
};
