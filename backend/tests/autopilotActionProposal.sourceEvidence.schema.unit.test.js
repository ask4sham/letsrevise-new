/**
 * @jest-environment node
 */
const mongoose = require("mongoose");
const provenance = require("../contracts/autopilotProposalProvenance.v1");
const policy = require("../contracts/autopilotSafetyPolicy.v1");
const {
  AutopilotActionProposalSchema,
  defaultExpiresAt,
} = require("../models/AutopilotActionProposal");

const AutopilotActionProposal = mongoose.model(
  "AutopilotActionProposalSourceEvidenceTest",
  AutopilotActionProposalSchema,
  "autopilot_action_proposals_source_evidence_test"
);

function validTargetSnapshot(overrides = {}) {
  return {
    targetType: "SPEC_TOPIC_OBSERVATION",
    specKey: "aqa-gcse-biology",
    topicKey: "aqa-gcse-biology:cell-structure",
    advisoryAction: "CONSIDER_FLASHCARD_REVISION",
    advisorySourceRef: "execution-contract-intelligence:hash-abc",
    evidenceCutoffAt: new Date("2026-08-01T12:00:00.000Z"),
    targetCount: 0,
    targetSnapshotHash: "sha256:deadbeef",
    targetSnapshotVersion: policy.TARGET_SNAPSHOT_VERSION,
    ...overrides,
  };
}

function validSourceEvidence(overrides = {}) {
  return {
    provenanceVersion: provenance.PROVENANCE_VERSION,
    sourceSystem: provenance.SOURCE_SYSTEM,
    sourceObserver: provenance.SOURCE_OBSERVER,
    sourceObserverVersion: provenance.SUPPORTED_SOURCE_OBSERVER_VERSIONS[0],
    sourcePolicyVersion: provenance.SUPPORTED_SOURCE_POLICY_VERSIONS[0],
    sourceGeneratedAt: new Date("2026-08-01T12:00:00.000Z"),
    sourceSpecKey: "aqa-gcse-biology",
    sourceTopicKey: "aqa-gcse-biology:cell-structure",
    sourceAdvisoryAction: "CONSIDER_FLASHCARD_REVISION",
    readinessClassification: "REQUIRES_L2_PREPARATION",
    minimumPermissionLevel: "L2",
    blockingRequirements: [
      "NO_STUDENT_SCOPE",
      "NO_AUTOPILOT_ACTION_AUDIT",
      "NO_IDEMPOTENCY",
      "NO_AUTOMATED_ROLLBACK",
      "STUDENT_IMPACTING",
    ],
    ...overrides,
  };
}

function validProposalInput(overrides = {}) {
  const specKey = overrides.specKey || "aqa-gcse-biology";
  const topicKey = overrides.topicKey || "aqa-gcse-biology:cell-structure";
  return {
    idempotencyKey: overrides.idempotencyKey || "idem-key-source-evidence-001",
    actionType: "OBSERVER_DERIVED_PROPOSAL",
    autopilotObserverVersion: "autopilot0-execution-contract-intelligence-v1",
    advisorySource: {
      observer: "execution-contract-intelligence",
      advisoryAction: "CONSIDER_FLASHCARD_REVISION",
      specKey,
      topicKey,
    },
    specKey,
    topicKey,
    minimumPermissionLevel: "L2",
    targetSnapshot: validTargetSnapshot({ specKey, topicKey }),
    proposedPayload: {
      envelopeType: "OBSERVATION_ONLY",
      observationNote: "Observer-derived observation only — not executable.",
    },
    ...overrides,
  };
}

function siblingPair(overrides = {}) {
  const canonical = provenance.canonicaliseEvidenceSnapshot(validSourceEvidence(overrides));
  return {
    sourceEvidence: canonical,
    evidenceSnapshotHash: provenance.deriveEvidenceSnapshotHash(canonical),
  };
}

