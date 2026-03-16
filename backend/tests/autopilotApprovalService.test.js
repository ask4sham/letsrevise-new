/**
 * Unit tests for Autopilot Approval service.
 */
const autopilotApprovalService = require("../services/autopilotApprovalService");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const mongoose = require("mongoose");

jest.mock("../models/TopicFlashcard");
jest.mock("../models/TopicQuizQuestion");
jest.mock("../models/ExamQuestion");

describe("autopilotApprovalService", () => {
  const mockId = new mongoose.Types.ObjectId();
  const mockReviewerId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAutopilotDrafts", () => {
    it("only returns autopilot-generated drafts", async () => {
      TopicFlashcard.find.mockReturnValue({
        sort: () => ({
          lean: () =>
            Promise.resolve([
              {
                _id: mockId,
                topicKey: "aqa-gcse-biology:cell-structure",
                front: "What is a cell?",
                back: "Basic unit of life",
                status: "draft",
                metadata: { generatedBy: "autopilot", specKey: "aqa-gcse-biology", topicKey: "aqa-gcse-biology:cell-structure" },
                createdAt: new Date(),
                isArchived: false,
              },
            ]),
        }),
      });
      TopicQuizQuestion.find.mockReturnValue({ sort: () => ({ lean: () => Promise.resolve([]) }) });
      ExamQuestion.find.mockReturnValue({ sort: () => ({ lean: () => Promise.resolve([]) }) });

      const items = await autopilotApprovalService.getAutopilotDrafts({});
      expect(items.length).toBe(1);
      expect(items[0].itemType).toBe("flashcard");
      expect(items[0].generatedBy).toBe("autopilot");
      expect(items[0].status).toBe("draft");
    });

    it("queries only for autopilot-generated content", async () => {
      TopicFlashcard.find.mockReturnValue({ sort: () => ({ lean: () => Promise.resolve([]) }) });
      TopicQuizQuestion.find.mockReturnValue({ sort: () => ({ lean: () => Promise.resolve([]) }) });
      ExamQuestion.find.mockReturnValue({ sort: () => ({ lean: () => Promise.resolve([]) }) });

      await autopilotApprovalService.getAutopilotDrafts({});
      expect(TopicFlashcard.find).toHaveBeenCalledWith(
        expect.objectContaining({
          "metadata.generatedBy": "autopilot",
          status: "draft",
        })
      );
    });
  });

  describe("approveAutopilotItem", () => {
    it("updates status to published for flashcard", async () => {
      const doc = {
        _id: mockId,
        topicKey: "aqa-gcse-biology:cell-structure",
        front: "Q",
        back: "A",
        status: "draft",
        metadata: { generatedBy: "autopilot" },
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      TopicFlashcard.findOne.mockResolvedValue(doc);

      const result = await autopilotApprovalService.approveAutopilotItem({
        itemType: "flashcard",
        itemId: String(mockId),
        reviewerId: mockReviewerId,
      });

      expect(doc.status).toBe("published");
      expect(doc.metadata.reviewedBy).toBe(mockReviewerId);
      expect(doc.metadata.reviewDecision).toBe("approved");
      expect(result).not.toBeNull();
    });

    it("updates status to published for quiz question", async () => {
      const doc = {
        _id: mockId,
        topicKey: "aqa-gcse-biology:cell-structure",
        questionText: "Q",
        status: "draft",
        metadata: { generatedBy: "autopilot" },
        save: jest.fn().mockResolvedValue(undefined),
      };
      TopicQuizQuestion.findOne.mockResolvedValue(doc);

      await autopilotApprovalService.approveAutopilotItem({
        itemType: "quizQuestion",
        itemId: String(mockId),
        reviewerId: mockReviewerId,
      });

      expect(doc.status).toBe("published");
      expect(doc.publishedBy).toBe(mockReviewerId);
      expect(doc.metadata.reviewDecision).toBe("approved");
    });
  });

  describe("rejectAutopilotItem", () => {
    it("sets isArchived for flashcard", async () => {
      const doc = {
        _id: mockId,
        topicKey: "aqa-gcse-biology:cell-structure",
        front: "Q",
        back: "A",
        status: "draft",
        isArchived: false,
        metadata: { generatedBy: "autopilot" },
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      TopicFlashcard.findOne.mockResolvedValue(doc);

      const result = await autopilotApprovalService.rejectAutopilotItem({
        itemType: "flashcard",
        itemId: String(mockId),
        reviewerId: mockReviewerId,
        reason: "Off-topic",
      });

      expect(doc.isArchived).toBe(true);
      expect(doc.metadata.reviewDecision).toBe("rejected");
      expect(doc.metadata.reviewReason).toBe("Off-topic");
      expect(result).not.toBeNull();
    });
  });

  describe("bulkApproveAutopilotItems", () => {
    it("approves multiple items", async () => {
      const doc = {
        _id: mockId,
        topicKey: "aqa-gcse-biology:cell-structure",
        front: "Q",
        back: "A",
        status: "draft",
        metadata: { generatedBy: "autopilot" },
        save: jest.fn().mockResolvedValue(undefined),
      };
      TopicFlashcard.findOne.mockResolvedValue(doc);

      const result = await autopilotApprovalService.bulkApproveAutopilotItems({
        items: [
          { itemType: "flashcard", itemId: String(mockId) },
          { itemType: "flashcard", itemId: "nonexistent" },
        ],
        reviewerId: mockReviewerId,
      });

      expect(result.approved).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
    });
  });

  describe("bulkRejectAutopilotItems", () => {
    it("rejects multiple items", async () => {
      const doc = {
        _id: mockId,
        topicKey: "aqa-gcse-biology:cell-structure",
        front: "Q",
        back: "A",
        status: "draft",
        isArchived: false,
        metadata: { generatedBy: "autopilot" },
        save: jest.fn().mockResolvedValue(undefined),
      };
      TopicFlashcard.findOne.mockResolvedValue(doc);

      const result = await autopilotApprovalService.bulkRejectAutopilotItems({
        items: [{ itemType: "flashcard", itemId: String(mockId) }],
        reviewerId: mockReviewerId,
        reason: "Bulk reject",
      });

      expect(result.rejected).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
    });
  });

  describe("unsupported item type", () => {
    it("fails cleanly for unsupported item type", async () => {
      await expect(
        autopilotApprovalService.approveAutopilotItem({
          itemType: "lesson",
          itemId: String(mockId),
          reviewerId: mockReviewerId,
        })
      ).rejects.toThrow("Unsupported item type");
    });
  });
});
