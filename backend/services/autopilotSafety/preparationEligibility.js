/**
 * Autopilot Safety Foundation — S1.5 preparation eligibility evaluator.
 * Pure, read-only, dormant. No DB, no A0.9, no mutations.
 */
const {
  POLICY_VERSION,
  TARGET_SNAPSHOT_VERSION,
  S1_ACTIVE_ACTION_TYPES,
  S1_ACTIVE_TARGET_TYPES,
  S1_RESERVED_TARGET_TYPES,
  ADVISORY_READINESS_POLICY,
  FORBIDDEN_TARGET_SNAPSHOT_FIELDS,
} = require("../../contracts/autopilotSafetyPolicy.v1");
const {
  PROVENANCE_VERSION,
  canonicaliseEvidenceSnapshot,
  deriveEvidenceSnapshotHash,
} = require("../../contracts/autopilotProposalProvenance.v1");
const {
  POLICY_VERSION: ELIGIBILITY_POLICY_VERSION,
  CLASSIFICATION_ELIGIBLE,
  CLASSIFICATION_NOT_ELIGIBLE,
  EVIDENCE_AUTHORITY,
  BLOCKING_REASONS,
  PREPARATION_SAFETY_BLOCKERS,
  ACTIONABLE_READINESS_CLASSIFICATIONS,
  B2_ADVISORY_SOURCE_REF_PATTERN,
  sortBlockingReasons,
} = require("../../contracts/autopilotSafetyPreparationEligibility.v1");
const { isExecutionEnabled } = require("../../config/autopilotSafetyRuntime");
const {
  canonicalJson,
  computeTargetSnapshotHash,
  buildCanonicalTargetSnapshotFields,
  deriveObservationIdentityHash,
  buildAdvisorySourceRef,
} = require("./idempotencyKey");

const ACTION_TYPE = S1_ACTIVE_ACTION_TYPES[0];
const TARGET_TYPE = S1_ACTIVE_TARGET_TYPES[0];
const NOT_AN_ACTION_READINESS = "NOT_AN_ACTION";

function toUtcIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function hasNonEmptyString(value) {
  return value != null && String(value).trim().length > 0;
}

function hasProvenanceSiblingPair(sourceEvidence, evidenceSnapshotHash) {
  const hasEvidence = sourceEvidence != null;
  const hasHash = hasNonEmptyString(evidenceSnapshotHash);
  return { hasEvidence, hasHash, complete: hasEvidence && hasHash, partial: hasEvidence !== hasHash };
}

function isProvenanceBoundB2Proposal(proposal) {
  const topLevel = hasProvenanceSiblingPair(
    proposal.sourceEvidence,
    proposal.evidenceSnapshotHash
  );
  if (!topLevel.complete) {
    return false;
  }

  const provenanceVersion = proposal.sourceEvidence?.provenanceVersion;
  if (provenanceVersion === PROVENANCE_VERSION) {
    return true;
  }

  const advisorySourceRef =
    proposal.approvalSnapshot?.targetSnapshot?.advisorySourceRef ||
    proposal.targetSnapshot?.advisorySourceRef;
  return B2_ADVISORY_SOURCE_REF_PATTERN.test(String(advisorySourceRef || "").trim());
}

function canonicalTargetSnapshotContent(targetSnapshot) {
  if (!targetSnapshot) {
    return null;
  }
  return {
    targetType: targetSnapshot.targetType,
    specKey: String(targetSnapshot.specKey).trim(),
    topicKey: String(targetSnapshot.topicKey).trim(),
    advisoryAction: String(targetSnapshot.advisoryAction).trim(),
    advisorySourceRef: String(targetSnapshot.advisorySourceRef).trim(),
    evidenceCutoffAt: toUtcIsoDate(targetSnapshot.evidenceCutoffAt),
    targetCount: targetSnapshot.targetCount,
    targetSnapshotVersion: targetSnapshot.targetSnapshotVersion,
    targetSnapshotHash: String(targetSnapshot.targetSnapshotHash).trim(),
  };
}

function targetSnapshotHashFields(targetSnapshot) {
  return buildCanonicalTargetSnapshotFields({
    specKey: targetSnapshot.specKey,
    topicKey: targetSnapshot.topicKey,
    advisoryAction: targetSnapshot.advisoryAction,
    advisorySourceRef: targetSnapshot.advisorySourceRef,
    evidenceCutoffAt: targetSnapshot.evidenceCutoffAt,
  });
}

function canonicalEvidenceJson(sourceEvidence) {
  return canonicalJson(canonicaliseEvidenceSnapshot(sourceEvidence));
}

function buildResult(blockingReasons, evaluatedAt) {
  const sortedReasons = sortBlockingReasons(blockingReasons);
  return {
    policyVersion: ELIGIBILITY_POLICY_VERSION,
    classification:
      sortedReasons.length === 0 ? CLASSIFICATION_ELIGIBLE : CLASSIFICATION_NOT_ELIGIBLE,
    blockingReasons: sortedReasons,
    evidenceAuthority: EVIDENCE_AUTHORITY,
    evaluatedAt,
  };
}

