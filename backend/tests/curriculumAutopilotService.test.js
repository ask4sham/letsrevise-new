/**
 * Unit tests for Curriculum Autopilot service.
 */
const curriculumAutopilotService = require("../services/curriculumAutopilotService");

jest.mock("../services/curriculumGapDetectionService");
jest.mock("../services/autopilotGenerationAdapters");
jest.mock("../services/contentGraphService");
jest.mock("../services/contentCoverageService");

const curriculumGapDetectionService = require("../services/curriculumGapDetectionService");
const autopilotGenerationAdapters = require("../services/autopilotGenerationAdapters");
const contentGraphService = require("../services/contentGraphService");
const contentCoverageService = require("../services/contentCoverageService");

describe("curriculumAutopilotService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("decideAutopilotActions", () => {
    it("topic with weak flashcards plans generate_flashcards", () => {
      const gap = {
        counts: { flashcards: 2, quizzes: 5, examQuestions: 3, openIssues: 0 },
      };
      const { actions, requiresReview } = curriculumAutopilotService.decideAutopilotActions(gap);
      expect(actions).toContain("generate_flashcards");
      expect(requiresReview).toBe(false);
    });

    it("topic with no exam questions plans generate_exam_questions", () => {
      const gap = {
        counts: { flashcards: 5, quizzes: 3, examQuestions: 0, openIssues: 0 },
      };
      const { actions, requiresReview } = curriculumAutopilotService.decideAutopilotActions(gap);
      expect(actions).toContain("generate_exam_questions");
      expect(requiresReview).toBe(false);
    });

    it("high issue count skips generation and sets requiresReview", () => {
      const gap = {
        counts: { flashcards: 0, quizzes: 0, examQuestions: 0, openIssues: 5 },
      };
      const { actions, requiresReview } = curriculumAutopilotService.decideAutopilotActions(gap);
      expect(actions).toEqual([]);
      expect(requiresReview).toBe(true);
    });

    it("topic meeting all thresholds has no planned actions", () => {
      const gap = {
        counts: { flashcards: 5, quizzes: 3, examQuestions: 2, openIssues: 0 },
      };
      const { actions } = curriculumAutopilotService.decideAutopilotActions(gap);
      expect(actions).toEqual([]);
    });

    it("respects requested actions filter", () => {
      const gap = {
        counts: { flashcards: 0, quizzes: 0, examQuestions: 0, openIssues: 0 },
      };
      const { actions } = curriculumAutopilotService.decideAutopilotActions(gap, [
        "generate_flashcards",
      ]);
      expect(actions).toContain("generate_flashcards");
      expect(actions).not.toContain("generate_quiz");
    });
  });

  describe("runTopicAutopilot", () => {
    it("dryRun does not call adapters or refresh", async () => {
      curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
        topicKey: "cell-structure",
        topicTitle: "Cell structure",
        counts: { flashcards: 1, quizzes: 0, examQuestions: 0, openIssues: 0 },
        coverageScore: 30,
        coverageStatus: "weak",
        gapFlags: { lowFlashcards: true, lowQuizzes: true, lowExamQuestions: true, highIssueRate: false },
        priorityScore: 50,
      });

      const result = await curriculumAutopilotService.runTopicAutopilot({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        dryRun: true,
        adminUserId: "admin123",
      });

      expect(autopilotGenerationAdapters.generateFlashcardsForTopic).not.toHaveBeenCalled();
      expect(contentGraphService.linkFlashcardToTopic).not.toHaveBeenCalled();
      expect(result.dryRun).toBe(true);
      expect(result.plannedActions.length).toBeGreaterThan(0);
      expect(result.executedActions.some((a) => a.status === "planned")).toBe(true);
      expect(result.graphRebuilt).toBe(false);
    });

    it("high issue count skips generation", async () => {
      curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
        topicKey: "cell-structure",
        topicTitle: "Cell structure",
        counts: { flashcards: 0, quizzes: 0, examQuestions: 0, openIssues: 4 },
        gapFlags: { highIssueRate: true },
        priorityScore: 60,
      });

      const result = await curriculumAutopilotService.runTopicAutopilot({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        dryRun: false,
        adminUserId: "admin123",
      });

      expect(autopilotGenerationAdapters.generateFlashcardsForTopic).not.toHaveBeenCalled();
      expect(result.requiresReview).toBe(true);
      expect(result.executedActions[0]?.reason).toContain("high issue count");
    });

    it("graph refresh path is called after successful generation", async () => {
      curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
        topicKey: "cell-structure",
        topicTitle: "Cell structure",
        counts: { flashcards: 1, quizzes: 0, examQuestions: 0, openIssues: 0 },
        gapFlags: { lowFlashcards: true, lowQuizzes: true, lowExamQuestions: true, highIssueRate: false },
      });
      autopilotGenerationAdapters.generateFlashcardsForTopic.mockResolvedValue({
        status: "generated",
        createdCount: 3,
        ids: ["id1", "id2", "id3"],
      });
      autopilotGenerationAdapters.generateQuizForTopic.mockResolvedValue({
        status: "skipped",
        reason: "generation_not_available",
      });
      autopilotGenerationAdapters.generateExamQuestionsForTopic.mockResolvedValue({
        status: "skipped",
        reason: "generation_not_available",
      });
      contentGraphService.resolveTopicNode.mockResolvedValue({ _id: "node1" });
      contentGraphService.linkFlashcardToTopic.mockResolvedValue({});
      contentGraphService.linkQuizQuestionToTopic.mockResolvedValue({});
      contentGraphService.linkQuestionToTopic.mockResolvedValue({});
      contentCoverageService.getTopicCoverage.mockResolvedValue({
        coverageScore: 45,
        flashcardCount: 4,
        lessonCount: 1,
        quizCount: 0,
        examQuestionCount: 0,
      });

      const result = await curriculumAutopilotService.runTopicAutopilot({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        dryRun: false,
        adminUserId: "admin123",
      });

      expect(result.graphRebuilt).toBe(true);
      expect(result.updatedCoverage).not.toBeNull();
      expect(result.updatedCoverage.coverageScore).toBe(45);
    });

    it("returns error when topic not found", async () => {
      curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue(null);

      const result = await curriculumAutopilotService.runTopicAutopilot({
        specKey: "aqa-gcse-biology",
        topicKey: "nonexistent-topic",
        dryRun: false,
      });

      expect(result.error).toBe("Topic not found");
      expect(result.gapSummary).toBeNull();
    });

    it("uses selected prompt pack when provided", async () => {
      curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
        topicKey: "cell-structure",
        topicTitle: "Cell structure",
        counts: { flashcards: 1, quizzes: 0, examQuestions: 0, openIssues: 0 },
        gapFlags: { lowFlashcards: true, lowQuizzes: true, lowExamQuestions: true, highIssueRate: false },
      });
      autopilotGenerationAdapters.generateFlashcardsForTopic.mockResolvedValue({
        status: "generated",
        createdCount: 2,
        ids: ["id1", "id2"],
      });
      autopilotGenerationAdapters.generateQuizForTopic.mockResolvedValue({ status: "skipped", reason: "generation_not_available" });
      autopilotGenerationAdapters.generateExamQuestionsForTopic.mockResolvedValue({ status: "skipped", reason: "generation_not_available" });
      contentGraphService.resolveTopicNode.mockResolvedValue({ _id: "node1" });
      contentGraphService.linkFlashcardToTopic.mockResolvedValue({});
      contentCoverageService.getTopicCoverage.mockResolvedValue({ coverageScore: 40, flashcardCount: 3, lessonCount: 1, quizCount: 0, examQuestionCount: 0 });

      await curriculumAutopilotService.runTopicAutopilot({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        dryRun: false,
        adminUserId: "admin123",
        promptPackId: "autopilot-core",
        promptPackVersion: "v2",
      });

      expect(autopilotGenerationAdapters.generateFlashcardsForTopic).toHaveBeenCalledWith(
        expect.objectContaining({
          promptPack: expect.objectContaining({ promptPackId: "autopilot-core", promptPackVersion: "v2" }),
        })
      );
    });

    it("throws when invalid prompt pack provided", async () => {
      await expect(
        curriculumAutopilotService.runTopicAutopilot({
          specKey: "aqa-gcse-biology",
          topicKey: "cell-structure",
          dryRun: true,
          adminUserId: "admin123",
          promptPackId: "unknown-pack",
          promptPackVersion: "v1",
        })
      ).rejects.toThrow(/Unknown prompt pack/);
    });
  });

  describe("runSpecAutopilot", () => {
    it("ranking and limit behave correctly", async () => {
      const gaps = [
        { topicKey: "a", priorityScore: 80, gapFlags: { highIssueRate: false } },
        { topicKey: "b", priorityScore: 50, gapFlags: { highIssueRate: false } },
        { topicKey: "c", priorityScore: 30, gapFlags: { highIssueRate: false } },
      ];
      curriculumGapDetectionService.detectTopicGaps.mockResolvedValue(gaps);
      curriculumGapDetectionService.detectSingleTopicGap.mockImplementation(async (_, tk) => ({
        topicKey: tk,
        topicTitle: tk,
        counts: { flashcards: 0, quizzes: 0, examQuestions: 0, openIssues: 0 },
        gapFlags: { highIssueRate: false },
      }));

      const result = await curriculumAutopilotService.runSpecAutopilot({
        specKey: "aqa-gcse-biology",
        limit: 2,
        dryRun: true,
        minPriorityScore: 0,
        adminUserId: "admin123",
      });

      expect(result.totalProcessed).toBe(2);
      expect(result.results.map((r) => r.topicKey)).toEqual(["a", "b"]);
    });

    it("filters out high-issue topics", async () => {
      const gaps = [
        { topicKey: "a", priorityScore: 80, gapFlags: { highIssueRate: true } },
        { topicKey: "b", priorityScore: 50, gapFlags: { highIssueRate: false } },
      ];
      curriculumGapDetectionService.detectTopicGaps.mockResolvedValue(gaps);
      curriculumGapDetectionService.detectSingleTopicGap.mockImplementation(async (_, tk) => ({
        topicKey: tk,
        counts: { openIssues: tk === "a" ? 5 : 0 },
        gapFlags: { highIssueRate: tk === "a" },
      }));

      const result = await curriculumAutopilotService.runSpecAutopilot({
        specKey: "aqa-gcse-biology",
        limit: 10,
        dryRun: false,
        adminUserId: "admin123",
      });

      expect(result.totalProcessed).toBe(1);
      expect(result.results[0].topicKey).toBe("b");
    });

    it("uses selected prompt pack when provided", async () => {
      const gaps = [
        { topicKey: "a", priorityScore: 80, gapFlags: { highIssueRate: false } },
      ];
      curriculumGapDetectionService.detectTopicGaps.mockResolvedValue(gaps);
      curriculumGapDetectionService.detectSingleTopicGap.mockImplementation(async (_, tk) => ({
        topicKey: tk,
        topicTitle: tk,
        counts: { flashcards: 0, quizzes: 0, examQuestions: 0, openIssues: 0 },
        gapFlags: { highIssueRate: false },
      }));

      const result = await curriculumAutopilotService.runSpecAutopilot({
        specKey: "aqa-gcse-biology",
        limit: 5,
        dryRun: true,
        adminUserId: "admin123",
        promptPackId: "autopilot-core",
        promptPackVersion: "v2",
      });

      expect(result.totalProcessed).toBe(1);
      expect(result.results[0].topicKey).toBe("a");
    });

    it("throws when invalid prompt pack provided", async () => {
      curriculumGapDetectionService.detectTopicGaps.mockResolvedValue([]);

      await expect(
        curriculumAutopilotService.runSpecAutopilot({
          specKey: "aqa-gcse-biology",
          limit: 5,
          dryRun: true,
          adminUserId: "admin123",
          promptPackId: "bad-pack",
          promptPackVersion: "v1",
        })
      ).rejects.toThrow(/Unknown prompt pack/);
    });
  });
});
