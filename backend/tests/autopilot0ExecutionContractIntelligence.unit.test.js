/**
 * Autopilot 0 Execution Contract Intelligence Observer V1 — unit tests.
 */
const fs = require("fs");
const path = require("path");

const SERVICE_PATH = path.join(
  __dirname,
  "..",
  "services",
  "autopilot0",
  "executionContractIntelligenceService.js"
);
const serviceSource = fs.readFileSync(SERVICE_PATH, "utf8");

jest.mock("../services/autopilot0/actionReadinessIntelligenceService", () => ({
  buildActionReadinessIntelligence: jest.fn(),
  DB_OPERATION_COUNT: 10,
}));
jest.mock("../services/adminTaxonomyService", () => ({
  getMergedTaxonomyBySpecKey: jest.fn(),
}));

const {
  VERSION,
  LEVEL,
  DB_OPERATION_COUNT,
  L4_POLICY_CLASSES,
  EXECUTION_STATE_VOCABULARY,
  RECOMMENDED_FUTURE_L2_PILOT,
  buildExecutionContractFromBlockers,
  mapTopicExecutionReadinessRow,
  computeExecutionContractSummary,
  buildExecutionContractIntelligence,
  buildExecutionContractIntelligenceForTopic,
} = require("../services/autopilot0/executionContractIntelligenceService");
const { buildActionReadinessIntelligence } = require("../services/autopilot0/actionReadinessIntelligenceService");
const adminTaxonomyService = require("../services/adminTaxonomyService");

const SPEC = "aqa-gcse-biology";
const CANONICAL = `${SPEC}:cell-structure`;
const GENERATED_AT = "2026-06-01T12:00:00.000Z";

const FOR_TOPIC_TAXONOMY = {
  units: [
    {
      unit: "Cell biology",
      unitKey: "cell-biology",
      topics: [{ key: "cell-structure", topic: "Cell structure" }],
    },
  ],
};

const COHORT = {
  specKey: SPEC,
  cohortScope: "SPEC_ONLY",
  tierSupported: false,
  tier: null,
};

const STUDENT_IMPACTING_BLOCKERS = [
  "NO_STUDENT_SCOPE",
  "NO_AUTOPILOT_ACTION_AUDIT",
  "NO_IDEMPOTENCY",
  "NO_AUTOMATED_ROLLBACK",
  "STUDENT_IMPACTING",
];

function readinessRow({
  advisoryAction,
  observedOutcome = "WEAK_AND_STABLE",
  blockingRequirements = [],
  readinessClassification = "NOT_AN_ACTION",
  minimumPermissionLevel = "L0",
}) {
  return {
    topicKey: CANONICAL,
    advisoryAction,
    observedOutcome,
    minimumPermissionLevel,
    readinessClassification,
    blockingRequirements,
  };
}

function makeA08Report(topicReadiness) {
  return {
    version: "autopilot0-action-readiness-intelligence-v1",
    level: "L0",
    generatedAt: GENERATED_AT,
    cohort: COHORT,
    topicReadiness,
    policy: { currentAutopilotLevel: "L0", l1ExecutionEnabled: false, l4Classes: [] },
    summary: { overallStatus: "UNKNOWN", humanReviewRequired: true, l1EligibleCount: 0 },
  };
}

