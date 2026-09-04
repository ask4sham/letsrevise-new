/**
 * Unit tests for Autopilot Generation Adapters.
 */
jest.mock("../services/adminTaxonomyService", () => ({
  topicIsGroupInMerged: jest.fn().mockResolvedValue(false),
}));

jest.mock("../utils/lessonAssetLlm", () => ({
  callOpenAiJson: jest.fn(),
}));

const autopilotGenerationAdapters = require("../services/autopilotGenerationAdapters");

jest.mock("../services/generation/starterPackService", () => ({
  runStarterPackGeneration: jest.fn(),
}));
jest.mock("../models/TopicFlashcard");
jest.mock("../models/TopicQuizQuestion");
jest.mock("../models/ExamQuestion");
jest.mock("../utils/topicDriftValidation", () => ({
  filterBankItemsByDrift: jest.fn((x) => x),
}));

const { runStarterPackGeneration } = require("../services/generation/starterPackService");
const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");

describe("autopilotGenerationAdapters", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateFlashcardsForTopic", () => {
    it("returns skipped when no adminUserId", async () => {
      const result = await autopilotGenerationAdapters.generateFlashcardsForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        adminUserId: null,
      });
      expect(result.status).toBe("skipped");
      expect(result.reason).toBe("adminUserId required");
      expect(runStarterPackGeneration).not.toHaveBeenCalled();
    });

    it("returns skipped when generation_not_available (no spec statements)", async () => {
      runStarterPackGeneration.mockRejectedValue(new Error("No spec statements found for this topic."));

      const result = await autopilotGenerationAdapters.generateFlashcardsForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        adminUserId: "admin123",
      });

      expect(result.status).toBe("skipped");
      expect(result.reason).toBe("generation_not_available");
    });

    it("returns skipped when pack has no flashcards", async () => {
      runStarterPackGeneration.mockResolvedValue({ pack: { flashcards: [], quiz: [], examQuestions: [] } });

      const result = await autopilotGenerationAdapters.generateFlashcardsForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        adminUserId: "admin123",
      });

      expect(result.status).toBe("skipped");
      expect(result.reason).toBe("generation_not_available");
    });

    it("generated content receives prompt metadata", async () => {
      runStarterPackGeneration.mockResolvedValue({
        pack: {
          flashcards: [{ front: "Q1", back: "A1", options: [] }],
          quiz: [],
          examQuestions: [],
        },
      });
      const mockSave = jest.fn().mockResolvedValue(undefined);
      TopicFlashcard.mockImplementation(function (opts) {
        this.save = mockSave;
        this._id = "mock-id";
        return this;
      });

      await autopilotGenerationAdapters.generateFlashcardsForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        adminUserId: "admin123",
      });

      expect(TopicFlashcard).toHaveBeenCalled();
      const callArgs = TopicFlashcard.mock.calls[0][0];
      expect(callArgs.metadata).toBeDefined();
      expect(callArgs.metadata.generatedBy).toBe("autopilot");
      expect(callArgs.metadata.promptPackId).toBe("autopilot-core");
      expect(callArgs.metadata.promptPackVersion).toBe("v1");
      expect(callArgs.metadata.generatorMode).toBe("starter_pack");
    });

    it("generated metadata uses passed promptPack instead of default", async () => {
      runStarterPackGeneration.mockResolvedValue({
        pack: {
          flashcards: [{ front: "Q1", back: "A1", options: [] }],
          quiz: [],
          examQuestions: [],
        },
      });
      const mockSave = jest.fn().mockResolvedValue(undefined);
      TopicFlashcard.mockImplementation(function (opts) {
        this.save = mockSave;
        this._id = "mock-id";
        return this;
      });

      await autopilotGenerationAdapters.generateFlashcardsForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        adminUserId: "admin123",
        promptPack: { promptPackId: "autopilot-core", promptPackVersion: "v2", generatorMode: "starter_pack" },
      });

      const callArgs = TopicFlashcard.mock.calls[0][0];
      expect(callArgs.metadata.promptPackId).toBe("autopilot-core");
      expect(callArgs.metadata.promptPackVersion).toBe("v2");
    });
  });

  describe("generateQuizForTopic", () => {
    it("returns skipped when generation_not_available", async () => {
      runStarterPackGeneration.mockResolvedValue({ pack: { flashcards: [], quiz: [], examQuestions: [] } });

      const result = await autopilotGenerationAdapters.generateQuizForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        adminUserId: "admin123",
      });

      expect(result.status).toBe("skipped");
      expect(result.reason).toBe("generation_not_available");
    });
  });

  describe("generateExamQuestionsForTopic", () => {
    const baseExam = {
      question: "Explain how osmosis affects plant cells in a concentrated solution.",
      marks: 4,
      markScheme: [
        "Water moves out of the cell by osmosis.",
        "The cytoplasm shrinks and the cell becomes plasmolysed.",
        "The cell membrane pulls away from the cell wall.",
        "Turgor pressure is lost in the plant cell.",
      ],
      modelAnswer:
        "Water leaves the cell by osmosis, so the cytoplasm shrinks and the membrane pulls away from the cell wall.",
      topicKey: "aqa-gcse-biology:cell-structure",
    };

    const mismatchedExam = {
      ...baseExam,
      markScheme: ["Water moves out of the cell by osmosis.", "The cytoplasm shrinks and the cell becomes plasmolysed."],
    };

    it("returns skipped when generation_not_available", async () => {
      runStarterPackGeneration.mockResolvedValue({ pack: { flashcards: [], quiz: [], examQuestions: [] } });

      const result = await autopilotGenerationAdapters.generateExamQuestionsForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        adminUserId: "admin123",
      });

      expect(result.status).toBe("skipped");
      expect(result.reason).toBe("generation_not_available");
    });

    it("returns failed incomplete when corrective retry is exhausted", async () => {
      runStarterPackGeneration.mockResolvedValue({
        pack: { flashcards: [], quiz: [], examQuestions: [mismatchedExam] },
      });
      callOpenAiJson.mockResolvedValue(mismatchedExam);
      ExamQuestion.mockImplementation(function () {
        this.save = jest.fn();
        this._id = "should-not-save";
        return this;
      });

      const result = await autopilotGenerationAdapters.generateExamQuestionsForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        adminUserId: "admin123",
        count: 1,
      });

      expect(callOpenAiJson).toHaveBeenCalledTimes(1);
      expect(result.status).toBe("failed");
      expect(result.incomplete).toBe(true);
      expect(result.code).toBe("GENERATED_EXAM_QUESTION_SET_INCOMPLETE");
      expect(result.createdCount).toBe(0);
      expect(ExamQuestion).not.toHaveBeenCalled();
    });

    it("persists exam question when corrective retry succeeds", async () => {
      runStarterPackGeneration.mockResolvedValue({
        pack: { flashcards: [], quiz: [], examQuestions: [mismatchedExam] },
      });
      callOpenAiJson.mockResolvedValue(baseExam);
      const mockSave = jest.fn().mockResolvedValue(undefined);
      ExamQuestion.mockImplementation(function () {
        this.save = mockSave;
        this._id = "eq-saved";
        return this;
      });

      const result = await autopilotGenerationAdapters.generateExamQuestionsForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        adminUserId: "admin123",
        count: 1,
      });

      expect(callOpenAiJson).toHaveBeenCalledTimes(1);
      expect(result.status).toBe("generated");
      expect(result.createdCount).toBe(1);
      expect(mockSave).toHaveBeenCalledTimes(1);
    });
  });
});
