/**
 * Tests for Autopilot Run History logging.
 */
const curriculumAutopilotService = require("../services/curriculumAutopilotService");
const AutopilotRun = require("../models/AutopilotRun");

jest.mock("../services/curriculumGapDetectionService");
jest.mock("../services/autopilotGenerationAdapters");
jest.mock("../services/contentGraphService");
jest.mock("../services/contentCoverageService");
jest.mock("../services/autopilotGatingService");
jest.mock("../services/autopilotFeedbackService");
jest.mock("../services/topicEvidenceService");
jest.mock("../services/studentTopicEvidenceService");
jest.mock("../models/Lesson");
jest.mock("../models/TopicFlashcard");
jest.mock("../models/TopicQuizQuestion");
jest.mock("../models/ExamQuestion");

const curriculumGapDetectionService = require("../services/curriculumGapDetectionService");
const autopilotGenerationAdapters = require("../services/autopilotGenerationAdapters");
const contentGraphService = require("../services/contentGraphService");
const contentCoverageService = require("../services/contentCoverageService");
const autopilotGatingService = require("../services/autopilotGatingService");
const autopilotFeedbackService = require("../services/autopilotFeedbackService");
const topicEvidenceService = require("../services/topicEvidenceService");
const studentTopicEvidenceService = require("../services/studentTopicEvidenceService");
const Lesson = require("../models/Lesson");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");