describe("executionContractIntelligenceService contract", () => {
  test("version, level, and DB op count delegated to A0.8", () => {
    expect(VERSION).toBe("autopilot0-execution-contract-intelligence-v1");
    expect(LEVEL).toBe("L0");
    expect(DB_OPERATION_COUNT).toBe(10);
  });

  test("service wraps A0.8 only — no independent intelligence builders or models", () => {
    expect(serviceSource).toMatch(/buildActionReadinessIntelligence/);
    expect(serviceSource).not.toMatch(/buildGroundedNextActionIntelligence\(/);
    expect(serviceSource).not.toMatch(/buildRevisionIntelligence\(/);
    expect(serviceSource).not.toMatch(/require\("\.\.\/\.\.\/models\//);
  });
});

describe("NOT_AN_ACTION advisories", () => {
  test.each([
    "CONTINUE_CURRENT_PATH",
    "NO_FURTHER_WEAKNESS_OBSERVED",
    "INSUFFICIENT_EVIDENCE",
  ])("%s produces NOT_APPLICABLE execution readiness", (advisoryAction) => {
    const row = mapTopicExecutionReadinessRow(
      readinessRow({ advisoryAction, readinessClassification: "NOT_AN_ACTION" })
    );
    expect(row.executionContract.auditReadiness).toBe("NOT_APPLICABLE");
    expect(row.executionContract.idempotencyReadiness).toBe("NOT_APPLICABLE");
    expect(row.executionContract.rollbackReadiness).toBe("NOT_APPLICABLE");
    expect(row.executionContract.targetingReadiness).toBe("NOT_APPLICABLE");
    expect(row.executionContract.approvalReadiness).toBe("NOT_APPLICABLE");
    expect(row.missingCapabilities).toEqual([]);
    expect(row.executionContract.futurePilotEligible).toBe(false);
  });
});

describe("buildExecutionContractFromBlockers", () => {
  test("CONSIDER_RETEACH blocker mapping", () => {
    const { executionContract, missingCapabilities } = buildExecutionContractFromBlockers(
      STUDENT_IMPACTING_BLOCKERS
    );
    expect(executionContract.targetingReadiness).toBe("MISSING");
    expect(executionContract.auditReadiness).toBe("MISSING");
    expect(executionContract.idempotencyReadiness).toBe("MISSING");
    expect(executionContract.rollbackReadiness).toBe("MISSING");
    expect(executionContract.futurePilotEligible).toBe(false);
    expect(executionContract.executionRisks).toEqual([
      "STUDENT_IMPACTING",
      "REQUIRES_OWNED_FROZEN_TARGET_SCOPE",
    ]);
    expect(missingCapabilities).toEqual([
      "ACTION_IDEMPOTENCY_CONTRACT",
      "AUTOMATED_ROLLBACK_CONTRACT",
      "AUTOPILOT_ACTION_AUDIT",
      "TARGET_SCOPE_RESOLVER",
    ]);
  });

  test("CONSIDER_MORE_PRACTICE blocker mapping", () => {
    const row = mapTopicExecutionReadinessRow(
      readinessRow({
        advisoryAction: "CONSIDER_MORE_PRACTICE",
        readinessClassification: "REQUIRES_L2_PREPARATION",
        minimumPermissionLevel: "L2",
        blockingRequirements: STUDENT_IMPACTING_BLOCKERS,
      })
    );
    expect(row.missingCapabilities).toEqual([
      "ACTION_IDEMPOTENCY_CONTRACT",
      "AUTOMATED_ROLLBACK_CONTRACT",
      "AUTOPILOT_ACTION_AUDIT",
      "TARGET_SCOPE_RESOLVER",
    ]);
    expect(row.executionContract.futurePilotEligible).toBe(false);
  });

  test("CONSIDER_EXAM_PRACTICE includes assessment guard", () => {
    const row = mapTopicExecutionReadinessRow(
      readinessRow({
        advisoryAction: "CONSIDER_EXAM_PRACTICE",
        readinessClassification: "REQUIRES_L2_PREPARATION",
        minimumPermissionLevel: "L2",
        blockingRequirements: [...STUDENT_IMPACTING_BLOCKERS, "ASSESSMENT_ADJACENT"],
      })
    );
    expect(row.missingCapabilities).toEqual([
      "ACTION_IDEMPOTENCY_CONTRACT",
      "ASSESSMENT_EXECUTION_GUARD",
      "AUTOMATED_ROLLBACK_CONTRACT",
      "AUTOPILOT_ACTION_AUDIT",
      "TARGET_SCOPE_RESOLVER",
    ]);
  });

  test("CONSIDER_FLASHCARD_REVISION blocker mapping", () => {
    const row = mapTopicExecutionReadinessRow(
      readinessRow({
        advisoryAction: "CONSIDER_FLASHCARD_REVISION",
        readinessClassification: "REQUIRES_L2_PREPARATION",
        minimumPermissionLevel: "L2",
        blockingRequirements: STUDENT_IMPACTING_BLOCKERS,
      })
    );
    expect(row.executionContract.targetingReadiness).toBe("MISSING");
    expect(row.executionContract.futurePilotEligible).toBe(false);
    expect(row.missingCapabilities.length).toBeGreaterThan(0);
  });

  test("CONSIDER_QUESTION_REVIEW approval blockers", () => {
    const row = mapTopicExecutionReadinessRow(
      readinessRow({
        advisoryAction: "CONSIDER_QUESTION_REVIEW",
        readinessClassification: "REQUIRES_HUMAN_APPROVAL",
        minimumPermissionLevel: "L3",
        blockingRequirements: [
          "CONTENT_MUTATION_RISK",
          "ASSESSMENT_SEMANTICS_RISK",
          "HUMAN_REVIEW_REQUIRED",
        ],
      })
    );
    expect(row.executionContract.approvalReadiness).toBe("MISSING");
    expect(row.executionContract.auditReadiness).toBe("MISSING");
    expect(row.missingCapabilities).toEqual([
      "ASSESSMENT_CHANGE_APPROVAL",
      "HUMAN_APPROVAL_WORKFLOW",
      "IMMUTABLE_APPROVAL_SNAPSHOT",
    ]);
    expect(row.executionContract.futurePilotEligible).toBe(false);
  });

  test("unknown blocker fails safely", () => {
    expect(() => buildExecutionContractFromBlockers(["UNKNOWN_BLOCKER_X"])).toThrow(
      /Unknown blocking requirement/
    );
    try {
      buildExecutionContractFromBlockers(["UNKNOWN_BLOCKER_X"]);
    } catch (err) {
      expect(err.code).toBe("UNKNOWN_BLOCKER");
    }
  });
});

describe("computeExecutionContractSummary", () => {
  test("futurePilotEligibleCount always 0", () => {
    const rows = [
      mapTopicExecutionReadinessRow(
        readinessRow({
          advisoryAction: "CONSIDER_FLASHCARD_REVISION",
          readinessClassification: "REQUIRES_L2_PREPARATION",
          minimumPermissionLevel: "L2",
          blockingRequirements: STUDENT_IMPACTING_BLOCKERS,
        })
      ),
      mapTopicExecutionReadinessRow(
        readinessRow({ advisoryAction: "CONTINUE_CURRENT_PATH" })
      ),
    ];
    expect(computeExecutionContractSummary(rows)).toEqual({ futurePilotEligibleCount: 0 });
  });
});

describe("buildExecutionContractIntelligence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("delegates to A0.8 with same opts and adds zero DB calls", async () => {
    buildActionReadinessIntelligence.mockResolvedValue(makeA08Report([]));

    const report = await buildExecutionContractIntelligence({ specKey: SPEC, limit: 12 });

    expect(buildActionReadinessIntelligence).toHaveBeenCalledTimes(1);
    expect(buildActionReadinessIntelligence).toHaveBeenCalledWith({ specKey: SPEC, limit: 12 });
    expect(report.version).toBe(VERSION);
    expect(report.level).toBe("L0");
    expect(report.generatedAt).toBe(GENERATED_AT);
    expect(report.cohort).toEqual(COHORT);
    expect(report.topicExecutionReadiness).toEqual([]);
    expect(report.summary.futurePilotEligibleCount).toBe(0);
  });

  test("policy metadata includes pilot recommendation, L4 boundary, and state vocabulary", async () => {
    buildActionReadinessIntelligence.mockResolvedValue(makeA08Report([]));

    const report = await buildExecutionContractIntelligence({ specKey: SPEC });

    expect(report.policy.executionEnabled).toBe(false);
    expect(report.policy.l1ExecutionEnabled).toBe(false);
    expect(report.policy.l2PreparationEnabled).toBe(false);
    expect(report.policy.recommendedFutureL2Pilot).toBe(RECOMMENDED_FUTURE_L2_PILOT);
    expect(report.policy.l4Classes).toEqual([...L4_POLICY_CLASSES]);
    expect(report.policy.executionStateVocabulary).toEqual([...EXECUTION_STATE_VOCABULARY]);
    expect(report.policy.infrastructurePatterns.auditPatterns).toContain("OpsActionAudit");
  });

  test("no current row is futurePilotEligible and no student identifiers", async () => {
    buildActionReadinessIntelligence.mockResolvedValue(
      makeA08Report([
        readinessRow({
          advisoryAction: "CONSIDER_FLASHCARD_REVISION",
          readinessClassification: "REQUIRES_L2_PREPARATION",
          minimumPermissionLevel: "L2",
          blockingRequirements: STUDENT_IMPACTING_BLOCKERS,
        }),
        readinessRow({
          advisoryAction: "CONSIDER_QUESTION_REVIEW",
          readinessClassification: "REQUIRES_HUMAN_APPROVAL",
          minimumPermissionLevel: "L3",
          blockingRequirements: [
            "CONTENT_MUTATION_RISK",
            "ASSESSMENT_SEMANTICS_RISK",
            "HUMAN_REVIEW_REQUIRED",
          ],
        }),
      ])
    );

    const report = await buildExecutionContractIntelligence({ specKey: SPEC });
    const serialized = JSON.stringify(report);

    for (const row of report.topicExecutionReadiness) {
      expect(row.executionContract.futurePilotEligible).toBe(false);
    }
    expect(report.summary.futurePilotEligibleCount).toBe(0);
    expect(serialized).not.toMatch(/userId|studentId|email/i);
  });

  test("propagates INVALID_SPEC_KEY from A0.8", async () => {
    buildActionReadinessIntelligence.mockRejectedValue(
      Object.assign(new Error("Unknown specKey: bad"), { code: "INVALID_SPEC_KEY" })
    );
    await expect(buildExecutionContractIntelligence({ specKey: "bad" })).rejects.toMatchObject({
      code: "INVALID_SPEC_KEY",
    });
  });
});

describe("buildExecutionContractIntelligenceForTopic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue(FOR_TOPIC_TAXONOMY);
  });

  test("export exists", () => {
    expect(typeof buildExecutionContractIntelligenceForTopic).toBe("function");
  });

  test("missing topicKey fails closed", async () => {
    await expect(buildExecutionContractIntelligenceForTopic({ specKey: SPEC })).rejects.toMatchObject({
      code: "INVALID_TOPIC_KEY",
    });
  });

  test("returns bounded exact-topic shape", async () => {
    const readinessInput = {
      topicKey: CANONICAL,
      advisoryAction: "CONSIDER_FLASHCARD_REVISION",
      observedOutcome: "WEAK_AND_STABLE",
      minimumPermissionLevel: "L2",
      readinessClassification: "REQUIRES_L2_PREPARATION",
      blockingRequirements: STUDENT_IMPACTING_BLOCKERS,
    };
    buildActionReadinessIntelligence.mockResolvedValue(makeA08Report([readinessInput]));

    const report = await buildExecutionContractIntelligenceForTopic({
      specKey: SPEC,
      topicKey: CANONICAL,
      now: new Date(GENERATED_AT),
    });

    expect(buildActionReadinessIntelligence).toHaveBeenCalledWith({
      specKey: SPEC,
      topicKey: CANONICAL,
      now: new Date(GENERATED_AT),
    });
    expect(report.version).toBe(VERSION);
    expect(report.level).toBe("L0");
    expect(report.generatedAt).toBe(GENERATED_AT);
    expect(report.cohort).toEqual(COHORT);
    expect(Array.isArray(report.topicExecutionReadiness)).toBe(false);
    expect(report.topicExecutionReadiness.topicKey).toBe(CANONICAL);
    expect(report).not.toHaveProperty("summary");
    expect(report).not.toHaveProperty("policy");
  });

  test("exact row preserves A0.9 mapped evidence fields", async () => {
    const readinessInput = {
      topicKey: CANONICAL,
      advisoryAction: "CONSIDER_FLASHCARD_REVISION",
      observedOutcome: "WEAK_AND_STABLE",
      minimumPermissionLevel: "L2",
      readinessClassification: "REQUIRES_L2_PREPARATION",
      blockingRequirements: STUDENT_IMPACTING_BLOCKERS,
    };
    buildActionReadinessIntelligence.mockResolvedValue(makeA08Report([readinessInput]));

    const bulk = await buildExecutionContractIntelligence({
      specKey: SPEC,
      topicKey: CANONICAL,
      now: new Date(GENERATED_AT),
    });
    const exact = await buildExecutionContractIntelligenceForTopic({
      specKey: SPEC,
      topicKey: CANONICAL,
      now: new Date(GENERATED_AT),
    });

    expect(exact.topicExecutionReadiness).toEqual(bulk.topicExecutionReadiness[0]);
    expect(exact.topicExecutionReadiness.advisoryAction).toBe("CONSIDER_FLASHCARD_REVISION");
    expect(exact.topicExecutionReadiness.readinessClassification).toBe("REQUIRES_L2_PREPARATION");
    expect(exact.topicExecutionReadiness.minimumPermissionLevel).toBe("L2");
    expect(exact.topicExecutionReadiness.executionContract.auditReadiness).toBe("MISSING");
    expect(exact.topicExecutionReadiness.missingCapabilities.length).toBeGreaterThan(0);
  });

  test("INSUFFICIENT_EVIDENCE remains an observer result, not a thrown error", async () => {
    buildActionReadinessIntelligence.mockResolvedValue(
      makeA08Report([
        readinessRow({
          advisoryAction: "INSUFFICIENT_EVIDENCE",
          observedOutcome: null,
          readinessClassification: "NOT_AN_ACTION",
          minimumPermissionLevel: "L0",
          blockingRequirements: [],
        }),
      ])
    );

    const report = await buildExecutionContractIntelligenceForTopic({
      specKey: SPEC,
      topicKey: CANONICAL,
    });

    expect(report.topicExecutionReadiness.advisoryAction).toBe("INSUFFICIENT_EVIDENCE");
    expect(report.topicExecutionReadiness.executionContract.auditReadiness).toBe("NOT_APPLICABLE");
  });

  test("fails closed when pipeline returns zero rows", async () => {
    buildActionReadinessIntelligence.mockResolvedValue(makeA08Report([]));

    await expect(
      buildExecutionContractIntelligenceForTopic({ specKey: SPEC, topicKey: CANONICAL })
    ).rejects.toMatchObject({ code: "EXACT_TOPIC_EVIDENCE_MISSING" });
  });

  test("fails closed when pipeline returns multiple rows", async () => {
    buildActionReadinessIntelligence.mockResolvedValue(
      makeA08Report([
        readinessRow({ advisoryAction: "CONSIDER_RETEACH" }),
        readinessRow({ advisoryAction: "CONSIDER_MORE_PRACTICE" }),
      ])
    );

    await expect(
      buildExecutionContractIntelligenceForTopic({ specKey: SPEC, topicKey: CANONICAL })
    ).rejects.toMatchObject({ code: "EXACT_TOPIC_EVIDENCE_AMBIGUOUS" });
  });

  test("fails closed when pipeline returns a different topic row", async () => {
    buildActionReadinessIntelligence.mockResolvedValue(
      makeA08Report([
        {
          ...readinessRow({ advisoryAction: "CONSIDER_RETEACH" }),
          topicKey: `${SPEC}:cell-division`,
        },
      ])
    );

    await expect(
      buildExecutionContractIntelligenceForTopic({ specKey: SPEC, topicKey: CANONICAL })
    ).rejects.toMatchObject({ code: "EXACT_TOPIC_EVIDENCE_MISMATCH" });
  });

  test("alias topicKey request succeeds with canonical returned row", async () => {
    buildActionReadinessIntelligence.mockResolvedValue(
      makeA08Report([readinessRow({ advisoryAction: "CONSIDER_RETEACH" })])
    );

    const report = await buildExecutionContractIntelligenceForTopic({
      specKey: SPEC,
      topicKey: "cell-structure",
    });

    expect(report.topicExecutionReadiness.topicKey).toBe(CANONICAL);
  });

  test("does not integrate with proposal services", () => {
    expect(serviceSource).not.toMatch(/proposalService/);
    expect(serviceSource).not.toMatch(/AutopilotActionProposal/);
  });
});
