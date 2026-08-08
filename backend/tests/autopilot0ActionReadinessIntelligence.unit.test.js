/**
 * Autopilot 0 Safe Action Readiness Observer V1 — unit tests.
 */
const fs = require("fs");
const path = require("path");

const SERVICE_PATH = path.join(
  __dirname,
  "..",
  "services",
  "autopilot0",
  "actionReadinessIntelligenceService.js"
);
const serviceSource = fs.readFileSync(SERVICE_PATH, "utf8");

jest.mock("../services/autopilot0/groundedNextActionIntelligenceService", () => ({
  buildGroundedNextActionIntelligence: jest.fn(),
  DB_OPERATION_COUNT: 10,
}));

const {
  VERSION,
  LEVEL,
  DB_OPERATION_COUNT,
  ADVISORY_READINESS_POLICY,
  L4_POLICY_CLASSES,
  STUDENT_IMPACTING_BLOCKERS,
  classifyAdvisoryReadiness,
  mapTopicReadinessRow,
  computeReadinessSummary,
  buildActionReadinessIntelligence,
} = require("../services/autopilot0/actionReadinessIntelligenceService");
const { buildGroundedNextActionIntelligence } = require("../services/autopilot0/groundedNextActionIntelligenceService");

const SPEC = "aqa-gcse-biology";
const CANONICAL = `${SPEC}:cell-structure`;
const GENERATED_AT = "2026-06-01T12:00:00.000Z";

const COHORT = {
  specKey: SPEC,
  cohortScope: "SPEC_ONLY",
  tierSupported: false,
  tier: null,
};

function makeA07Report(topicAdvisories) {
  return {
    version: "autopilot0-grounded-next-action-intelligence-v1",
    level: "L0",
    generatedAt: GENERATED_AT,
    cohort: COHORT,
    topicAdvisories,
    summary: { overallStatus: "UNKNOWN", humanReviewRequired: true },
  };
}

function advisoryRow(advisoryAction, observedOutcome = "WEAK_AND_STABLE") {
  return {
    topicKey: CANONICAL,
    observedOutcome,
    questionReviewRecommended: advisoryAction === "CONSIDER_QUESTION_REVIEW",
    advisoryAction,
    contentAvailability: {
      lesson: true,
      quizPractice: true,
      examPractice: true,
      flashcards: true,
    },
  };
}

