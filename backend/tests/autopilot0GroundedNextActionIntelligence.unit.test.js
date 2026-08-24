/**
 * Autopilot 0 Grounded Next-Action Intelligence V1 — unit tests.
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const SERVICE_PATH = path.join(
  __dirname,
  "..",
  "services",
  "autopilot0",
  "groundedNextActionIntelligenceService.js"
);
const serviceSource = fs.readFileSync(SERVICE_PATH, "utf8");

const {
  VERSION,
  LEVEL,
  DB_OPERATION_COUNT,
  MIN_LESSON_COUNT,
  MIN_QUIZ_COUNT,
  MIN_EXAM_COUNT,
  MIN_FLASHCARD_COUNT,
  resolvePrimaryAdvisory,
  sortTopicAdvisories,
  computeAdvisorySummary,
  computeEligibleA06Outcomes,
  buildGroundedNextActionIntelligence,
} = require("../services/autopilot0/groundedNextActionIntelligenceService");
const { buildTopicAliasMap } = require("../services/autopilot0/revisionIntelligenceService");
const {
  mergeAggregatedRowsByCanonicalTopic,
  buildTopicWindowMaps,
} = require("../services/autopilot0/learningTrendIntelligenceService");

jest.mock("../models/Lesson", () => ({ aggregate: jest.fn() }));
jest.mock("../models/TopicFlashcard", () => ({ aggregate: jest.fn() }));
jest.mock("../models/TopicQuizQuestion", () => ({ aggregate: jest.fn(), find: jest.fn() }));
jest.mock("../models/ExamQuestion", () => ({ aggregate: jest.fn(), find: jest.fn() }));
jest.mock("../models/LearningEvidenceEvent", () => ({ aggregate: jest.fn() }));
jest.mock("../models/PracticeAttempt", () => ({ aggregate: jest.fn() }));
jest.mock("../services/adminTaxonomyService", () => ({
  getMergedTaxonomyBySpecKey: jest.fn(),
}));
jest.mock("../utils/specTopicValidation", () => ({
  assertValidSpecKey: jest.fn(),
}));

const LearningEvidenceEvent = require("../models/LearningEvidenceEvent");
const PracticeAttempt = require("../models/PracticeAttempt");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const Lesson = require("../models/Lesson");
const TopicFlashcard = require("../models/TopicFlashcard");
const adminTaxonomyService = require("../services/adminTaxonomyService");
const { assertValidSpecKey } = require("../utils/specTopicValidation");

const SPEC = "aqa-gcse-biology";
const CANONICAL = `${SPEC}:cell-structure`;
const FIXED_NOW = new Date("2026-06-01T12:00:00.000Z");

const TAXONOMY = {
  units: [
    {
      unit: "Cell biology",
      unitKey: "cell-biology",
      topics: [{ key: "cell-structure", topic: "Cell structure" }],
    },
  ],
};

function makeAggRow({
  userId,
  topicKey,
  window,
  quizAttempts = 0,
  quizCorrect = 0,
  examAttempts = 0,
  examCorrect = 0,
}) {
  return {
    userId,
    topicKey,
    window,
    quizAttempts,
    quizCorrect,
    examAttempts,
    examCorrect,
  };
}

function pairedStudentRows({
  studentCount,
  earlierMastery = 40,
  recentMastery = 60,
  attemptsPerWindow = 5,
}) {
  const rows = [];
  for (let i = 0; i < studentCount; i += 1) {
    const userId = new mongoose.Types.ObjectId();
    const earlierCorrect = Math.round((earlierMastery / 100) * attemptsPerWindow);
    const recentCorrect = Math.round((recentMastery / 100) * attemptsPerWindow);
    rows.push(
      makeAggRow({
        userId,
        topicKey: "cell-structure",
        window: "earlier",
        quizAttempts: attemptsPerWindow,
        quizCorrect: earlierCorrect,
      }),
      makeAggRow({
        userId,
        topicKey: CANONICAL,
        window: "recent",
        quizAttempts: attemptsPerWindow,
        quizCorrect: recentCorrect,
      })
    );
  }
  return rows;
}

function mockContentAggregates({ lesson = 0, flash = 0, quiz = 0, exam = 0 } = {}) {
  const makeMap = (count) =>
    Promise.resolve(
      count > 0
        ? [
            {
              _id: CANONICAL,
              count,
            },
          ]
        : []
    );
  Lesson.aggregate.mockImplementation(() => makeMap(lesson));
  TopicFlashcard.aggregate.mockImplementation(() => makeMap(flash));
  TopicQuizQuestion.aggregate.mockImplementation(() => makeMap(quiz));
  ExamQuestion.aggregate.mockImplementation(() => makeMap(exam));
}

function mockA04Empty() {
  PracticeAttempt.aggregate.mockResolvedValue([]);
  TopicQuizQuestion.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });
  ExamQuestion.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });
}

function fullAvailability() {
  return {
    lesson: true,
    quizPractice: true,
    examPractice: true,
    flashcards: true,
  };
}

describe("groundedNextActionIntelligenceService contract", () => {
  test("version, level, and DB op count", () => {
    expect(VERSION).toBe("autopilot0-grounded-next-action-intelligence-v1");
    expect(LEVEL).toBe("L0");
    expect(DB_OPERATION_COUNT).toBe(10);
  });

  test("service does not call build* intelligence endpoints or A0.3 all-time aggregate", () => {
    expect(serviceSource).not.toMatch(/buildRevisionIntelligence\(/);
    expect(serviceSource).not.toMatch(/buildLearningTrendIntelligence\(/);
    expect(serviceSource).not.toMatch(/buildRevisionOutcomeIntelligence\(/);
    expect(serviceSource).not.toMatch(/buildQuestionIntelligence\(/);
    expect(serviceSource).not.toMatch(/aggregateLearningEvidenceByUserTopic/);
    expect(serviceSource).toMatch(/computeTopicOutcome/);
  });

  test("content gate constants", () => {
    expect(MIN_LESSON_COUNT).toBe(1);
    expect(MIN_QUIZ_COUNT).toBe(3);
    expect(MIN_EXAM_COUNT).toBe(2);
    expect(MIN_FLASHCARD_COUNT).toBe(1);
  });
});

describe("resolvePrimaryAdvisory matrix", () => {
  test("A0.4 review candidate precedence blocks student intervention", () => {
    expect(
      resolvePrimaryAdvisory({
        observedOutcome: "WEAK_AND_DECLINING",
        questionReviewRecommended: true,
        availability: fullAvailability(),
      })
    ).toBe("CONSIDER_QUESTION_REVIEW");
  });

  test("NO_LONGER_WEAK → no further weakness observed", () => {
    expect(
      resolvePrimaryAdvisory({
        observedOutcome: "NO_LONGER_WEAK",
        questionReviewRecommended: false,
        availability: emptyAvailability(),
      })
    ).toBe("NO_FURTHER_WEAKNESS_OBSERVED");
  });

  test("WEAK_AND_IMPROVING → continue current path", () => {
    expect(
      resolvePrimaryAdvisory({
        observedOutcome: "WEAK_AND_IMPROVING",
        questionReviewRecommended: false,
        availability: emptyAvailability(),
      })
    ).toBe("CONTINUE_CURRENT_PATH");
  });

  test("declining + lesson → reteach", () => {
    expect(
      resolvePrimaryAdvisory({
        observedOutcome: "WEAK_AND_DECLINING",
        questionReviewRecommended: false,
        availability: { lesson: true, quizPractice: true, examPractice: true, flashcards: true },
      })
    ).toBe("CONSIDER_RETEACH");
  });

  test("declining fallback ordering without lesson", () => {
    expect(
      resolvePrimaryAdvisory({
        observedOutcome: "WEAK_AND_DECLINING",
        questionReviewRecommended: false,
        availability: { lesson: false, quizPractice: true, examPractice: true, flashcards: true },
      })
    ).toBe("CONSIDER_MORE_PRACTICE");
    expect(
      resolvePrimaryAdvisory({
        observedOutcome: "WEAK_AND_DECLINING",
        questionReviewRecommended: false,
        availability: { lesson: false, quizPractice: false, examPractice: true, flashcards: true },
      })
    ).toBe("CONSIDER_EXAM_PRACTICE");
    expect(
      resolvePrimaryAdvisory({
        observedOutcome: "WEAK_AND_DECLINING",
        questionReviewRecommended: false,
        availability: { lesson: false, quizPractice: false, examPractice: false, flashcards: true },
      })
    ).toBe("CONSIDER_FLASHCARD_REVISION");
  });

  test("stable + quiz → more practice", () => {
    expect(
      resolvePrimaryAdvisory({
        observedOutcome: "WEAK_AND_STABLE",
        questionReviewRecommended: false,
        availability: { lesson: true, quizPractice: true, examPractice: false, flashcards: false },
      })
    ).toBe("CONSIDER_MORE_PRACTICE");
  });

  test("stable fallback ordering without quiz", () => {
    expect(
      resolvePrimaryAdvisory({
        observedOutcome: "WEAK_AND_STABLE",
        questionReviewRecommended: false,
        availability: { lesson: false, quizPractice: false, examPractice: true, flashcards: false },
      })
    ).toBe("CONSIDER_EXAM_PRACTICE");
    expect(
      resolvePrimaryAdvisory({
        observedOutcome: "WEAK_AND_STABLE",
        questionReviewRecommended: false,
        availability: { lesson: true, quizPractice: false, examPractice: false, flashcards: false },
      })
    ).toBe("CONSIDER_RETEACH");
  });

  test("no content → insufficient evidence", () => {
    expect(
      resolvePrimaryAdvisory({
        observedOutcome: "WEAK_AND_DECLINING",
        questionReviewRecommended: false,
        availability: emptyAvailability(),
      })
    ).toBe("INSUFFICIENT_EVIDENCE");
  });

  test("no eligible A0.6 outcome → insufficient evidence", () => {
    expect(
      resolvePrimaryAdvisory({
        observedOutcome: null,
        questionReviewRecommended: false,
        availability: fullAvailability(),
      })
    ).toBe("INSUFFICIENT_EVIDENCE");
  });
});

function emptyAvailability() {
  return {
    lesson: false,
    quizPractice: false,
    examPractice: false,
    flashcards: false,
  };
}

describe("status semantics", () => {
  test("remedial/review action → AMBER", () => {
    expect(
      computeAdvisorySummary([{ advisoryAction: "CONSIDER_RETEACH" }]).overallStatus
    ).toBe("AMBER");
    expect(
      computeAdvisorySummary([{ advisoryAction: "CONSIDER_QUESTION_REVIEW" }]).overallStatus
    ).toBe("AMBER");
  });

  test("continue/no-longer-weak only → GREEN", () => {
    const summary = computeAdvisorySummary([
      { advisoryAction: "CONTINUE_CURRENT_PATH" },
      { advisoryAction: "NO_FURTHER_WEAKNESS_OBSERVED" },
    ]);
    expect(summary.overallStatus).toBe("GREEN");
    expect(summary.humanReviewRequired).toBe(false);
  });

  test("no eligible evidence → UNKNOWN", () => {
    expect(computeAdvisorySummary([]).overallStatus).toBe("UNKNOWN");
    expect(
      computeAdvisorySummary([{ advisoryAction: "INSUFFICIENT_EVIDENCE" }]).overallStatus
    ).toBe("UNKNOWN");
  });

  test("no RED status emitted", () => {
    const statuses = [
      computeAdvisorySummary([{ advisoryAction: "CONSIDER_RETEACH" }]),
      computeAdvisorySummary([{ advisoryAction: "CONTINUE_CURRENT_PATH" }]),
      computeAdvisorySummary([]),
    ];
    for (const summary of statuses) {
      expect(summary.overallStatus).not.toBe("RED");
    }
  });
});

describe("ordering", () => {
  test("deterministic advisory priority and limit after sort", () => {
    const sorted = sortTopicAdvisories([
      { topicKey: `${SPEC}:z-topic`, advisoryAction: "INSUFFICIENT_EVIDENCE" },
      { topicKey: `${SPEC}:a-topic`, advisoryAction: "CONTINUE_CURRENT_PATH" },
      { topicKey: `${SPEC}:b-topic`, advisoryAction: "CONSIDER_RETEACH" },
      { topicKey: `${SPEC}:c-topic`, advisoryAction: "CONSIDER_QUESTION_REVIEW" },
    ]);
    expect(sorted.map((r) => r.advisoryAction)).toEqual([
      "CONSIDER_QUESTION_REVIEW",
      "CONSIDER_RETEACH",
      "CONTINUE_CURRENT_PATH",
      "INSUFFICIENT_EVIDENCE",
    ]);
  });
});

describe("A0.6 outcome input semantics", () => {
  test("eligible declining outcome extracted from paired rows", () => {
    const rawRows = pairedStudentRows({
      studentCount: 10,
      earlierMastery: 40,
      recentMastery: 20,
      attemptsPerWindow: 5,
    });
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    const outcomes = computeEligibleA06Outcomes(SPEC, TAXONOMY, rawRows, aliasToCanonical);
    expect(outcomes.get(CANONICAL)).toBe("WEAK_AND_DECLINING");
  });

  test("alias merge before mastery evaluation", () => {
    const userId = new mongoose.Types.ObjectId();
    const rawRows = [
      makeAggRow({
        userId,
        topicKey: "cell-structure",
        window: "earlier",
        quizAttempts: 5,
        quizCorrect: 2,
      }),
      makeAggRow({
        userId,
        topicKey: CANONICAL,
        window: "recent",
        quizAttempts: 5,
        quizCorrect: 2,
      }),
    ];
    for (let i = 1; i < 10; i += 1) {
      const sid = new mongoose.Types.ObjectId();
      rawRows.push(
        makeAggRow({ userId: sid, topicKey: "cell-structure", window: "earlier", quizAttempts: 5, quizCorrect: 2 }),
        makeAggRow({ userId: sid, topicKey: CANONICAL, window: "recent", quizAttempts: 5, quizCorrect: 2 })
      );
    }
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    const outcomes = computeEligibleA06Outcomes(SPEC, TAXONOMY, rawRows, aliasToCanonical);
    expect(outcomes.has(CANONICAL)).toBe(true);
  });
});

describe("buildGroundedNextActionIntelligence integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue(TAXONOMY);
    mockA04Empty();
  });

  test("declining + lesson content → reteach advisory AMBER", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      pairedStudentRows({ studentCount: 10, earlierMastery: 40, recentMastery: 20, attemptsPerWindow: 5 })
    );
    mockContentAggregates({ lesson: 1, quiz: 3, exam: 2, flash: 1 });
    const report = await buildGroundedNextActionIntelligence({ specKey: SPEC, now: FIXED_NOW });
    expect(report.topicAdvisories[0].observedOutcome).toBe("WEAK_AND_DECLINING");
    expect(report.topicAdvisories[0].advisoryAction).toBe("CONSIDER_RETEACH");
    expect(report.summary.overallStatus).toBe("AMBER");
    expect(assertValidSpecKey).toHaveBeenCalledWith(SPEC);
  });

  test("improving outcome → continue GREEN", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      pairedStudentRows({ studentCount: 10, earlierMastery: 40, recentMastery: 55, attemptsPerWindow: 5 })
    );
    mockContentAggregates();
    const report = await buildGroundedNextActionIntelligence({ specKey: SPEC, now: FIXED_NOW });
    expect(report.topicAdvisories[0].advisoryAction).toBe("CONTINUE_CURRENT_PATH");
    expect(report.summary.overallStatus).toBe("GREEN");
  });

  test("no longer weak → GREEN", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      pairedStudentRows({ studentCount: 10, earlierMastery: 40, recentMastery: 80, attemptsPerWindow: 5 })
    );
    mockContentAggregates();
    const report = await buildGroundedNextActionIntelligence({ specKey: SPEC, now: FIXED_NOW });
    expect(report.topicAdvisories[0].advisoryAction).toBe("NO_FURTHER_WEAKNESS_OBSERVED");
    expect(report.summary.overallStatus).toBe("GREEN");
  });

  test("review candidate blocks reteach", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      pairedStudentRows({ studentCount: 10, earlierMastery: 40, recentMastery: 20, attemptsPerWindow: 5 })
    );
    mockContentAggregates({ lesson: 1, quiz: 3, exam: 2, flash: 1 });
    ExamQuestion.find.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            {
              _id: new mongoose.Types.ObjectId(),
              topicKey: CANONICAL,
              questionMode: "simple",
              markScheme: "",
            },
          ]),
      }),
    });
    const report = await buildGroundedNextActionIntelligence({ specKey: SPEC, now: FIXED_NOW });
    expect(report.topicAdvisories[0].questionReviewRecommended).toBe(true);
    expect(report.topicAdvisories[0].advisoryAction).toBe("CONSIDER_QUESTION_REVIEW");
  });

  test("content gate boundaries", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      pairedStudentRows({ studentCount: 10, earlierMastery: 40, recentMastery: 42, attemptsPerWindow: 5 })
    );
    mockContentAggregates({ lesson: 0, quiz: 2, exam: 1, flash: 0 });
    const report = await buildGroundedNextActionIntelligence({ specKey: SPEC, now: FIXED_NOW });
    expect(report.topicAdvisories[0].contentAvailability.quizPractice).toBe(false);
    expect(report.topicAdvisories[0].contentAvailability.examPractice).toBe(false);
    expect(report.topicAdvisories[0].advisoryAction).toBe("INSUFFICIENT_EVIDENCE");
    expect(report.summary.overallStatus).toBe("UNKNOWN");
  });

  test("no eligible evidence → UNKNOWN", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue([]);
    const report = await buildGroundedNextActionIntelligence({ specKey: SPEC, now: FIXED_NOW });
    expect(report.topicAdvisories).toEqual([]);
    expect(report.summary.overallStatus).toBe("UNKNOWN");
  });

  test("response has no student identifiers", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      pairedStudentRows({ studentCount: 10, earlierMastery: 40, recentMastery: 55, attemptsPerWindow: 5 })
    );
    mockContentAggregates();
    const report = await buildGroundedNextActionIntelligence({ specKey: SPEC, now: FIXED_NOW });
    const json = JSON.stringify(report);
    expect(json).not.toMatch(/studentId/);
    expect(json).not.toMatch(/userId/);
    expect(report.generatedAt).toBe(FIXED_NOW.toISOString());
  });

  test("limit applied after sorting", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      pairedStudentRows({ studentCount: 10, earlierMastery: 40, recentMastery: 20, attemptsPerWindow: 5 })
    );
    mockContentAggregates({ lesson: 1, quiz: 3, exam: 2, flash: 1 });
    ExamQuestion.find.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            {
              _id: new mongoose.Types.ObjectId(),
              topicKey: `${SPEC}:cell-division`,
              questionMode: "simple",
              markScheme: "",
            },
          ]),
      }),
    });
    const taxonomyTwoTopics = {
      units: [
        {
          unit: "Cell biology",
          unitKey: "cell-biology",
          topics: [
            { key: "cell-structure", topic: "Cell structure" },
            { key: "cell-division", topic: "Cell division" },
          ],
        },
      ],
    };
    adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue(taxonomyTwoTopics);
    const report = await buildGroundedNextActionIntelligence({
      specKey: SPEC,
      now: FIXED_NOW,
      limit: 1,
    });
    expect(report.topicAdvisories).toHaveLength(1);
    expect(report.topicAdvisories[0].advisoryAction).toBe("CONSIDER_QUESTION_REVIEW");
  });
});

describe("exact-topic mode", () => {
  const taxonomyTwoTopics = {
    units: [
      {
        unit: "Cell biology",
        unitKey: "cell-biology",
        topics: [
          { key: "cell-structure", topic: "Cell structure" },
          { key: "cell-division", topic: "Cell division" },
        ],
      },
    ],
  };
  const CELL_DIVISION = `${SPEC}:cell-division`;

  function mockTwoTopicDecliningEvidence() {
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      pairedStudentRows({ studentCount: 10, earlierMastery: 40, recentMastery: 20, attemptsPerWindow: 5 })
    );
    mockContentAggregates({ lesson: 1, quiz: 3, exam: 2, flash: 1 });
    ExamQuestion.find.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            {
              _id: new mongoose.Types.ObjectId(),
              topicKey: CELL_DIVISION,
              questionMode: "simple",
              markScheme: "",
            },
          ]),
      }),
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue(taxonomyTwoTopics);
    mockA04Empty();
  });

  test("bulk mode unchanged when topicKey is not supplied", async () => {
    mockTwoTopicDecliningEvidence();
    const report = await buildGroundedNextActionIntelligence({
      specKey: SPEC,
      now: FIXED_NOW,
      limit: 1,
    });
    expect(report.topicAdvisories).toHaveLength(1);
    expect(report.topicAdvisories[0].topicKey).toBe(CELL_DIVISION);
    expect(report.topicAdvisories[0].advisoryAction).toBe("CONSIDER_QUESTION_REVIEW");
  });

  test("exact topic returns named topic when bulk limit=1 would exclude it", async () => {
    mockTwoTopicDecliningEvidence();
    const report = await buildGroundedNextActionIntelligence({
      specKey: SPEC,
      topicKey: CANONICAL,
      now: FIXED_NOW,
      limit: 1,
    });
    expect(report.topicAdvisories).toHaveLength(1);
    expect(report.topicAdvisories[0].topicKey).toBe(CANONICAL);
    expect(report.topicAdvisories[0].advisoryAction).toBe("CONSIDER_RETEACH");
  });

  test("exact topic is available regardless of supplied limit", async () => {
    mockTwoTopicDecliningEvidence();
    const withLimit = await buildGroundedNextActionIntelligence({
      specKey: SPEC,
      topicKey: CANONICAL,
      now: FIXED_NOW,
      limit: 1,
    });
    const withoutLimit = await buildGroundedNextActionIntelligence({
      specKey: SPEC,
      topicKey: CANONICAL,
      now: FIXED_NOW,
    });
    expect(withLimit.topicAdvisories).toEqual(withoutLimit.topicAdvisories);
    expect(withLimit.topicAdvisories[0].topicKey).toBe(CANONICAL);
  });

  test("valid taxonomy topic with no outcomes and no review returns INSUFFICIENT_EVIDENCE", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue([]);
    const report = await buildGroundedNextActionIntelligence({
      specKey: SPEC,
      topicKey: CELL_DIVISION,
      now: FIXED_NOW,
    });
    expect(report.topicAdvisories).toHaveLength(1);
    expect(report.topicAdvisories[0].topicKey).toBe(CELL_DIVISION);
    expect(report.topicAdvisories[0].observedOutcome).toBeNull();
    expect(report.topicAdvisories[0].questionReviewRecommended).toBe(false);
    expect(report.topicAdvisories[0].advisoryAction).toBe("INSUFFICIENT_EVIDENCE");
  });

  test("invalid topic for spec throws INVALID_TOPIC_KEY", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue([]);
    await expect(
      buildGroundedNextActionIntelligence({
        specKey: SPEC,
        topicKey: `${SPEC}:not-a-real-topic`,
        now: FIXED_NOW,
      })
    ).rejects.toMatchObject({ code: "INVALID_TOPIC_KEY" });
  });

  test("exact topic resolves canonical alias input", async () => {
    mockTwoTopicDecliningEvidence();
    const report = await buildGroundedNextActionIntelligence({
      specKey: SPEC,
      topicKey: "cell-structure",
      now: FIXED_NOW,
    });
    expect(report.topicAdvisories[0].topicKey).toBe(CANONICAL);
    expect(report.topicAdvisories[0].advisoryAction).toBe("CONSIDER_RETEACH");
  });

  test("exact row semantic fields equal bulk row when topic appears in both", async () => {
    mockTwoTopicDecliningEvidence();
    const bulk = await buildGroundedNextActionIntelligence({
      specKey: SPEC,
      now: FIXED_NOW,
      limit: 50,
    });
    const exact = await buildGroundedNextActionIntelligence({
      specKey: SPEC,
      topicKey: CANONICAL,
      now: FIXED_NOW,
    });
    const bulkRow = bulk.topicAdvisories.find((row) => row.topicKey === CANONICAL);
    expect(bulkRow).toBeDefined();
    expect(exact.topicAdvisories[0]).toEqual(bulkRow);
  });

  test("generatedAt parity with fixed now between bulk and exact", async () => {
    mockTwoTopicDecliningEvidence();
    const bulk = await buildGroundedNextActionIntelligence({ specKey: SPEC, now: FIXED_NOW, limit: 50 });
    const exact = await buildGroundedNextActionIntelligence({
      specKey: SPEC,
      topicKey: CANONICAL,
      now: FIXED_NOW,
    });
    expect(exact.generatedAt).toBe(bulk.generatedAt);
    expect(exact.generatedAt).toBe(FIXED_NOW.toISOString());
  });
});
