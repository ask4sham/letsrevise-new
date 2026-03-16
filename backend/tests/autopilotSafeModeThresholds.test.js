/**
 * Tests for Autopilot Safe Mode minimum evidence thresholds.
 */
const curriculumAutopilotService = require("../services/curriculumAutopilotService");

jest.mock("../services/curriculumGapDetectionService");
jest.mock("../services/contentCoverageService");
jest.mock("../services/contentGraphService");
jest.mock("../services/autopilotGenerationAdapters");
jest.mock("../services/autopilotGatingService");
jest.mock("../services/topicEvidenceService");
jest.mock("../services/studentTopicEvidenceService");
jest.mock("../services/autopilotFeedbackService");
jest.mock("../services/autopilotPromptMetadata");
jest.mock("../models/AutopilotRun");
jest.mock("../models/Lesson");
jest.mock("../models/TopicFlashcard");
jest.mock("../models/TopicQuizQuestion");
jest.mock("../models/ExamQuestion");

const autopilotGatingService = require("../services/autopilotGatingService");
const topicEvidenceService = require("../services/topicEvidenceService");
const studentTopicEvidenceService = require("../services/studentTopicEvidenceService");
const autopilotFeedbackService = require("../services/autopilotFeedbackService");

const gateAllow = { gateStatus: "allow", reasons: [] };
const evidenceStrong = {
  derivedMetrics: { evidenceHealth: "strong", approvalRate: 90 },
  evidenceCounts: {
    lessonIssues: 0,
    autopilotRuns: 5,
    autopilotApprovals: 15,
    autopilotRejections: 2,
  },
};
const learningGood = {
  derivedMetrics: { masteryScore: 75, difficultyLevel: "moderate" },
  quizStats: { attempts: 25 },
};
const feedbackPack = {
  promptPacks: [{ promptPackId: "core", promptPackVersion: "v1", approvalRate: 85 }],
};

function mockAllPassing(overrides = {}) {
  topicEvidenceService.getTopicEvidence.mockResolvedValue({
    ...evidenceStrong,
    ...overrides.evidence,
  });
  studentTopicEvidenceService.getTopicLearningEvidence.mockResolvedValue({
    ...learningGood,
    ...overrides.learning,
  });
  autopilotFeedbackService.getFeedbackByPromptPack.mockResolvedValue(
    overrides.feedback ?? feedbackPack
  );
}

describe("Autopilot Safe Mode thresholds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    autopilotGatingService.getAutopilotGate.mockResolvedValue(gateAllow);
  });

  it("Safe Mode disabled when autopilotRuns < 3", async () => {
    mockAllPassing({
      evidence: {
        evidenceCounts: {
          ...evidenceStrong.evidenceCounts,
          autopilotRuns: 2,
        },
      },
    });
    const result = await curriculumAutopilotService.computeSafeMode(
      "aqa-gcse-biology",
      "cell-structure",
      gateAllow,
      "core",
      "v1"
    );
    expect(result.safeModeActivated).toBe(false);
    expect(result.evidenceSample.autopilotRuns).toBe(2);
  });

  it("Safe Mode disabled when reviewedItems < 10", async () => {
    mockAllPassing({
      evidence: {
        evidenceCounts: {
          ...evidenceStrong.evidenceCounts,
          autopilotRuns: 5,
          autopilotApprovals: 5,
          autopilotRejections: 2,
        },
      },
    });
    const result = await curriculumAutopilotService.computeSafeMode(
      "aqa-gcse-biology",
      "cell-structure",
      gateAllow,
      "core",
      "v1"
    );
    expect(result.safeModeActivated).toBe(false);
    expect(result.evidenceSample.reviewedItems).toBe(7);
  });

  it("Safe Mode disabled when quizAttempts < 20", async () => {
    mockAllPassing({
      learning: {
        ...learningGood,
        quizStats: { attempts: 15 },
      },
    });
    const result = await curriculumAutopilotService.computeSafeMode(
      "aqa-gcse-biology",
      "cell-structure",
      gateAllow,
      "core",
      "v1"
    );
    expect(result.safeModeActivated).toBe(false);
    expect(result.evidenceSample.quizAttempts).toBe(15);
  });

  it("Safe Mode enabled when all thresholds are met", async () => {
    mockAllPassing();
    const result = await curriculumAutopilotService.computeSafeMode(
      "aqa-gcse-biology",
      "cell-structure",
      gateAllow,
      "core",
      "v1"
    );
    expect(result.safeModeActivated).toBe(true);
    expect(result.evidenceSample).toEqual({
      autopilotRuns: 5,
      reviewedItems: 17,
      quizAttempts: 25,
    });
  });

  it("Safe Mode remains disabled when evidenceHealth !== strong", async () => {
    mockAllPassing({
      evidence: {
        ...evidenceStrong,
        derivedMetrics: { ...evidenceStrong.derivedMetrics, evidenceHealth: "mixed" },
      },
    });
    const result = await curriculumAutopilotService.computeSafeMode(
      "aqa-gcse-biology",
      "cell-structure",
      gateAllow,
      "core",
      "v1"
    );
    expect(result.safeModeActivated).toBe(false);
  });

  it("Safe Mode disabled when approvalRate < 85", async () => {
    mockAllPassing({
      evidence: {
        ...evidenceStrong,
        derivedMetrics: { ...evidenceStrong.derivedMetrics, approvalRate: 80 },
      },
    });
    const result = await curriculumAutopilotService.computeSafeMode(
      "aqa-gcse-biology",
      "cell-structure",
      gateAllow,
      "core",
      "v1"
    );
    expect(result.safeModeActivated).toBe(false);
  });

  it("Safe Mode disabled when openIssues is undefined (defensive default)", async () => {
    mockAllPassing({
      evidence: {
        ...evidenceStrong,
        evidenceCounts: {
          ...evidenceStrong.evidenceCounts,
          lessonIssues: undefined,
        },
      },
    });
    const result = await curriculumAutopilotService.computeSafeMode(
      "aqa-gcse-biology",
      "cell-structure",
      gateAllow,
      "core",
      "v1"
    );
    expect(result.safeModeActivated).toBe(false);
  });
});