function evaluateProvenanceGroup(proposal, reasons) {
  const snapshot = proposal.approvalSnapshot;
  const frozen = hasProvenanceSiblingPair(snapshot.sourceEvidence, snapshot.evidenceSnapshotHash);
  const b2Bound = isProvenanceBoundB2Proposal(proposal);

  if (!b2Bound) {
    const topLevel = hasProvenanceSiblingPair(
      proposal.sourceEvidence,
      proposal.evidenceSnapshotHash
    );
    if (!frozen.complete && !topLevel.complete) {
      reasons.push(BLOCKING_REASONS.HISTORICAL_NO_PROVENANCE);
    }
    return { b2Bound: false, frozenComplete: frozen.complete, stopStructural: true };
  }

  if (!frozen.hasEvidence && !frozen.hasHash) {
    reasons.push(BLOCKING_REASONS.MISSING_FROZEN_PROVENANCE);
    return { b2Bound: true, frozenComplete: false, stopStructural: true };
  }

  if (frozen.partial) {
    reasons.push(BLOCKING_REASONS.INCOMPLETE_PROVENANCE_SIBLINGS);
    return { b2Bound: true, frozenComplete: false, stopStructural: true };
  }

  try {
    const frozenCanonical = canonicaliseEvidenceSnapshot(snapshot.sourceEvidence);
    const expectedHash = deriveEvidenceSnapshotHash(frozenCanonical);
    if (String(snapshot.evidenceSnapshotHash).trim() !== expectedHash) {
      reasons.push(BLOCKING_REASONS.PROVENANCE_INTEGRITY_FAILURE);
      return { b2Bound: true, frozenComplete: false, stopStructural: true };
    }

    const topLevel = hasProvenanceSiblingPair(
      proposal.sourceEvidence,
      proposal.evidenceSnapshotHash
    );
    if (topLevel.complete) {
      const proposalCanonical = canonicaliseEvidenceSnapshot(proposal.sourceEvidence);
      const proposalHash = deriveEvidenceSnapshotHash(proposalCanonical);
      if (
        proposalHash !== expectedHash ||
        canonicalJson(proposalCanonical) !== canonicalJson(frozenCanonical)
      ) {
        reasons.push(BLOCKING_REASONS.SNAPSHOT_PROVENANCE_MISMATCH);
      }
    }
  } catch {
    reasons.push(BLOCKING_REASONS.PROVENANCE_INTEGRITY_FAILURE);
    return { b2Bound: true, frozenComplete: false, stopStructural: true };
  }

  return { b2Bound: true, frozenComplete: true, stopStructural: false };
}

function evaluateTargetSnapshotGroup(proposal, reasons) {
  const snapshot = proposal.approvalSnapshot;
  const frozenTarget = snapshot.targetSnapshot;
  const proposalTarget = proposal.targetSnapshot;

  if (!frozenTarget) {
    return;
  }

  if (frozenTarget.targetType !== TARGET_TYPE) {
    if (S1_RESERVED_TARGET_TYPES.includes(frozenTarget.targetType)) {
      reasons.push(BLOCKING_REASONS.STUDENT_CLASS_TARGET_FORBIDDEN);
    } else {
      reasons.push(BLOCKING_REASONS.UNSUPPORTED_TARGET_TYPE);
    }
  }

  if (typeof frozenTarget.targetCount !== "number" || frozenTarget.targetCount !== 0) {
    reasons.push(BLOCKING_REASONS.NON_ZERO_TARGET_COUNT);
  }

  if (frozenTarget.targetSnapshotVersion !== TARGET_SNAPSHOT_VERSION) {
    reasons.push(BLOCKING_REASONS.UNSUPPORTED_TARGET_TYPE);
  }

  for (const key of Object.keys(frozenTarget)) {
    if (FORBIDDEN_TARGET_SNAPSHOT_FIELDS.includes(key)) {
      reasons.push(BLOCKING_REASONS.STUDENT_CLASS_TARGET_FORBIDDEN);
      break;
    }
  }

  try {
    const expectedHash = computeTargetSnapshotHash(targetSnapshotHashFields(frozenTarget));
    if (String(frozenTarget.targetSnapshotHash).trim() !== expectedHash) {
      reasons.push(BLOCKING_REASONS.TARGET_SNAPSHOT_INTEGRITY_FAILURE);
    }
  } catch {
    reasons.push(BLOCKING_REASONS.TARGET_SNAPSHOT_INTEGRITY_FAILURE);
  }

  if (proposalTarget) {
    const frozenCanonical = canonicalTargetSnapshotContent(frozenTarget);
    const proposalCanonical = canonicalTargetSnapshotContent(proposalTarget);
    if (canonicalJson(frozenCanonical) !== canonicalJson(proposalCanonical)) {
      reasons.push(BLOCKING_REASONS.TARGET_SNAPSHOT_MISMATCH);
    }
  }
}

