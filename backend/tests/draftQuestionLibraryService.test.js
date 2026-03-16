/**
 * Unit tests for Draft Question Library service.
 */
const draftQuestionLibraryService = require("../services/draftQuestionLibraryService");

jest.mock("../models/SpecStatement");
jest.mock("../services/adminTaxonomyService");
jest.mock("../services/autopilotGenerationAdapters");

const SpecStatement = require("../models/SpecStatement");
const adminTaxonomyService = require("../services/adminTaxonomyService");
const { generateFlashcardsForTopic, generateExamQuestionsForTopic } = require("../services/autopilotGenerationAdapters");

describe("draftQuestionLibraryService", () => {
  const TAXONOMY_WITH_CELL = {
    specKey: "aqa-gcse-biology",
    units: [{ unitKey: "u1", topics: [{ key: "cell-structure", topicKey: "aqa-gcse-biology:cell-structure" }] }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue(TAXONOMY_WITH_CELL);
    SpecStatement.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });
  });

  describe("generateDraftLibraryForTopic", () => {
    it("returns skipped when specKey, topicKey, or adminUserId missing", async () => {
      adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue({
        units: [{ topics: [{ key: "cell-structure" }] }],
      });
      const r1 = await draftQuestionLibraryService.generateDraftLibraryForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
      });
      expect(r1.skipped).toBe(true);
      expect(r1.reason).toBe("missing_params");

      const r2 = await draftQuestionLibraryService.generateDraftLibraryForTopic({
        specKey: "aqa-gcse-biology",
        adminUserId: "user1",
      });
      expect(r2.skipped).toBe(true);
    });

    it("returns skipped when no spec statements (missing_spec_statements)", async () => {
      SpecStatement.find.mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      });
      const r = await draftQuestionLibraryService.generateDraftLibraryForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        adminUserId: "user1",
      });
      expect(r.skipped).toBe(true);
      expect(r.reason).toBe("missing_spec_statements");
      expect(r.statementsUsed).toBe(0);
      expect(r.flashcardsGenerated).toBe(0);
      expect(r.examQuestionsGenerated).toBe(0);
    });

    it("calls adapters per statement and aggregates results", async () => {
      SpecStatement.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { statementCode: "B1.1", topicKey: "aqa-gcse-biology:cell-structure" },
            { statementCode: "B1.2", topicKey: "aqa-gcse-biology:cell-structure" },
          ]),
        }),
      });
      generateFlashcardsForTopic.mockResolvedValue({ status: "generated", createdCount: 5, ids: ["id1"] });
      generateExamQuestionsForTopic.mockResolvedValue({ status: "generated", createdCount: 2, ids: ["eq1"] });

      const r = await draftQuestionLibraryService.generateDraftLibraryForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        adminUserId: "user1",
      });

      expect(r.skipped).toBe(false);
      expect(r.statementsUsed).toBe(2);
      expect(r.flashcardsGenerated).toBe(10);
      expect(r.examQuestionsGenerated).toBe(4);
      expect(generateFlashcardsForTopic).toHaveBeenCalledTimes(2);
      expect(generateExamQuestionsForTopic).toHaveBeenCalledTimes(2);
      expect(generateFlashcardsForTopic).toHaveBeenCalledWith(
        expect.objectContaining({
          statementCodes: ["B1.1"],
          initialStatus: "draft",
          promptPack: expect.objectContaining({
            generatorMode: "draft_library",
            sourceType: "spec_statements_only",
          }),
        })
      );
    });

    it("passes limitPerTopic when provided", async () => {
      SpecStatement.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { statementCode: "B1.1", topicKey: "aqa-gcse-biology:cell-structure" },
            { statementCode: "B1.2", topicKey: "aqa-gcse-biology:cell-structure" },
            { statementCode: "B1.3", topicKey: "aqa-gcse-biology:cell-structure" },
          ]),
        }),
      });
      generateFlashcardsForTopic.mockResolvedValue({ status: "generated", createdCount: 5 });
      generateExamQuestionsForTopic.mockResolvedValue({ status: "generated", createdCount: 2 });

      const r = await draftQuestionLibraryService.generateDraftLibraryForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        adminUserId: "user1",
        limitPerTopic: 2,
      });

      expect(r.statementsUsed).toBe(2);
      expect(generateFlashcardsForTopic).toHaveBeenCalledTimes(2);
    });

    it("rejects non-leaf topicKey", async () => {
      const r = await draftQuestionLibraryService.generateDraftLibraryForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "main-topic",
        adminUserId: "user1",
      });
      expect(r.skipped).toBe(true);
      expect(r.reason).toBe("non_leaf_topic");
    });

    it("dryRun returns counts without saving", async () => {
      SpecStatement.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ statementCode: "B1.1", topicKey: "aqa-gcse-biology:cell-structure" }]),
        }),
      });
      generateFlashcardsForTopic.mockResolvedValue({ status: "generated", createdCount: 5, ids: [], dryRun: true });
      generateExamQuestionsForTopic.mockResolvedValue({ status: "generated", createdCount: 2, ids: [], dryRun: true });

      const r = await draftQuestionLibraryService.generateDraftLibraryForTopic({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        adminUserId: "user1",
        dryRun: true,
      });

      expect(r.dryRun).toBe(true);
      expect(r.flashcardsGenerated).toBe(5);
      expect(r.examQuestionsGenerated).toBe(2);
    });
  });

  describe("generateDraftLibraryForSpec", () => {
    it("returns error when specKey or adminUserId missing", async () => {
      const r = await draftQuestionLibraryService.generateDraftLibraryForSpec({
        specKey: "aqa-gcse-biology",
      });
      expect(r.error).toContain("required");
    });

    it("returns error when spec not found", async () => {
      adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue(null);
      const r = await draftQuestionLibraryService.generateDraftLibraryForSpec({
        specKey: "unknown-spec",
        adminUserId: "user1",
      });
      expect(r.error).toContain("Spec not found");
    });

    it("skips topics with >100 flashcards or >40 exam questions", async () => {
      adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue({
        specKey: "aqa-gcse-biology",
        units: [
          { unitKey: "u1", topics: [{ key: "t1", topicKey: "aqa-gcse-biology:t1" }] },
          { unitKey: "u2", topics: [{ key: "t2", topicKey: "aqa-gcse-biology:t2" }] },
        ],
      });
      adminTaxonomyService.getLinkedContentCounts
        .mockResolvedValueOnce({ flashcards: 150, examQuestions: 10 }) // skip: flashcards > 100
        .mockResolvedValueOnce({ flashcards: 50, examQuestions: 50 }); // skip: exam questions > 40

      const r = await draftQuestionLibraryService.generateDraftLibraryForSpec({
        specKey: "aqa-gcse-biology",
        adminUserId: "user1",
      });

      expect(r.topicsProcessed).toBe(0);
      expect(r.skippedTopics).toHaveLength(2);
      expect(r.skippedTopics[0].reason).toBe("flashcards_exceed_100");
      expect(r.skippedTopics[1].reason).toBe("exam_questions_exceed_40");
    });
  });
});
