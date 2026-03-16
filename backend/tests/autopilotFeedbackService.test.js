/**
 * Tests for Autopilot Feedback service.
 */
const autopilotFeedbackService = require("../services/autopilotFeedbackService");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");

jest.mock("../models/TopicFlashcard");
jest.mock("../models/TopicQuizQuestion");
jest.mock("../models/ExamQuestion");

function mockFindChain(docs = []) {
  return {
    select: () => ({ lean: () => Promise.resolve(docs) }),
  };
}

describe("autopilotFeedbackService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TopicFlashcard.find.mockReturnValue(mockFindChain([]));
    TopicQuizQuestion.find.mockReturnValue(mockFindChain([]));
    ExamQuestion.find.mockReturnValue(mockFindChain([]));
    TopicFlashcard.aggregate.mockResolvedValue([]);
    TopicQuizQuestion.aggregate.mockResolvedValue([]);
    ExamQuestion.aggregate.mockResolvedValue([]);
  });

  describe("normalizeRejectionReason", () => {
    it("maps accuracy-related reasons to missing_accuracy", () => {
      expect(autopilotFeedbackService.normalizeRejectionReason("Incorrect answer")).toBe("missing_accuracy");
      expect(autopilotFeedbackService.normalizeRejectionReason("Wrong fact")).toBe("missing_accuracy");
    });
    it("maps explanation-related to weak_explanation", () => {
      expect(autopilotFeedbackService.normalizeRejectionReason("Poor explanation")).toBe("weak_explanation");
    });
    it("maps duplicate to duplicate_content", () => {
      expect(autopilotFeedbackService.normalizeRejectionReason("Duplicate of existing")).toBe("duplicate_content");
    });
    it("maps exam/spec alignment to poor_exam_alignment", () => {
      expect(autopilotFeedbackService.normalizeRejectionReason("Not aligned to spec")).toBe("poor_exam_alignment");
    });
    it("maps unclear to unclear_question", () => {
      expect(autopilotFeedbackService.normalizeRejectionReason("Ambiguous question")).toBe("unclear_question");
    });
    it("returns other for unknown", () => {
      expect(autopilotFeedbackService.normalizeRejectionReason("Random reason")).toBe("other");
      expect(autopilotFeedbackService.normalizeRejectionReason(null)).toBe("other");
      expect(autopilotFeedbackService.normalizeRejectionReason("")).toBe("other");
    });
  });

  describe("getAutopilotFeedbackSummary", () => {
    it("approval/rejection totals aggregate correctly", async () => {
      TopicFlashcard.countDocuments.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
      TopicQuizQuestion.countDocuments.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
      ExamQuestion.countDocuments.mockResolvedValueOnce(4).mockResolvedValueOnce(0);

      const result = await autopilotFeedbackService.getAutopilotFeedbackSummary({ days: 30 });

      expect(result.totals.reviewedItems).toBe(15);
      expect(result.totals.approvedItems).toBe(12);
      expect(result.totals.rejectedItems).toBe(3);
      expect(result.totals.approvalRate).toBe(80);
    });

    it("only autopilot-generated items are included", async () => {
      TopicFlashcard.countDocuments.mockResolvedValue(0);
      TopicQuizQuestion.countDocuments.mockResolvedValue(0);
      ExamQuestion.countDocuments.mockResolvedValue(0);
      TopicFlashcard.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });
      TopicQuizQuestion.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });
      ExamQuestion.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });
      TopicFlashcard.aggregate.mockResolvedValue([]);
      TopicQuizQuestion.aggregate.mockResolvedValue([]);
      ExamQuestion.aggregate.mockResolvedValue([]);

      await autopilotFeedbackService.getAutopilotFeedbackSummary({ days: 7 });

      const fcCalls = TopicFlashcard.countDocuments.mock.calls;
      expect(fcCalls.length).toBeGreaterThan(0);
      expect(fcCalls[0][0]["metadata.generatedBy"]).toBe("autopilot");
    });

    it("rejection reason normalization works", async () => {
      TopicFlashcard.countDocuments.mockResolvedValue(0);
      TopicQuizQuestion.countDocuments.mockResolvedValue(0);
      ExamQuestion.countDocuments.mockResolvedValue(0);
      TopicFlashcard.find.mockReturnValue(
        mockFindChain([
          { metadata: { reviewReason: "Incorrect answer" } },
          { metadata: { reviewReason: "Duplicate content" } },
        ])
      );

      const result = await autopilotFeedbackService.getAutopilotFeedbackSummary({ days: 30 });

      expect(result.rejectionPatterns).toBeDefined();
      const accuracy = result.rejectionPatterns.find((p) => p.reason === "missing_accuracy");
      const dup = result.rejectionPatterns.find((p) => p.reason === "duplicate_content");
      expect(accuracy?.count).toBe(1);
      expect(dup?.count).toBe(1);
    });

    it("getFeedbackByPromptPack aggregates by prompt pack correctly", async () => {
      TopicFlashcard.aggregate.mockResolvedValue([
        { _id: { id: "autopilot-core", version: "v1" }, approved: 5, rejected: 1 },
      ]);
      TopicQuizQuestion.aggregate.mockResolvedValue([
        { _id: { id: "autopilot-core", version: "v1" }, approved: 3, rejected: 0 },
      ]);
      ExamQuestion.aggregate.mockResolvedValue([]);

      const result = await autopilotFeedbackService.getFeedbackByPromptPack({ days: 30 });

      expect(result.promptPacks).toBeDefined();
      expect(result.promptPacks.length).toBe(1);
      expect(result.promptPacks[0].promptPackId).toBe("autopilot-core");
      expect(result.promptPacks[0].promptPackVersion).toBe("v1");
      expect(result.promptPacks[0].reviewedItems).toBe(9);
      expect(result.promptPacks[0].approvedItems).toBe(8);
      expect(result.promptPacks[0].rejectedItems).toBe(1);
      expect(result.promptPacks[0].approvalRate).toBe(89);
    });

    it("legacy items without prompt metadata do not break aggregation", async () => {
      TopicFlashcard.aggregate.mockResolvedValue([]);
      TopicQuizQuestion.aggregate.mockResolvedValue([]);
      ExamQuestion.aggregate.mockResolvedValue([]);

      const result = await autopilotFeedbackService.getFeedbackByPromptPack({ days: 30 });

      expect(result.promptPacks).toEqual([]);
    });

    it("weak topics are ranked correctly", async () => {
      TopicFlashcard.countDocuments.mockResolvedValue(0);
      TopicQuizQuestion.countDocuments.mockResolvedValue(0);
      ExamQuestion.countDocuments.mockResolvedValue(0);
      TopicFlashcard.aggregate.mockResolvedValue([
        { _id: "aqa-gcse-biology:weak-topic", approved: 1, rejected: 3 },
        { _id: "aqa-gcse-biology:ok-topic", approved: 8, rejected: 2 },
      ]);
      TopicQuizQuestion.aggregate.mockResolvedValue([]);
      ExamQuestion.aggregate.mockResolvedValue([]);

      const result = await autopilotFeedbackService.getAutopilotFeedbackSummary({ days: 30, limit: 5 });

      expect(result.weakTopics.length).toBeGreaterThan(0);
      const first = result.weakTopics[0];
      expect(first.approvalRate).toBeLessThanOrEqual(result.weakTopics[result.weakTopics.length - 1]?.approvalRate ?? 100);
      expect(first.topicKey).toBeDefined();
      expect(first.reviewedItems).toBeGreaterThan(0);
    });
  });
});
