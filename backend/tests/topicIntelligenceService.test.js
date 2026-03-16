/**
 * Unit tests for Topic Intelligence Service.
 */
const topicIntelligenceService = require("../services/topicIntelligenceService");

jest.mock("../services/contentCoverageService");
jest.mock("../services/curriculumGapDetectionService");
jest.mock("../services/autopilotReadinessService");
jest.mock("../services/topicEvidenceService");
jest.mock("../services/evidenceReviewWorklistService");
jest.mock("../services/studentTopicEvidenceService");
jest.mock("../services/autopilotOutcomesService");
jest.mock("../services/autopilotFeedbackService");
jest.mock("../services/autopilotGatingService");
jest.mock("../services/adminTaxonomyService");
jest.mock("../models/SpecStatement");
jest.mock("../models/AutopilotRun");

const contentCoverageService = require("../services/contentCoverageService");
const curriculumGapDetectionService = require("../services/curriculumGapDetectionService");
const autopilotReadinessService = require("../services/autopilotReadinessService");
const topicEvidenceService = require("../services/topicEvidenceService");
const evidenceReviewWorklistService = require("../services/evidenceReviewWorklistService");
const studentTopicEvidenceService = require("../services/studentTopicEvidenceService");
const autopilotOutcomesService = require("../services/autopilotOutcomesService");
const autopilotFeedbackService = require("../services/autopilotFeedbackService");
const autopilotGatingService = require("../services/autopilotGatingService");
const adminTaxonomyService = require("../services/adminTaxonomyService");
const SpecStatement = require("../models/SpecStatement");
const AutopilotRun = require("../models/AutopilotRun");

