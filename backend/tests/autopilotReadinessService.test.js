/**
 * Unit tests for Autopilot Readiness service.
 */
const autopilotReadinessService = require("../services/autopilotReadinessService");

jest.mock("../services/curriculumGapDetectionService");
jest.mock("../services/contentCoverageService");
jest.mock("../services/adminTaxonomyService");
jest.mock("../models/ContentNode");
jest.mock("../models/SpecStatement");

const curriculumGapDetectionService = require("../services/curriculumGapDetectionService");
const contentCoverageService = require("../services/contentCoverageService");
const ContentNode = require("../models/ContentNode");
const SpecStatement = require("../models/SpecStatement");

describe("autopilotReadinessService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("buildReadinessFlags", () => {
    it("missing SpecStatements blocks generation", () => {
      const gap = { counts: { openIssues: 0 } };
      const flags = autopilotReadinessService.buildReadinessFlags(gap, {}, {
        hasSpecStatements: false,
        hasTopicNode: true,
        isLeafTopic: true,
      });
      expect(flags.hasSpecStatements).toBe(false);
      expect(flags.canGenerateFlashcards).toBe(false);
      expect(flags.canGenerateQuiz).toBe(false);
      expect(flags.canGenerateExamQuestions).toBe(false);
    });

    it("high issue count sets lowIssues false", () => {
      const gap = { counts: { openIssues: 5 } };
      const flags = autopilotReadinessService.buildReadinessFlags(gap, {}, {
        hasSpecStatements: true,
        hasTopicNode: true,
        isLeafTopic: true,
      });
      expect(flags.lowIssues).toBe(false);
      expect(flags.canGenerateFlashcards).toBe(false);
    });

    it("topic with statements and low issues becomes ready", () => {
      const gap = { counts: { openIssues: 0 } };
      const flags = autopilotReadinessService.buildReadinessFlags(gap, {}, {
        hasSpecStatements: true,
        hasTopicNode: true,
        isLeafTopic: true,
      });
      expect(flags.hasSpecStatements).toBe(true);
      expect(flags.lowIssues).toBe(true);
      expect(flags.canGenerateFlashcards).toBe(true);
      expect(flags.canGenerateQuiz).toBe(true);
      expect(flags.canGenerateExamQuestions).toBe(true);
    });

    it("missing topic node blocks generation", () => {
      const gap = { counts: { openIssues: 0 } };
      const flags = autopilotReadinessService.buildReadinessFlags(gap, {}, {
        hasSpecStatements: true,
        hasTopicNode: false,
        isLeafTopic: true,
      });
      expect(flags.hasTopicNode).toBe(false);
      expect(flags.canGenerateFlashcards).toBe(false);
    });
  });

  describe("buildReadinessSummary", () => {
    it("blocked topic gets blocker message", () => {
      const r = {
        blockers: ["Missing specification statements"],
        autopilotActionsAvailable: [],
      };
      const summary = autopilotReadinessService.buildReadinessSummary(r);
      expect(summary).toContain("blocked");
      expect(summary).toContain("Missing specification statements");
    });

    it("ready topic gets action labels", () => {
      const r = {
        blockers: [],
        autopilotActionsAvailable: ["generate_flashcards", "generate_quiz"],
      };
      const summary = autopilotReadinessService.buildReadinessSummary(r);
      expect(summary).toContain("flashcards");
      expect(summary).toContain("quizzes");
    });
  });

  describe("getTopicAutopilotReadiness", () => {
    beforeEach(() => {
      contentCoverageService.getTopicCoverage.mockResolvedValue({});
    });

    it("missing SpecStatements adds blocker", async () => {
      curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
        topicKey: "cell-structure",
        topicTitle: "Cell structure",
        counts: { flashcards: 0, quizzes: 0, examQuestions: 0, openIssues: 0 },
      });
      SpecStatement.countDocuments.mockResolvedValue(0);
      ContentNode.findOne.mockReturnValue({
        lean: () => Promise.resolve({ _id: "node1" }),
      });
      const adminTaxonomyService = require("../services/adminTaxonomyService");
      adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue({
        units: [{ topics: [{ key: "cell-structure" }] }],
      });

      const result = await autopilotReadinessService.getTopicAutopilotReadiness(
        "aqa-gcse-biology",
        "cell-structure"
      );

      expect(result.blockers).toContain("Missing specification statements");
      expect(result.ready).toBe(false);
    });

    it("high issue count sets requiresReview", async () => {
      curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
        topicKey: "cell-structure",
        topicTitle: "Cell structure",
        counts: { flashcards: 5, quizzes: 3, examQuestions: 2, openIssues: 5 },
      });
      SpecStatement.countDocuments.mockResolvedValue(3);
      ContentNode.findOne.mockReturnValue({
        lean: () => Promise.resolve({ _id: "node1" }),
      });
      const adminTaxonomyService = require("../services/adminTaxonomyService");
      adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue({
        units: [{ topics: [{ key: "cell-structure" }] }],
      });

      const result = await autopilotReadinessService.getTopicAutopilotReadiness(
        "aqa-gcse-biology",
        "cell-structure"
      );

      expect(result.requiresReview).toBe(true);
    });

    it("available actions computed correctly when ready", async () => {
      curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
        topicKey: "cell-structure",
        topicTitle: "Cell structure",
        counts: { flashcards: 1, quizzes: 0, examQuestions: 0, openIssues: 0 },
      });
      SpecStatement.countDocuments.mockResolvedValue(5);
      ContentNode.findOne.mockReturnValue({
        lean: () => Promise.resolve({ _id: "node1" }),
      });
      const adminTaxonomyService = require("../services/adminTaxonomyService");
      adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue({
        units: [{ topics: [{ key: "cell-structure" }] }],
      });

      const result = await autopilotReadinessService.getTopicAutopilotReadiness(
        "aqa-gcse-biology",
        "cell-structure"
      );

      expect(result.autopilotActionsAvailable).toContain("generate_flashcards");
      expect(result.autopilotActionsAvailable).toContain("generate_quiz");
      expect(result.autopilotActionsAvailable).toContain("generate_exam_questions");
      expect(result.ready).toBe(true);
    });
  });
});