describe("actionReadinessIntelligenceService contract", () => {
  test("version, level, and DB op count delegated to A0.7", () => {
    expect(VERSION).toBe("autopilot0-action-readiness-intelligence-v1");
    expect(LEVEL).toBe("L0");
    expect(DB_OPERATION_COUNT).toBe(10);
  });

  test("service wraps A0.7 only — no independent intelligence builders or models", () => {
    expect(serviceSource).toMatch(/buildGroundedNextActionIntelligence/);
    expect(serviceSource).not.toMatch(/buildRevisionIntelligence\(/);
    expect(serviceSource).not.toMatch(/buildQuestionIntelligence\(/);
    expect(serviceSource).not.toMatch(/buildLearningTrendIntelligence\(/);
    expect(serviceSource).not.toMatch(/buildRevisionOutcomeIntelligence\(/);
    expect(serviceSource).not.toMatch(/require\("\.\.\/\.\.\/models\//);
  });

  test("L4 policy classes exist in metadata only", () => {
    expect(L4_POLICY_CLASSES.length).toBeGreaterThan(0);
    expect(L4_POLICY_CLASSES).toContain("AUTOMATIC_CURRICULUM_PUBLISHING");
    for (const advisory of Object.keys(ADVISORY_READINESS_POLICY)) {
      expect(classifyAdvisoryReadiness(advisory).readinessClassification).not.toBe("NEVER_AUTOMATIC");
    }
  });
});

describe("classifyAdvisoryReadiness — locked policy map", () => {
  test("CONTINUE_CURRENT_PATH → L0 / NOT_AN_ACTION", () => {
    const result = classifyAdvisoryReadiness("CONTINUE_CURRENT_PATH");
    expect(result.minimumPermissionLevel).toBe("L0");
    expect(result.readinessClassification).toBe("NOT_AN_ACTION");
    expect(result.blockingRequirements).toEqual([]);
  });

  test("NO_FURTHER_WEAKNESS_OBSERVED → L0 / NOT_AN_ACTION", () => {
    const result = classifyAdvisoryReadiness("NO_FURTHER_WEAKNESS_OBSERVED");
    expect(result.minimumPermissionLevel).toBe("L0");
    expect(result.readinessClassification).toBe("NOT_AN_ACTION");
    expect(result.blockingRequirements).toEqual([]);
  });

  test("INSUFFICIENT_EVIDENCE → L0 / NOT_AN_ACTION", () => {
    const result = classifyAdvisoryReadiness("INSUFFICIENT_EVIDENCE");
    expect(result.minimumPermissionLevel).toBe("L0");
    expect(result.readinessClassification).toBe("NOT_AN_ACTION");
    expect(result.blockingRequirements).toEqual([]);
  });

  test("CONSIDER_RETEACH → L2 / REQUIRES_L2_PREPARATION", () => {
    const result = classifyAdvisoryReadiness("CONSIDER_RETEACH");
    expect(result.minimumPermissionLevel).toBe("L2");
    expect(result.readinessClassification).toBe("REQUIRES_L2_PREPARATION");
    expect(result.blockingRequirements).toEqual([...STUDENT_IMPACTING_BLOCKERS]);
  });

  test("CONSIDER_MORE_PRACTICE → L2 / REQUIRES_L2_PREPARATION", () => {
    const result = classifyAdvisoryReadiness("CONSIDER_MORE_PRACTICE");
    expect(result.minimumPermissionLevel).toBe("L2");
    expect(result.readinessClassification).toBe("REQUIRES_L2_PREPARATION");
    expect(result.blockingRequirements).toEqual([...STUDENT_IMPACTING_BLOCKERS]);
  });

  test("CONSIDER_EXAM_PRACTICE → L2 with ASSESSMENT_ADJACENT blocker", () => {
    const result = classifyAdvisoryReadiness("CONSIDER_EXAM_PRACTICE");
    expect(result.minimumPermissionLevel).toBe("L2");
    expect(result.readinessClassification).toBe("REQUIRES_L2_PREPARATION");
    expect(result.blockingRequirements).toEqual([
      ...STUDENT_IMPACTING_BLOCKERS,
      "ASSESSMENT_ADJACENT",
    ]);
  });

  test("CONSIDER_FLASHCARD_REVISION → L2 / REQUIRES_L2_PREPARATION", () => {
    const result = classifyAdvisoryReadiness("CONSIDER_FLASHCARD_REVISION");
    expect(result.minimumPermissionLevel).toBe("L2");
    expect(result.readinessClassification).toBe("REQUIRES_L2_PREPARATION");
    expect(result.blockingRequirements).toEqual([...STUDENT_IMPACTING_BLOCKERS]);
  });

  test("CONSIDER_QUESTION_REVIEW → L3 / REQUIRES_HUMAN_APPROVAL", () => {
    const result = classifyAdvisoryReadiness("CONSIDER_QUESTION_REVIEW");
    expect(result.minimumPermissionLevel).toBe("L3");
    expect(result.readinessClassification).toBe("REQUIRES_HUMAN_APPROVAL");
    expect(result.blockingRequirements).toEqual([
      "CONTENT_MUTATION_RISK",
      "ASSESSMENT_SEMANTICS_RISK",
      "HUMAN_REVIEW_REQUIRED",
    ]);
  });

  test("no current advisory maps to L1", () => {
    for (const advisory of Object.keys(ADVISORY_READINESS_POLICY)) {
      expect(classifyAdvisoryReadiness(advisory).minimumPermissionLevel).not.toBe("L1");
    }
  });

  test("no current advisory maps to SAFE_L1_CANDIDATE", () => {
    for (const advisory of Object.keys(ADVISORY_READINESS_POLICY)) {
      expect(classifyAdvisoryReadiness(advisory).readinessClassification).not.toBe("SAFE_L1_CANDIDATE");
    }
  });

  test("unknown advisory throws contract failure", () => {
    expect(() => classifyAdvisoryReadiness("AUTO_ASSIGN_EVERYONE")).toThrow(/Unknown advisory action/);
    try {
      classifyAdvisoryReadiness("AUTO_ASSIGN_EVERYONE");
    } catch (err) {
      expect(err.code).toBe("UNKNOWN_ADVISORY_ACTION");
    }
  });

  test("blockers are deterministic copies", () => {
    const first = classifyAdvisoryReadiness("CONSIDER_MORE_PRACTICE");
    first.blockingRequirements.push("MUTATED");
    const second = classifyAdvisoryReadiness("CONSIDER_MORE_PRACTICE");
    expect(second.blockingRequirements).not.toContain("MUTATED");
  });
});

describe("computeReadinessSummary", () => {
  test("empty rows → UNKNOWN, l1EligibleCount 0", () => {
    expect(computeReadinessSummary([])).toEqual({
      overallStatus: "UNKNOWN",
      humanReviewRequired: true,
      l1EligibleCount: 0,
    });
  });

  test("GREEN when all rows are continue or no-further-weakness", () => {
    const rows = [
      mapTopicReadinessRow(advisoryRow("CONTINUE_CURRENT_PATH", "WEAK_AND_IMPROVING")),
      mapTopicReadinessRow({
        ...advisoryRow("NO_FURTHER_WEAKNESS_OBSERVED", "NO_LONGER_WEAK"),
        topicKey: `${SPEC}:osmosis`,
      }),
    ];
    expect(computeReadinessSummary(rows)).toEqual({
      overallStatus: "GREEN",
      humanReviewRequired: false,
      l1EligibleCount: 0,
    });
  });

  test("AMBER when any row requires L2 preparation", () => {
    const rows = [mapTopicReadinessRow(advisoryRow("CONSIDER_MORE_PRACTICE"))];
    expect(computeReadinessSummary(rows).overallStatus).toBe("AMBER");
    expect(computeReadinessSummary(rows).humanReviewRequired).toBe(true);
    expect(computeReadinessSummary(rows).l1EligibleCount).toBe(0);
  });

  test("AMBER when any row requires human approval", () => {
    const rows = [mapTopicReadinessRow(advisoryRow("CONSIDER_QUESTION_REVIEW"))];
    expect(computeReadinessSummary(rows).overallStatus).toBe("AMBER");
    expect(computeReadinessSummary(rows).l1EligibleCount).toBe(0);
  });

  test("UNKNOWN when only insufficient-evidence rows", () => {
    const rows = [mapTopicReadinessRow(advisoryRow("INSUFFICIENT_EVIDENCE", null))];
    expect(computeReadinessSummary(rows)).toEqual({
      overallStatus: "UNKNOWN",
      humanReviewRequired: true,
      l1EligibleCount: 0,
    });
  });

  test("UNKNOWN for mixed non-amber non-green rows", () => {
    const rows = [
      mapTopicReadinessRow(advisoryRow("CONTINUE_CURRENT_PATH", "WEAK_AND_IMPROVING")),
      mapTopicReadinessRow(advisoryRow("INSUFFICIENT_EVIDENCE", null)),
    ];
    expect(computeReadinessSummary(rows).overallStatus).toBe("UNKNOWN");
    expect(computeReadinessSummary(rows).l1EligibleCount).toBe(0);
  });

  test("l1EligibleCount always 0 for all fixtures", () => {
    const fixtures = [
      [],
      [mapTopicReadinessRow(advisoryRow("CONTINUE_CURRENT_PATH"))],
      [mapTopicReadinessRow(advisoryRow("CONSIDER_RETEACH"))],
      [mapTopicReadinessRow(advisoryRow("CONSIDER_QUESTION_REVIEW"))],
      [mapTopicReadinessRow(advisoryRow("INSUFFICIENT_EVIDENCE", null))],
    ];
    for (const rows of fixtures) {
      expect(computeReadinessSummary(rows).l1EligibleCount).toBe(0);
    }
  });
});

describe("buildActionReadinessIntelligence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("delegates to A0.7 with same opts and adds zero DB calls", async () => {
    buildGroundedNextActionIntelligence.mockResolvedValue(makeA07Report([]));

    const report = await buildActionReadinessIntelligence({ specKey: SPEC, limit: 15 });

    expect(buildGroundedNextActionIntelligence).toHaveBeenCalledTimes(1);
    expect(buildGroundedNextActionIntelligence).toHaveBeenCalledWith({ specKey: SPEC, limit: 15 });
    expect(report.version).toBe(VERSION);
    expect(report.level).toBe("L0");
    expect(report.generatedAt).toBe(GENERATED_AT);
    expect(report.cohort).toEqual(COHORT);
    expect(report.topicReadiness).toEqual([]);
    expect(report.policy).toEqual({
      currentAutopilotLevel: "L0",
      l1ExecutionEnabled: false,
      l4Classes: [...L4_POLICY_CLASSES],
    });
    expect(report.summary.l1EligibleCount).toBe(0);
  });

  test("preserves A0.7 topic-level rows without student identifiers", async () => {
    buildGroundedNextActionIntelligence.mockResolvedValue(
      makeA07Report([
        advisoryRow("CONSIDER_MORE_PRACTICE"),
        {
          ...advisoryRow("CONSIDER_QUESTION_REVIEW"),
          topicKey: `${SPEC}:enzymes`,
        },
      ])
    );

    const report = await buildActionReadinessIntelligence({ specKey: SPEC });
    const serialized = JSON.stringify(report);

    expect(report.topicReadiness).toHaveLength(2);
    expect(report.topicReadiness[0]).toMatchObject({
      topicKey: CANONICAL,
      advisoryAction: "CONSIDER_MORE_PRACTICE",
      minimumPermissionLevel: "L2",
      readinessClassification: "REQUIRES_L2_PREPARATION",
    });
    expect(report.topicReadiness[1].minimumPermissionLevel).toBe("L3");
    expect(serialized).not.toMatch(/userId|studentId|email/i);
    expect(report.summary.overallStatus).toBe("AMBER");
    expect(report.summary.l1EligibleCount).toBe(0);
  });

  test("propagates INVALID_SPEC_KEY from A0.7", async () => {
    buildGroundedNextActionIntelligence.mockRejectedValue(
      Object.assign(new Error("Unknown specKey: bad"), { code: "INVALID_SPEC_KEY" })
    );
    await expect(buildActionReadinessIntelligence({ specKey: "bad" })).rejects.toMatchObject({
      code: "INVALID_SPEC_KEY",
    });
  });
});