function evaluateAdvisoryPolicyGroup(proposal, reasons, { b2Bound, frozenComplete }) {
  if (!frozenComplete) {
    return;
  }

  const snapshot = proposal.approvalSnapshot;
  const sourceEvidence = snapshot.sourceEvidence;

  if (snapshot.policyVersion !== POLICY_VERSION) {
    reasons.push(BLOCKING_REASONS.POLICY_VERSION_MISMATCH);
  }

  if (proposal.actionType !== ACTION_TYPE) {
    reasons.push(BLOCKING_REASONS.UNSUPPORTED_ACTION_TYPE);
  }

  const readiness = sourceEvidence.readinessClassification;
  if (readiness === NOT_AN_ACTION_READINESS) {
    reasons.push(BLOCKING_REASONS.NOT_AN_ACTION_ADVISORY);
  } else if (!ACTIONABLE_READINESS_CLASSIFICATIONS.includes(readiness)) {
    reasons.push(BLOCKING_REASONS.UNSUPPORTED_READINESS_CLASSIFICATION);
  }

  const advisoryAction = sourceEvidence.sourceAdvisoryAction;
  const policy = ADVISORY_READINESS_POLICY[advisoryAction];
  if (!policy) {
    reasons.push(BLOCKING_REASONS.UNSUPPORTED_READINESS_CLASSIFICATION);
  } else {
    if (policy.readinessClassification !== readiness) {
      reasons.push(BLOCKING_REASONS.UNSUPPORTED_READINESS_CLASSIFICATION);
    }
    if (policy.minimumPermissionLevel !== sourceEvidence.minimumPermissionLevel) {
      reasons.push(BLOCKING_REASONS.PERMISSION_LEVEL_MISMATCH);
    }
    if (policy.minimumPermissionLevel !== snapshot.minimumPermissionLevel) {
      reasons.push(BLOCKING_REASONS.PERMISSION_LEVEL_MISMATCH);
    }
  }

  const requirements = Array.isArray(sourceEvidence.blockingRequirements)
    ? sourceEvidence.blockingRequirements
    : [];
  for (const blocker of PREPARATION_SAFETY_BLOCKERS) {
    if (requirements.includes(blocker)) {
      reasons.push(BLOCKING_REASONS.PLATFORM_CAPABILITY_BLOCKER);
      break;
    }
  }

  if (b2Bound) {
    const frozenTarget = snapshot.targetSnapshot;
    const advisorySourceRef = String(frozenTarget?.advisorySourceRef || "").trim();
    if (!B2_ADVISORY_SOURCE_REF_PATTERN.test(advisorySourceRef)) {
      reasons.push(BLOCKING_REASONS.UNSUPPORTED_ADVISORY_SOURCE_REF);
    } else {
      try {
        const identityHash = deriveObservationIdentityHash(sourceEvidence);
        const expectedRef = buildAdvisorySourceRef(sourceEvidence.sourceTopicKey, identityHash);
        if (advisorySourceRef !== expectedRef) {
          reasons.push(BLOCKING_REASONS.UNSUPPORTED_ADVISORY_SOURCE_REF);
        }
      } catch {
        reasons.push(BLOCKING_REASONS.UNSUPPORTED_ADVISORY_SOURCE_REF);
      }
    }
  }
}

function evaluatePreparationEligibility(proposalPlain, options = {}) {
  const evaluatedAt = options.evaluatedAt;
  if (!evaluatedAt) {
    throw new Error("evaluatedAt is required for deterministic preparation eligibility evaluation");
  }

  const reasons = [];

  if (isExecutionEnabled()) {
    reasons.push(BLOCKING_REASONS.EXECUTION_INVARIANT_FAILURE);
  }

  if (proposalPlain.status !== "APPROVED") {
    reasons.push(BLOCKING_REASONS.WRONG_LIFECYCLE_STATUS);
    return buildResult(reasons, evaluatedAt);
  }

  if (!proposalPlain.approvalSnapshot) {
    reasons.push(BLOCKING_REASONS.MISSING_APPROVAL_SNAPSHOT);
    return buildResult(reasons, evaluatedAt);
  }

  const provenanceState = evaluateProvenanceGroup(proposalPlain, reasons);
  if (provenanceState.stopStructural) {
    return buildResult(reasons, evaluatedAt);
  }

  evaluateTargetSnapshotGroup(proposalPlain, reasons);
  evaluateAdvisoryPolicyGroup(proposalPlain, reasons, provenanceState);

  return buildResult(reasons, evaluatedAt);
}

module.exports = {
  evaluatePreparationEligibility,
  isProvenanceBoundB2Proposal,
  canonicalTargetSnapshotContent,
};