describe("curriculumAutopilotService run history", () => {
  const mockAdminId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    jest.clearAllMocks();
    autopilotGatingService.getAutopilotGate.mockResolvedValue({
      gateStatus: "allow",
      reasons: [],
      allowedActions: ["generate_flashcards", "generate_quiz", "generate_exam_questions"],
      blockedActions: [],
    });
    autopilotFeedbackService.getFeedbackByPromptPack.mockResolvedValue({ promptPacks: [] });
    topicEvidenceService.getTopicEvidence.mockResolvedValue({
      derivedMetrics: { evidenceHealth: "weak", approvalRate: 0 },
      evidenceCounts: {
        lessonIssues: 0,
        autopilotRuns: 0,
        autopilotApprovals: 0,
        autopilotRejections: 0,
      },
    });
    studentTopicEvidenceService.getTopicLearningEvidence.mockResolvedValue({
      derivedMetrics: { masteryScore: 0 },
      quizStats: { attempts: 0 },
    });
    AutopilotRun.create = jest.fn().mockResolvedValue({});
    contentGraphService.resolveTopicNode.mockResolvedValue({ _id: "node1" });
    contentGraphService.linkLessonToTopic.mockResolvedValue({});
    contentGraphService.linkFlashcardToTopic.mockResolvedValue({});
    contentGraphService.linkQuizQuestionToTopic.mockResolvedValue({});
    contentGraphService.linkQuestionToTopic.mockResolvedValue({});
    contentCoverageService.getTopicCoverage.mockResolvedValue({
      lessonCount: 1,
      flashcardCount: 2,
      quizCount: 1,
      examQuestionCount: 0,
      issueCount: 0,
      coverageScore: 60,
      status: "partial",
    });
    Lesson.find.mockReturnValue({ lean: () => Promise.resolve([]) });
    TopicFlashcard.find.mockReturnValue({ lean: () => Promise.resolve([]) });
    TopicQuizQuestion.find.mockReturnValue({ lean: () => Promise.resolve([]) });
    ExamQuestion.find.mockReturnValue({ lean: () => Promise.resolve([]) });
  });

  it("topic autopilot creates a run record", async () => {
    curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
      topicKey: "cell-structure",
      topicTitle: "Cell structure",
      counts: { flashcards: 2, quizzes: 1, examQuestions: 0, openIssues: 0 },
      coverageScore: 40,
      coverageStatus: "weak",
      gapFlags: { lowFlashcards: true, lowQuizzes: true },
      priorityScore: 50,
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
      status: "generated",
      createdCount: 2,
      ids: ["eq1", "eq2"],
    });
    const result = await curriculumAutopilotService.runTopicAutopilot({
      specKey: "aqa-gcse-biology",
      topicKey: "cell-structure",
      dryRun: false,
      adminUserId: mockAdminId,
    });

    expect(result.specKey).toBe("aqa-gcse-biology");
    expect(AutopilotRun.create).toHaveBeenCalledTimes(1);
    const payload = AutopilotRun.create.mock.calls[0][0];
    expect(payload.runType).toBe("topic");
    expect(payload.specKey).toBe("aqa-gcse-biology");
    expect(payload.topicKey).toBe("cell-structure");
    expect(payload.dryRun).toBe(false);
    expect(payload.status).toBe("completed");
    expect(payload.topicResults).toHaveLength(1);
    expect(payload.topicResults[0].topicKey).toBe("cell-structure");
  });

  it("spec autopilot creates a run record", async () => {
    curriculumGapDetectionService.detectTopicGaps.mockResolvedValue([
      {
        topicKey: "cell-structure",
        topicTitle: "Cell structure",
        counts: { flashcards: 0, quizzes: 0, examQuestions: 0, openIssues: 0 },
        gapFlags: { highIssueRate: false },
        priorityScore: 60,
      },
    ]);
    curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
      topicKey: "cell-structure",
      topicTitle: "Cell structure",
      counts: { flashcards: 0, quizzes: 0, examQuestions: 0, openIssues: 0 },
      gapFlags: {},
      priorityScore: 60,
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
    contentGraphService.linkLessonToTopic.mockResolvedValue({});
    contentGraphService.linkFlashcardToTopic.mockResolvedValue({});
    contentGraphService.linkQuizQuestionToTopic.mockResolvedValue({});
    contentGraphService.linkQuestionToTopic.mockResolvedValue({});

    const result = await curriculumAutopilotService.runSpecAutopilot({
      specKey: "aqa-gcse-biology",
      dryRun: false,
      limit: 5,
      adminUserId: mockAdminId,
    });

    expect(result.specKey).toBe("aqa-gcse-biology");
    expect(AutopilotRun.create).toHaveBeenCalled();
    const calls = AutopilotRun.create.mock.calls;
    const specCall = calls.find((c) => c[0].runType === "spec");
    expect(specCall).toBeDefined();
    const payload = specCall[0];
    expect(payload.runType).toBe("spec");
    expect(payload.specKey).toBe("aqa-gcse-biology");
    expect(payload.dryRun).toBe(false);
    expect(payload.status).toBe("completed");
  });

  it("dryRun is logged", async () => {
    curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
      topicKey: "cell-structure",
      topicTitle: "Cell structure",
      counts: { flashcards: 0, quizzes: 0, examQuestions: 0, openIssues: 0 },
      gapFlags: {},
      priorityScore: 50,
    });

    await curriculumAutopilotService.runTopicAutopilot({
      specKey: "aqa-gcse-biology",
      topicKey: "cell-structure",
      dryRun: true,
      adminUserId: mockAdminId,
    });

    expect(AutopilotRun.create).toHaveBeenCalledTimes(1);
    const payload = AutopilotRun.create.mock.calls[0][0];
    expect(payload.dryRun).toBe(true);
  });

  it("partial/failure/completed status classification works", async () => {
    curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
      topicKey: "cell-structure",
      topicTitle: "Cell structure",
      counts: { flashcards: 0, quizzes: 0, examQuestions: 0, openIssues: 0 },
      gapFlags: {},
      priorityScore: 50,
    });
    autopilotGenerationAdapters.generateFlashcardsForTopic.mockResolvedValue({
      status: "generated",
      createdCount: 2,
      ids: ["id1", "id2"],
    });
    autopilotGenerationAdapters.generateQuizForTopic.mockRejectedValue(new Error("generation_error"));
    autopilotGenerationAdapters.generateExamQuestionsForTopic.mockResolvedValue({
      status: "skipped",
      reason: "generation_not_available",
    });
    await curriculumAutopilotService.runTopicAutopilot({
      specKey: "aqa-gcse-biology",
      topicKey: "cell-structure",
      dryRun: false,
      adminUserId: mockAdminId,
    });

    const payload = AutopilotRun.create.mock.calls[0][0];
    expect(payload.status).toBe("partial");
  });

  it("log failure does not break autopilot response", async () => {
    curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
      topicKey: "cell-structure",
      topicTitle: "Cell structure",
      counts: { flashcards: 0, quizzes: 0, examQuestions: 0, openIssues: 0 },
      gapFlags: {},
      priorityScore: 50,
    });
    autopilotGenerationAdapters.generateFlashcardsForTopic.mockResolvedValue({
      status: "skipped",
      reason: "generation_not_available",
    });
    AutopilotRun.create.mockRejectedValue(new Error("DB write failed"));

    const result = await curriculumAutopilotService.runTopicAutopilot({
      specKey: "aqa-gcse-biology",
      topicKey: "cell-structure",
      dryRun: true,
      adminUserId: mockAdminId,
    });

    expect(result.specKey).toBe("aqa-gcse-biology");
    expect(result.topicKey).toBe("cell-structure");
  });

  it("topic run stores coverageBefore and coverageAfter when generation succeeds", async () => {
    contentCoverageService.getTopicCoverage.mockReset();
    contentCoverageService.getTopicCoverage
      .mockResolvedValueOnce({
        lessonCount: 1,
        flashcardCount: 2,
        quizCount: 1,
        examQuestionCount: 0,
        issueCount: 0,
        coverageScore: 40,
        status: "weak",
      })
      .mockResolvedValue({
        lessonCount: 1,
        flashcardCount: 5,
        quizCount: 3,
        examQuestionCount: 2,
        issueCount: 0,
        coverageScore: 90,
        status: "strong",
      });
    curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
      topicKey: "cell-structure",
      topicTitle: "Cell structure",
      counts: { flashcards: 2, quizzes: 1, examQuestions: 0, openIssues: 0 },
      gapFlags: {},
      priorityScore: 50,
    });
    autopilotGenerationAdapters.generateFlashcardsForTopic.mockResolvedValue({
      status: "generated",
      createdCount: 3,
      ids: ["id1", "id2", "id3"],
    });
    autopilotGenerationAdapters.generateQuizForTopic.mockResolvedValue({
      status: "generated",
      createdCount: 2,
      ids: ["q1", "q2"],
    });
    autopilotGenerationAdapters.generateExamQuestionsForTopic.mockResolvedValue({
      status: "generated",
      createdCount: 2,
      ids: ["eq1", "eq2"],
    });

    await curriculumAutopilotService.runTopicAutopilot({
      specKey: "aqa-gcse-biology",
      topicKey: "cell-structure",
      dryRun: false,
      adminUserId: mockAdminId,
    });

    const payload = AutopilotRun.create.mock.calls[0][0];
    const tr = payload.topicResults[0];
    expect(tr.coverageBefore).toBeDefined();
    expect(tr.coverageBefore.score).toBe(40);
    expect(tr.coverageAfter).toBeDefined();
    expect(tr.coverageAfter.score).toBe(90);
    expect(tr.coverageLift).toBe(50);
  });

  it("dryRun stores coverageBefore and zero lift", async () => {
    contentCoverageService.getTopicCoverage.mockResolvedValue({
      lessonCount: 1,
      flashcardCount: 2,
      quizCount: 1,
      examQuestionCount: 0,
      issueCount: 0,
      coverageScore: 40,
      status: "weak",
    });
    curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
      topicKey: "cell-structure",
      topicTitle: "Cell structure",
      counts: { flashcards: 2, quizzes: 1, examQuestions: 0, openIssues: 0 },
      gapFlags: {},
      priorityScore: 50,
    });

    await curriculumAutopilotService.runTopicAutopilot({
      specKey: "aqa-gcse-biology",
      topicKey: "cell-structure",
      dryRun: true,
      adminUserId: mockAdminId,
    });

    const payload = AutopilotRun.create.mock.calls[0][0];
    const tr = payload.topicResults[0];
    expect(tr.coverageBefore).toBeDefined();
    expect(tr.coverageBefore.score).toBe(40);
    expect(tr.coverageAfter).toBeDefined();
    expect(tr.coverageAfter.score).toBe(40);
    expect(tr.coverageLift).toBe(0);
  });

  it("failed run preserves coverageBefore when possible", async () => {
    contentCoverageService.getTopicCoverage.mockResolvedValue({
      lessonCount: 1,
      flashcardCount: 2,
      quizCount: 1,
      examQuestionCount: 0,
      issueCount: 0,
      coverageScore: 40,
      status: "weak",
    });
    curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
      topicKey: "cell-structure",
      topicTitle: "Cell structure",
      counts: { flashcards: 2, quizzes: 1, examQuestions: 0, openIssues: 0 },
      gapFlags: {},
      priorityScore: 50,
    });
    autopilotGenerationAdapters.generateFlashcardsForTopic.mockResolvedValue({
      status: "failed",
      reason: "generation_error",
    });
    autopilotGenerationAdapters.generateQuizForTopic.mockResolvedValue({
      status: "skipped",
      reason: "generation_not_available",
    });
    autopilotGenerationAdapters.generateExamQuestionsForTopic.mockResolvedValue({
      status: "skipped",
      reason: "generation_not_available",
    });

    await curriculumAutopilotService.runTopicAutopilot({
      specKey: "aqa-gcse-biology",
      topicKey: "cell-structure",
      dryRun: false,
      adminUserId: mockAdminId,
    });

    const payload = AutopilotRun.create.mock.calls[0][0];
    const tr = payload.topicResults[0];
    expect(tr.coverageBefore).toBeDefined();
    expect(tr.coverageBefore.score).toBe(40);
    expect(tr.coverageAfter).toBeDefined();
    expect(tr.coverageAfter.score).toBe(40);
    expect(tr.coverageLift).toBe(0);
  });

  it("autopilot runs receive prompt pack version", async () => {
    curriculumGapDetectionService.detectSingleTopicGap.mockResolvedValue({
      topicKey: "cell-structure",
      topicTitle: "Cell structure",
      counts: { flashcards: 2, quizzes: 1, examQuestions: 0, openIssues: 0 },
      gapFlags: {},
      priorityScore: 50,
    });
    autopilotGenerationAdapters.generateFlashcardsForTopic.mockResolvedValue({
      status: "skipped",
      reason: "generation_not_available",
    });

    await curriculumAutopilotService.runTopicAutopilot({
      specKey: "aqa-gcse-biology",
      topicKey: "cell-structure",
      dryRun: true,
      adminUserId: mockAdminId,
    });

    const payload = AutopilotRun.create.mock.calls[0][0];
    expect(payload.promptPackId).toBe("autopilot-core");
    expect(payload.promptPackVersion).toBe("v1");
    const tr = payload.topicResults[0];
    expect(tr.executedActions[0].promptPackId).toBe("autopilot-core");
    expect(tr.executedActions[0].promptPackVersion).toBe("v1");
  });
});
