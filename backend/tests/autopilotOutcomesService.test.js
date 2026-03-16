/**
 * Tests for Autopilot Outcomes service.
 */
const autopilotOutcomesService = require("../services/autopilotOutcomesService");
const AutopilotRun = require("../models/AutopilotRun");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");

jest.mock("../models/AutopilotRun");
jest.mock("../models/TopicFlashcard");
jest.mock("../models/TopicQuizQuestion");
jest.mock("../models/ExamQuestion");

describe("autopilotOutcomesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockFindChain(runs) {
    return {
      select: () => mockFindChain(runs),
      sort: () => ({ lean: () => Promise.resolve(runs) }),
    };
  }

  describe("getAutopilotOutcomeSummary", () => {
    it("totals aggregate correctly from run logs", async () => {
      const runs = [
        { dryRun: false, status: "completed", summary: { generatedFlashcards: 3, generatedQuizzes: 2, generatedExamQuestions: 1 } },
        { dryRun: true, status: "completed", summary: {} },
        { dryRun: false, status: "failed", summary: {} },
      ];
      AutopilotRun.find.mockReturnValue(mockFindChain(runs));
      TopicFlashcard.countDocuments.mockResolvedValue(0);
      TopicQuizQuestion.countDocuments.mockResolvedValue(0);
      ExamQuestion.countDocuments.mockResolvedValue(0);

      const result = await autopilotOutcomesService.getAutopilotOutcomeSummary({ days: 30 });

      expect(result.totals.runs).toBe(3);
      expect(result.totals.dryRuns).toBe(1);
      expect(result.totals.liveRuns).toBe(2);
      expect(result.totals.completedRuns).toBe(2);
      expect(result.totals.failedRuns).toBe(1);
      expect(result.totals.generatedFlashcards).toBe(3);
      expect(result.totals.generatedQuizzes).toBe(2);
      expect(result.totals.generatedExamQuestions).toBe(1);
    });

    it("approved/rejected counts only include autopilot-generated items", async () => {
      AutopilotRun.find.mockReturnValue(mockFindChain([]));
      TopicFlashcard.countDocuments.mockResolvedValue(0);
      TopicQuizQuestion.countDocuments.mockResolvedValue(0);
      ExamQuestion.countDocuments.mockResolvedValue(0);

      await autopilotOutcomesService.getAutopilotOutcomeSummary({ days: 7 });

      const fcCalls = TopicFlashcard.countDocuments.mock.calls;
      expect(fcCalls.length).toBeGreaterThan(0);
      expect(fcCalls[0][0]["metadata.generatedBy"]).toBe("autopilot");
    });
  });

  describe("getRepeatedAutopilotFailures", () => {
    it("aggregates correctly", async () => {
      AutopilotRun.find.mockReturnValue(
        mockFindChain([
          {
            specKey: "aqa-gcse-biology",
            topicKey: "cell-structure",
            topicResults: [
              {
                topicKey: "cell-structure",
                topicTitle: "Cell structure",
                executedActions: [
                  { type: "generate_flashcards", status: "failed", reason: "generation_not_available" },
                  { type: "generate_quiz", status: "skipped", reason: "dry_run" },
                ],
              },
            ],
          },
        ])
      );

      const result = await autopilotOutcomesService.getRepeatedAutopilotFailures({ days: 30 });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].specKey).toBe("aqa-gcse-biology");
      expect(result[0].topicKey).toBe("cell-structure");
      expect(result[0].failCount).toBe(1);
      expect(result[0].skipCount).toBe(1);
      expect(result[0].latestReason).toBe("generation_not_available");
    });
  });

  describe("getCoverageLiftSummary", () => {
    it("prefers true coverageLift when available", async () => {
      AutopilotRun.find.mockReturnValue(
        mockFindChain([
          {
            specKey: "aqa-gcse-biology",
            topicKey: "cell-structure",
            topicResults: [
              {
                topicKey: "cell-structure",
                topicTitle: "Cell structure",
                coverageBefore: { score: 40 },
                coverageAfter: { score: 90 },
                coverageLift: 50,
                updatedCoverage: { score: 90, status: "strong" },
              },
            ],
          },
        ])
      );

      const result = await autopilotOutcomesService.getCoverageLiftSummary({ days: 30 });

      expect(result.length).toBe(1);
      expect(result[0].specKey).toBe("aqa-gcse-biology");
      expect(result[0].topicKey).toBe("cell-structure");
      expect(result[0].latestCoverageScore).toBe(90);
      expect(result[0].liftType).toBe("true");
      expect(result[0].trueCoverageLift).toBe(50);
      expect(result[0].estimatedCoverageLift).toBeUndefined();
    });

    it("falls back to estimated lift for legacy runs", async () => {
      AutopilotRun.find.mockReturnValue(
        mockFindChain([
          {
            specKey: "aqa-gcse-biology",
            topicKey: "cell-structure",
            topicResults: [
              {
                topicKey: "cell-structure",
                topicTitle: "Cell structure",
                updatedCoverage: { score: 70, status: "strong" },
              },
            ],
          },
        ])
      );

      const result = await autopilotOutcomesService.getCoverageLiftSummary({ days: 30 });

      expect(result.length).toBe(1);
      expect(result[0].specKey).toBe("aqa-gcse-biology");
      expect(result[0].topicKey).toBe("cell-structure");
      expect(result[0].latestCoverageScore).toBe(70);
      expect(result[0].liftType).toBe("estimated");
      expect(result[0].trueCoverageLift).toBeUndefined();
      expect(result[0].estimatedCoverageLift).toBe(70);
    });

    it("returns deterministic output", async () => {
      AutopilotRun.find.mockReturnValue(
        mockFindChain([
          {
            specKey: "aqa-gcse-biology",
            topicKey: "cell-structure",
            topicResults: [
              {
                topicKey: "cell-structure",
                topicTitle: "Cell structure",
                updatedCoverage: { score: 70, status: "strong" },
              },
            ],
          },
        ])
      );

      const result = await autopilotOutcomesService.getCoverageLiftSummary({ days: 30 });

      expect(result.length).toBe(1);
      expect(result[0].specKey).toBe("aqa-gcse-biology");
      expect(result[0].topicKey).toBe("cell-structure");
      expect(result[0].latestCoverageScore).toBe(70);
    });
  });

  describe("getOutcomesByPromptPack", () => {
    it("aggregates runs by prompt pack", async () => {
      AutopilotRun.find.mockReturnValue(
        mockFindChain([
          {
            specKey: "aqa-gcse-biology",
            topicKey: null,
            dryRun: false,
            summary: { generatedFlashcards: 3, generatedQuizzes: 2, generatedExamQuestions: 1 },
            topicResults: [{ coverageLift: 10 }],
            promptPackId: "autopilot-core",
            promptPackVersion: "v1",
          },
          {
            specKey: "aqa-gcse-biology",
            topicKey: null,
            dryRun: false,
            summary: { generatedFlashcards: 2, generatedQuizzes: 1, generatedExamQuestions: 0 },
            topicResults: [{ coverageLift: 5 }],
            promptPackId: "autopilot-core",
            promptPackVersion: "v1",
          },
        ])
      );

      const result = await autopilotOutcomesService.getOutcomesByPromptPack({ days: 30 });

      expect(result.promptPacks).toBeDefined();
      expect(result.promptPacks.length).toBe(1);
      expect(result.promptPacks[0].promptPackId).toBe("autopilot-core");
      expect(result.promptPacks[0].promptPackVersion).toBe("v1");
      expect(result.promptPacks[0].runs).toBe(2);
      expect(result.promptPacks[0].liveRuns).toBe(2);
      expect(result.promptPacks[0].generatedFlashcards).toBe(5);
      expect(result.promptPacks[0].avgCoverageLift).toBe(7.5);
    });

    it("legacy runs without prompt pack are grouped as unknown", async () => {
      AutopilotRun.find.mockReturnValue(
        mockFindChain([
          {
            specKey: "aqa-gcse-biology",
            dryRun: true,
            summary: {},
            topicResults: [],
            promptPackId: null,
            promptPackVersion: null,
          },
        ])
      );

      const result = await autopilotOutcomesService.getOutcomesByPromptPack({ days: 30 });

      expect(result.promptPacks.length).toBe(1);
      expect(result.promptPacks[0].promptPackId).toBe("unknown");
      expect(result.promptPacks[0].promptPackVersion).toBe("unknown");
    });
  });
});