describe("AutopilotActionProposal sourceEvidence S1.4B1 schema", () => {
  test("historical proposal without provenance siblings still validates", () => {
    const doc = new AutopilotActionProposal(validProposalInput());
    const err = doc.validateSync();
    expect(err).toBeUndefined();
    expect(doc.sourceEvidence).toBeNull();
    expect(doc.evidenceSnapshotHash).toBeNull();
  });

  test("valid sibling pair validates and stores canonical sourceEvidence only", () => {
    const pair = siblingPair();
    const doc = new AutopilotActionProposal(
      validProposalInput({
        ...pair,
      })
    );
    const err = doc.validateSync();
    expect(err).toBeUndefined();
    expect(doc.sourceEvidence).toBeTruthy();
    expect(doc.sourceEvidence).not.toHaveProperty("evidenceSnapshotHash");
    expect(doc.evidenceSnapshotHash).toBe(pair.evidenceSnapshotHash);
  });

  test("sourceEvidence without evidenceSnapshotHash is rejected", () => {
    const doc = new AutopilotActionProposal(
      validProposalInput({
        sourceEvidence: siblingPair().sourceEvidence,
      })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.sourceEvidence).toBeDefined();
  });

  test("evidenceSnapshotHash without sourceEvidence is rejected", () => {
    const doc = new AutopilotActionProposal(
      validProposalInput({
        evidenceSnapshotHash: "abc123",
      })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.sourceEvidence).toBeDefined();
  });

  test("mismatched evidenceSnapshotHash is rejected", () => {
    const doc = new AutopilotActionProposal(
      validProposalInput({
        ...siblingPair(),
        evidenceSnapshotHash: "deadbeef".repeat(8),
      })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.evidenceSnapshotHash).toBeDefined();
  });

  test("embedded evidenceSnapshotHash inside sourceEvidence is rejected by contract canonicalisation", () => {
    const doc = new AutopilotActionProposal(
      validProposalInput({
        sourceEvidence: {
          ...siblingPair().sourceEvidence,
          evidenceSnapshotHash: siblingPair().evidenceSnapshotHash,
        },
        evidenceSnapshotHash: siblingPair().evidenceSnapshotHash,
      })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.sourceEvidence).toBeDefined();
  });

  test("sourceEvidence spec/topic must match proposal identity", () => {
    const doc = new AutopilotActionProposal(
      validProposalInput({
        ...siblingPair({
          sourceTopicKey: "aqa-gcse-biology:osmosis",
        }),
      })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors["sourceEvidence.sourceTopicKey"]).toBeDefined();
  });

  test("unknown sourceEvidence field rejected by strict schema", () => {
    const pair = siblingPair();
    const doc = new AutopilotActionProposal(
      validProposalInput({
        sourceEvidence: {
          ...pair.sourceEvidence,
          gitSha: "abc123",
        },
        evidenceSnapshotHash: pair.evidenceSnapshotHash,
      })
    );
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(
      err.errors["sourceEvidence.gitSha"] || err.errors.sourceEvidence
    ).toBeDefined();
  });

  test("provenance siblings are immutable once set", () => {
    const path = (name) => AutopilotActionProposalSchema.path(name);
    expect(path("sourceEvidence").options.immutable).toBe(true);
    expect(path("evidenceSnapshotHash").options.immutable).toBe(true);
  });

  test("APPROVED lifecycle still works without provenance siblings", () => {
    const reviewer = new mongoose.Types.ObjectId();
    const doc = new AutopilotActionProposal(
      validProposalInput({
        status: "APPROVED",
        reviewedBy: reviewer,
        reviewedAt: new Date(),
        approvalSnapshot: {
          targetSnapshot: validTargetSnapshot(),
          proposedPayload: { envelopeType: "OBSERVATION_ONLY" },
          policyVersion: policy.POLICY_VERSION,
          minimumPermissionLevel: "L2",
          advisorySource: {
            observer: "execution-contract-intelligence",
            advisoryAction: "CONSIDER_FLASHCARD_REVISION",
            specKey: "aqa-gcse-biology",
            topicKey: "aqa-gcse-biology:cell-structure",
          },
          evidenceCutoffAt: new Date("2026-08-01T12:00:00.000Z"),
          idempotencyKey: "idem-key-source-evidence-001",
          approvedAt: new Date(),
          approverId: reviewer,
          approverRole: "admin",
          expiresAt: defaultExpiresAt(),
        },
      })
    );
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });
});
