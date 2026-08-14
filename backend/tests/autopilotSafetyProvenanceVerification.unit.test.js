/**
 * @jest-environment node
 */
jest.mock("../services/autopilot0/executionContractIntelligenceService", () => ({
  buildExecutionContractIntelligenceForTopic: jest.fn(),
}));

const provenance = require("../contracts/autopilotProposalProvenance.v1");
const {
  verifyObserverProposalProvenance,
  mapExactTopicReportToSourceEvidenceInput,
  ProvenanceVerificationError,
} = require("../services/autopilotSafety/provenanceVerification");
const {
  buildExecutionContractIntelligenceForTopic,
} = require("../services/autopilot0/executionContractIntelligenceService");

const A09_VERSION = "autopilot0-execution-contract-intelligence-v1";

const SPEC = "aqa-gcse-biology";
const TOPIC = "aqa-gcse-biology:cell-structure";
const GENERATED_AT = "2026-08-01T12:00:00.000Z";

function actionableRow(overrides = {}) {
  return {
    topicKey: TOPIC,
    advisoryAction: "CONSIDER_FLASHCARD_REVISION",
    observedOutcome: "WEAK_AND_STABLE",
    readinessClassification: "REQUIRES_L2_PREPARATION",
    minimumPermissionLevel: "L2",
    blockingRequirements: [
      "NO_STUDENT_SCOPE",
      "NO_AUTOPILOT_ACTION_AUDIT",
      "NO_IDEMPOTENCY",
      "NO_AUTOMATED_ROLLBACK",
      "STUDENT_IMPACTING",
    ],
    missingCapabilities: ["TARGET_SCOPE_RESOLVER"],
    executionContract: {
      auditReadiness: "MISSING",
      idempotencyReadiness: "MISSING",
      rollbackReadiness: "MISSING",
      targetingReadiness: "MISSING",
      approvalReadiness: "MISSING",
      futurePilotEligible: false,
      executionRisks: ["STUDENT_IMPACTING"],
    },
    ...overrides,
  };
}

function exactTopicReport(row = actionableRow(), cohortOverrides = {}) {
  return {
    version: A09_VERSION,
    level: "L0",
    generatedAt: GENERATED_AT,
    cohort: {
      specKey: SPEC,
      cohortScope: "SPEC_ONLY",
      tierSupported: false,
      tier: null,
      ...cohortOverrides,
    },
    topicExecutionReadiness: row,
  };
}

describe("autopilotSafety provenanceVerification S1.4B1", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("mapExactTopicReportToSourceEvidenceInput uses authoritative cohort.specKey and row.topicKey", () => {
    const draft = mapExactTopicReportToSourceEvidenceInput(exactTopicReport());
    expect(draft).not.toHaveProperty("evidenceSnapshotHash");
    expect(draft).not.toHaveProperty("targetSnapshotHash");
    expect(draft.sourceObserverVersion).toBe(A09_VERSION);
    expect(draft.sourcePolicyVersion).toBe("autopilot-safety-policy-v1");
    expect(draft.sourceSpecKey).toBe(SPEC);
    expect(draft.sourceTopicKey).toBe(TOPIC);
  });

  test("verifyObserverProposalProvenance returns exactly sourceEvidence and evidenceSnapshotHash", async () => {
    buildExecutionContractIntelligenceForTopic.mockResolvedValue(exactTopicReport());

    const result = await verifyObserverProposalProvenance({
      specKey: SPEC,
      topicKey: TOPIC,
    });

    expect(buildExecutionContractIntelligenceForTopic).toHaveBeenCalledWith({
      specKey: SPEC,
      topicKey: TOPIC,
      now: undefined,
    });
    expect(Object.keys(result).sort()).toEqual(["evidenceSnapshotHash", "sourceEvidence"]);
    expect(result.sourceEvidence).not.toHaveProperty("evidenceSnapshotHash");
    expect(result.evidenceSnapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.evidenceSnapshotHash).toBe(
      provenance.deriveEvidenceSnapshotHash(result.sourceEvidence)
    );
  });

  test("NOT_AN_ACTION fails closed with NOT_AN_ACTION", async () => {
    buildExecutionContractIntelligenceForTopic.mockResolvedValue(
      exactTopicReport(
        actionableRow({
          advisoryAction: "INSUFFICIENT_EVIDENCE",
          readinessClassification: "NOT_AN_ACTION",
          minimumPermissionLevel: "L0",
          blockingRequirements: [],
          missingCapabilities: [],
          executionContract: {
            auditReadiness: "NOT_APPLICABLE",
            idempotencyReadiness: "NOT_APPLICABLE",
            rollbackReadiness: "NOT_APPLICABLE",
            targetingReadiness: "NOT_APPLICABLE",
            approvalReadiness: "NOT_APPLICABLE",
            futurePilotEligible: false,
            executionRisks: [],
          },
          observedOutcome: null,
        })
      )
    );

    await expect(
      verifyObserverProposalProvenance({ specKey: SPEC, topicKey: TOPIC })
    ).rejects.toMatchObject({
      code: "NOT_AN_ACTION",
    });
  });

  test("observer cohort.specKey mismatch with requested specKey fails closed", async () => {
    buildExecutionContractIntelligenceForTopic.mockResolvedValue(
      exactTopicReport(actionableRow(), { specKey: "aqa-gcse-physics" })
    );

    await expect(
      verifyObserverProposalProvenance({ specKey: SPEC, topicKey: TOPIC })
    ).rejects.toMatchObject({
      code: "OBSERVER_SPEC_IDENTITY_MISMATCH",
    });
  });

  test("missing specKey fails closed", async () => {
    await expect(verifyObserverProposalProvenance({ topicKey: TOPIC })).rejects.toMatchObject({
      code: "INVALID_SPEC_KEY",
    });
    expect(buildExecutionContractIntelligenceForTopic).not.toHaveBeenCalled();
  });

  test("missing topicKey fails closed", async () => {
    await expect(verifyObserverProposalProvenance({ specKey: SPEC })).rejects.toMatchObject({
      code: "INVALID_TOPIC_KEY",
    });
    expect(buildExecutionContractIntelligenceForTopic).not.toHaveBeenCalled();
  });

  test("observer exact-topic mismatch propagates fail-closed", async () => {
    const err = new Error("Exact-topic observer returned evidence for a different topic");
    err.code = "EXACT_TOPIC_EVIDENCE_MISMATCH";
    buildExecutionContractIntelligenceForTopic.mockRejectedValue(err);

    await expect(
      verifyObserverProposalProvenance({ specKey: SPEC, topicKey: TOPIC })
    ).rejects.toBeInstanceOf(ProvenanceVerificationError);

    await expect(
      verifyObserverProposalProvenance({ specKey: SPEC, topicKey: TOPIC })
    ).rejects.toMatchObject({ code: "EXACT_TOPIC_EVIDENCE_MISMATCH" });
  });

  test("service source does not import proposalService or proposal routes", () => {
    const fs = require("fs");
    const path = require("path");
    const source = fs.readFileSync(
      path.join(__dirname, "..", "services", "autopilotSafety", "provenanceVerification.js"),
      "utf8"
    );
    expect(source).not.toMatch(/proposalService/);
    expect(source).not.toMatch(/routes\/autopilotSafety/);
    expect(source).not.toMatch(/createProposal/);
  });
});
