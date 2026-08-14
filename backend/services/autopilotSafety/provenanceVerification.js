/**
 * Autopilot Safety Foundation — S1.4B1 read-only observer provenance verification.
 * Dormant: not wired into proposal creation, routes, or persistence mutation paths.
 */
const { POLICY_VERSION } = require("../../contracts/autopilotSafetyPolicy.v1");
const {
  PROVENANCE_VERSION,
  SOURCE_SYSTEM,
  SOURCE_OBSERVER,
  canonicaliseEvidenceSnapshot,
  deriveEvidenceSnapshotHash,
  ProvenanceContractError,
} = require("../../contracts/autopilotProposalProvenance.v1");
const {
  buildExecutionContractIntelligenceForTopic,
} = require("../autopilot0/executionContractIntelligenceService");

class ProvenanceVerificationError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = "ProvenanceVerificationError";
    this.code = code;
    if (cause) {
      this.cause = cause;
    }
  }
}

function resolveAuthoritativeSpecKey(report) {
  const authoritativeSpecKey =
    report?.cohort?.specKey != null ? String(report.cohort.specKey).trim() : "";
  if (!authoritativeSpecKey) {
    throw new ProvenanceVerificationError(
      "OBSERVER_SPEC_IDENTITY_MISSING",
      "Exact-topic observer report is missing cohort.specKey"
    );
  }
  return authoritativeSpecKey;
}

/**
 * Map exact-topic A0.9 report to S1.4A evidence input (no trusted digests).
 * sourceSpecKey is taken from authoritative report.cohort.specKey.
 * sourceTopicKey is taken from the exact-topic evidence row.
 * @param {{ version: string, generatedAt: string, cohort: { specKey?: string }, topicExecutionReadiness: object }} report
 */
function mapExactTopicReportToSourceEvidenceInput(report) {
  const row = report?.topicExecutionReadiness;
  if (!row || typeof row !== "object") {
    throw new ProvenanceVerificationError(
      "EXACT_TOPIC_EVIDENCE_MALFORMED",
      "Exact-topic observer produced malformed evidence row"
    );
  }

  const sourceTopicKey = String(row.topicKey || "").trim();
  if (!sourceTopicKey) {
    throw new ProvenanceVerificationError(
      "EXACT_TOPIC_EVIDENCE_MALFORMED",
      "Exact-topic observer evidence row is missing topicKey"
    );
  }

  const draft = {
    provenanceVersion: PROVENANCE_VERSION,
    sourceSystem: SOURCE_SYSTEM,
    sourceObserver: SOURCE_OBSERVER,
    sourceObserverVersion: String(report.version || "").trim(),
    sourcePolicyVersion: POLICY_VERSION,
    sourceGeneratedAt: report.generatedAt,
    sourceSpecKey: resolveAuthoritativeSpecKey(report),
    sourceTopicKey,
    sourceAdvisoryAction: String(row.advisoryAction).trim(),
    readinessClassification: String(row.readinessClassification).trim(),
    minimumPermissionLevel: String(row.minimumPermissionLevel).trim(),
    blockingRequirements: Array.isArray(row.blockingRequirements)
      ? row.blockingRequirements.map((item) => String(item).trim())
      : [],
  };

  if (row.observedOutcome != null && String(row.observedOutcome).trim().length > 0) {
    draft.sourceObservedOutcome = String(row.observedOutcome).trim();
  }

  if (Array.isArray(row.missingCapabilities) && row.missingCapabilities.length > 0) {
    draft.missingCapabilities = row.missingCapabilities.map((item) => String(item).trim());
  }

  if (row.executionContract != null && typeof row.executionContract === "object") {
    draft.executionContract = row.executionContract;
  }

  return draft;
}

/**
 * Read-only verifier: exact-topic A0.9 evidence → canonical siblings.
 * @param {{ specKey: string, topicKey: string, now?: Date|string|number }} opts
 * @returns {Promise<{ sourceEvidence: object, evidenceSnapshotHash: string }>}
 */
async function verifyObserverProposalProvenance(opts = {}) {
  const specKey = opts?.specKey != null ? String(opts.specKey).trim() : "";
  if (!specKey) {
    throw new ProvenanceVerificationError("INVALID_SPEC_KEY", "specKey is required");
  }

  const topicKey = opts?.topicKey != null ? String(opts.topicKey).trim() : "";
  if (!topicKey) {
    throw new ProvenanceVerificationError("INVALID_TOPIC_KEY", "topicKey is required");
  }

  let report;
  try {
    report = await buildExecutionContractIntelligenceForTopic({
      specKey,
      topicKey,
      now: opts.now,
    });
  } catch (err) {
    if (err && typeof err.code === "string") {
      throw new ProvenanceVerificationError(err.code, err.message, err);
    }
    throw new ProvenanceVerificationError(
      "OBSERVER_EVIDENCE_UNAVAILABLE",
      "Exact-topic observer evidence could not be resolved",
      err
    );
  }

  const authoritativeSpecKey = resolveAuthoritativeSpecKey(report);
  if (authoritativeSpecKey !== specKey) {
    throw new ProvenanceVerificationError(
      "OBSERVER_SPEC_IDENTITY_MISMATCH",
      `Observer cohort specKey "${authoritativeSpecKey}" does not match requested specKey "${specKey}"`
    );
  }

  let sourceEvidence;
  try {
    sourceEvidence = canonicaliseEvidenceSnapshot(mapExactTopicReportToSourceEvidenceInput(report));
  } catch (err) {
    if (err instanceof ProvenanceContractError) {
      throw new ProvenanceVerificationError(err.code, err.message, err);
    }
    if (err instanceof ProvenanceVerificationError) {
      throw err;
    }
    throw err;
  }

  if (sourceEvidence.readinessClassification === "NOT_AN_ACTION") {
    throw new ProvenanceVerificationError(
      "NOT_AN_ACTION",
      "Observer evidence is not actionable for proposal provenance verification"
    );
  }

  const evidenceSnapshotHash = deriveEvidenceSnapshotHash(sourceEvidence);

  return {
    sourceEvidence,
    evidenceSnapshotHash,
  };
}

module.exports = {
  ProvenanceVerificationError,
  mapExactTopicReportToSourceEvidenceInput,
  verifyObserverProposalProvenance,
};