describe("topicIntelligenceService", () => {
  const mockSpecChain = (docs = []) => ({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(docs),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    SpecStatement.find.mockImplementation(() => mockSpecChain());
    const autopilotRunChain = { sort: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) };
    AutopilotRun.findOne.mockReturnValue(autopilotRunChain);
    adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue({
      subject: "Biology",
      specKey: "aqa-gcse-biology",
      units: [{ unit: "Cell biology", unitKey: "cell-biology", topics: [{ key: "cell-structure", topic: "Cell structure" }] }],
    });
    contentCoverageService.getTopicCoverage.mockResolvedValue({
      lessonCount: 1,
      flashcardCount: 5,
      quizCount: 3,
      examQuestionCount: 2,
      coverageScore: 90,
    });
    curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
      topicKey: "cell-structure",
      topicTitle: "Cell structure",
      priorityScore: 0,
      coverageStatus: "strong",
      gapFlags: {},
    });
    autopilotReadinessService.getTopicAutopilotReadiness.mockResolvedValue({
      ready: true,
      blockers: [],
      autopilotActionsAvailable: ["generate_flashcards"],
    });
    topicEvidenceService.getTopicEvidence.mockResolvedValue({
      topicTitle: "Cell structure",
      evidenceCounts: { lessonIssues: 0, teacherRevisions: 0, autopilotRuns: 2, autopilotApprovals: 5, autopilotRejections: 1 },
      derivedMetrics: { evidenceHealth: "strong", approvalRate: 83 },
    });
    evidenceReviewWorklistService.getEvidenceReviewItem.mockResolvedValue(null);
    studentTopicEvidenceService.getTopicLearningEvidence.mockResolvedValue({
      derivedMetrics: { masteryScore: 75, difficultyLevel: "moderate" },
      quizStats: { accuracy: 80 },
      examStats: { accuracy: 70 },
      flashcardStats: { averageDifficulty: 2.5 },
      lessonStats: { completions: 10 },
    });
    autopilotOutcomesService.getAutopilotOutcomeByTopic.mockResolvedValue({
      totals: { runs: 2, generatedFlashcards: 5, generatedQuizzes: 3, generatedExamQuestions: 2 },
      topCoverageLiftTopics: [],
    });
    autopilotFeedbackService.getAutopilotFeedbackByTopic.mockResolvedValue({});
    autopilotFeedbackService.getFeedbackByPromptPack.mockResolvedValue({ promptPacks: [] });
    autopilotOutcomesService.getOutcomesByPromptPack.mockResolvedValue({ promptPacks: [] });
    autopilotGatingService.getAutopilotGate.mockResolvedValue({
      gateStatus: "allow",
      reasons: ["Evidence is strong; all actions allowed."],
    });
  });

  describe("buildTopicRecommendedActions", () => {
    it("returns create_lesson when gap priority high and missingLesson", () => {
      const ti = {
        gapAnalysis: { priorityScore: 40, gapFlags: { missingLesson: true } },
        evidenceHealth: { evidenceHealth: "strong" },
        learningEvidence: { masteryScore: 80 },
        autopilot: { runs: 1 },
        readiness: { ready: true },
        evidenceReview: { gateStatus: "allow" },
      };
      const actions = topicIntelligenceService.buildTopicRecommendedActions(ti);
      expect(actions.some((a) => a.action === "create_lesson")).toBe(true);
    });

    it("returns review_content when evidence health weak", () => {
      const ti = {
        gapAnalysis: { priorityScore: 0 },
        evidenceHealth: { evidenceHealth: "weak" },
        learningEvidence: { masteryScore: 80 },
        autopilot: { runs: 1 },
        readiness: { ready: true },
        evidenceReview: { gateStatus: "allow" },
      };
      const actions = topicIntelligenceService.buildTopicRecommendedActions(ti);
      expect(actions.some((a) => a.action === "review_content")).toBe(true);
    });

    it("returns inspect_rejections when approval rate low", () => {
      const ti = {
        gapAnalysis: { priorityScore: 0 },
        evidenceHealth: { evidenceHealth: "strong", approvalRate: 50 },
        learningEvidence: { masteryScore: 80 },
        autopilot: { runs: 1 },
        readiness: { ready: true },
        evidenceReview: { gateStatus: "allow" },
      };
      const actions = topicIntelligenceService.buildTopicRecommendedActions(ti);
      expect(actions.some((a) => a.action === "inspect_rejections")).toBe(true);
    });

    it("returns run_autopilot when zero runs and ready", () => {
      const ti = {
        gapAnalysis: { priorityScore: 0 },
        evidenceHealth: { evidenceHealth: "strong" },
        learningEvidence: { masteryScore: 80 },
        autopilot: { runs: 0 },
        readiness: { ready: true },
        evidenceReview: { gateStatus: "allow" },
      };
      const actions = topicIntelligenceService.buildTopicRecommendedActions(ti);
      expect(actions.some((a) => a.action === "run_autopilot")).toBe(true);
    });

    it("returns fix_taxonomy_mapping when blockers mention mapping", () => {
      const ti = {
        gapAnalysis: { priorityScore: 0 },
        evidenceHealth: { evidenceHealth: "strong" },
        learningEvidence: { masteryScore: 80 },
        autopilot: { runs: 1 },
        readiness: { ready: false, blockers: ["Topic graph node not found", "Fix mapping"] },
        evidenceReview: { gateStatus: "block", reasons: [] },
      };
      const actions = topicIntelligenceService.buildTopicRecommendedActions(ti);
      expect(actions.some((a) => a.action === "fix_taxonomy_mapping")).toBe(true);
    });
  });

  describe("getTopicCommandCenter", () => {
    it("aggregates multiple service outputs", async () => {
      SpecStatement.find.mockImplementation(() => mockSpecChain([
        { statementCode: "B1.1", statementText: "Describe cell structure", tier: "both" },
      ]));
      const result = await topicIntelligenceService.getTopicCommandCenter("aqa-gcse-biology", "cell-structure");
      expect(result).toBeDefined();
      expect(result.specKey).toBe("aqa-gcse-biology");
      expect(result.topicKey).toContain("cell-structure");
      expect(result.topicTitle).toBe("Cell structure");
      expect(result.curriculum.specStatementsCount).toBe(1);
      expect(result.coverage.lessons).toBe(1);
      expect(result.coverage.flashcards).toBe(5);
      expect(result.gapAnalysis.priorityScore).toBe(0);
      expect(result.readiness.ready).toBe(true);
      expect(result.evidenceHealth.evidenceHealth).toBe("strong");
      expect(result.learningEvidence.masteryScore).toBe(75);
      expect(result.autopilot.runs).toBe(2);
      expect(Array.isArray(result.recommendedActions)).toBe(true);
      expect(result.safeMode).toBeDefined();
      expect(typeof result.safeMode.enabled).toBe("boolean");
      expect(result.safeMode.evidenceSample).toBeDefined();
      expect(result.safeMode.thresholds).toBeDefined();
    });

    it("handles null coverage gracefully", async () => {
      contentCoverageService.getTopicCoverage.mockResolvedValue(null);
      curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue(null);
      autopilotReadinessService.getTopicAutopilotReadiness.mockResolvedValue(null);
      topicEvidenceService.getTopicEvidence.mockResolvedValue(null);
      studentTopicEvidenceService.getTopicLearningEvidence.mockResolvedValue(null);
      autopilotOutcomesService.getAutopilotOutcomeByTopic.mockResolvedValue(null);
      autopilotFeedbackService.getAutopilotFeedbackByTopic.mockResolvedValue(null);
      autopilotFeedbackService.getFeedbackByPromptPack.mockResolvedValue(null);
      autopilotOutcomesService.getOutcomesByPromptPack.mockResolvedValue(null);
      autopilotGatingService.getAutopilotGate.mockResolvedValue(null);

      const result = await topicIntelligenceService.getTopicCommandCenter("aqa-gcse-biology", "unknown-topic");
      expect(result).toBeDefined();
      expect(result.coverage.lessons).toBe(0);
      expect(result.coverage.coverageScore).toBe(0);
      expect(result.gapAnalysis.priorityScore).toBe(0);
      expect(result.readiness.ready).toBe(false);
      expect(result.readiness.blockers).toContain("Topic not found");
    });

    it("normalizes topicKey with spec prefix", async () => {
      const result = await topicIntelligenceService.getTopicCommandCenter("aqa-gcse-biology", "aqa-gcse-biology:cell-structure");
      expect(result.topicKey).toContain("cell-structure");
    });
  });
});
