/**
 * Autopilot 0 Question Intelligence V1 — unit tests.
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const SERVICE_PATH = path.join(
  __dirname,
  "..",
  "services",
  "autopilot0",
  "questionIntelligenceService.js"
);
const serviceSource = fs.readFileSync(SERVICE_PATH, "utf8");

const {
  VERSION,
  LEVEL,
  MIN_STUDENTS_FOR_PERFORMANCE,
  MIN_RAW_ATTEMPTS_FOR_PERFORMANCE,
  VERY_LOW_SUCCESS_RATE_THRESHOLD,
  VERY_HIGH_SUCCESS_RATE_THRESHOLD,
  studentSampleBand,
  buildTopicAliasMap,
  resolveCanonicalTopicKey,
  isQuizInSpecScope,
  isExamInSpecScope,
  examHasMarkScheme,
  computeSuccessRate,
  sortReviewCandidates,
  classifyPerformanceRows,
  aggregatePerformanceByQuestion,
  buildQuestionIntelligence,
  PERFORMANCE_CONTENT_TYPE,
} = require("../services/autopilot0/questionIntelligenceService");

jest.mock("../models/PracticeAttempt", () => ({ aggregate: jest.fn() }));
jest.mock("../models/TopicQuizQuestion", () => ({ find: jest.fn() }));
jest.mock("../models/ExamQuestion", () => ({ find: jest.fn() }));
jest.mock("../services/adminTaxonomyService", () => ({
  getMergedTaxonomyBySpecKey: jest.fn(),
}));
jest.mock("../utils/specTopicValidation", () => ({
  assertValidSpecKey: jest.fn(),
}));

const PracticeAttempt = require("../models/PracticeAttempt");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const adminTaxonomyService = require("../services/adminTaxonomyService");
const { assertValidSpecKey } = require("../utils/specTopicValidation");

const SPEC = "aqa-gcse-biology";
const TAXONOMY = {
  units: [
    {
      unit: "Cell biology",
      unitKey: "cell-biology",
      topics: [{ key: "cell-structure", topic: "Cell structure" }],
    },
  ],
};

function mockFindChain(rows) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(rows),
  };
}

function makePerformanceRow({
  contentId,
  uniqueStudents,
  correctStudents,
  rawAttemptCount,
}) {
  return {
    contentType: "quiz_mcq",
    contentId,
    uniqueStudents,
    correctStudents,
    rawAttemptCount,
    successRate: computeSuccessRate(correctStudents, uniqueStudents),
  };
}

function matchesEligibleMatch(doc, match) {
  if (doc.specKey !== match.specKey) return false;
  if (doc.contentType !== match.contentType) return false;
  if (doc.contentId == null) return false;
  if (doc.studentId == null) return false;
  if (typeof doc.isCorrect !== "boolean") return false;
  return true;
}

function runAggregatePipeline(pipeline, docs) {
  let rows = [...docs];
  for (const stage of pipeline) {
    if (stage.$match) {
      rows = rows.filter((doc) => matchesEligibleMatch(doc, stage.$match));
      continue;
    }
    if (stage.$sort) {
      const sort = stage.$sort;
      rows.sort((a, b) => {
        for (const key of Object.keys(sort)) {
          const dir = sort[key];
          const av = a[key];
          const bv = b[key];
          if (av === bv) continue;
          if (av == null) return dir;
          if (bv == null) return -dir;
          if (av < bv) return -dir;
          if (av > bv) return dir;
        }
        return 0;
      });
      continue;
    }
    if (stage.$group) {
      const idExpr = stage.$group._id;
      const buckets = new Map();
      for (const row of rows) {
        let id;
        if (typeof idExpr === "string" && idExpr.startsWith("$")) {
          id = row[idExpr.slice(1)];
        } else if (idExpr && typeof idExpr === "object") {
          id = {};
          for (const [k, v] of Object.entries(idExpr)) {
            if (typeof v === "string" && v.startsWith("$")) {
              const path = v.slice(1).split(".");
              let cur = row;
              for (const part of path) cur = cur?.[part];
              id[k] = cur;
            } else {
              id[k] = v;
            }
          }
        } else {
          id = row;
        }
        const key = JSON.stringify(id);
        if (!buckets.has(key)) buckets.set(key, { _id: id, rows: [] });
        buckets.get(key).rows.push(row);
      }

      const grouped = [];
      for (const bucket of buckets.values()) {
        const out = { _id: bucket._id };
        for (const [field, expr] of Object.entries(stage.$group)) {
          if (field === "_id") continue;
          if (expr?.$sum === 1) {
            out[field] = bucket.rows.length;
          } else if (expr?.$first) {
            const path = expr.$first.slice(1);
            out[field] = bucket.rows[0][path];
          } else if (expr?.$sum?.$cond) {
            const condExpr = expr.$sum.$cond;
            const eqExpr = condExpr[0].$eq;
            const path = eqExpr[0].slice(1);
            const eqVal = eqExpr[1];
            const thenVal = condExpr[1];
            out[field] = bucket.rows.reduce(
              (sum, r) => sum + (r[path] === eqVal ? thenVal : 0),
              0
            );
          }
        }
        grouped.push(out);
      }
      rows = grouped;
    }
  }
  return rows;
}

function mockAggregateFromAttempts(attempts) {
  PracticeAttempt.aggregate.mockImplementation((pipeline) =>
    Promise.resolve(runAggregatePipeline(pipeline, attempts))
  );
}

function setupBuildMocks({ performanceAttempts = [], quizRows = [], examRows = [] } = {}) {
  adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue(TAXONOMY);
  mockAggregateFromAttempts(performanceAttempts);
  TopicQuizQuestion.find.mockImplementation(() => mockFindChain(quizRows));
  ExamQuestion.find.mockImplementation(() => mockFindChain(examRows));
}

describe("questionIntelligenceService contract", () => {
  test("version and level", () => {
    expect(VERSION).toBe("autopilot0-question-intelligence-v1");
    expect(LEVEL).toBe("L0");
  });

  test("service source does not reference LearningEvidenceEvent", () => {
    expect(serviceSource).not.toMatch(/require\([^)]*LearningEvidenceEvent/);
  });
});

describe("identity and spec isolation", () => {
  test("same contentId with different contentType does not collide in sort keys", () => {
    const id = new mongoose.Types.ObjectId();
    const sorted = sortReviewCandidates([
      {
        signal: "VERY_LOW_SUCCESS_RATE",
        successRate: 10,
        questionKey: { contentType: "quiz_mcq", contentId: String(id) },
      },
      {
        signal: "VERY_LOW_SUCCESS_RATE",
        successRate: 10,
        questionKey: { contentType: "exam_question", contentId: String(id) },
      },
    ]);
    expect(sorted[0].questionKey.contentType).toBe("exam_question");
    expect(sorted[1].questionKey.contentType).toBe("quiz_mcq");
  });

  test("wrong spec topic is excluded from attribution", () => {
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    expect(
      isQuizInSpecScope(SPEC, { topicKey: "edexcel-igcse-biology:cell-structure" }, aliasToCanonical)
    ).toBe(false);
    expect(isExamInSpecScope(SPEC, { topicKey: "edexcel-igcse-biology:cell-structure" }, aliasToCanonical)).toBe(
      false
    );
  });

  test("unknown topic key resolves to null", () => {
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    expect(resolveCanonicalTopicKey(SPEC, "unknown-slug", aliasToCanonical)).toBeNull();
  });
});

describe("success rate and thresholds", () => {
  test("computeSuccessRate uses unique students denominator", () => {
    expect(computeSuccessRate(2, 10)).toBe(20);
    expect(computeSuccessRate(3, 10)).toBe(30);
  });

  test("20% triggers low signal", () => {
    const row = makePerformanceRow({
      contentId: new mongoose.Types.ObjectId(),
      uniqueStudents: 10,
      correctStudents: 2,
      rawAttemptCount: 25,
    });
    const result = classifyPerformanceRows([row], new Map());
    expect(result.performanceCandidates[0].signal).toBe("VERY_LOW_SUCCESS_RATE");
    expect(result.performanceCandidates[0].successRate).toBe(20);
  });

  test("21% does not trigger low signal", () => {
    const row = makePerformanceRow({
      contentId: new mongoose.Types.ObjectId(),
      uniqueStudents: 10,
      correctStudents: 3,
      rawAttemptCount: 25,
    });
    const result = classifyPerformanceRows([row], new Map());
    expect(result.performanceCandidates).toHaveLength(0);
    expect(result.eligiblePerformanceQuestionCount).toBe(1);
  });

  test("95% triggers high signal", () => {
    const row = makePerformanceRow({
      contentId: new mongoose.Types.ObjectId(),
      uniqueStudents: 20,
      correctStudents: 19,
      rawAttemptCount: 30,
    });
    const result = classifyPerformanceRows([row], new Map());
    expect(result.performanceCandidates[0].signal).toBe("VERY_HIGH_SUCCESS_RATE");
    expect(result.performanceCandidates[0].successRate).toBe(95);
  });

  test("94% does not trigger high signal", () => {
    const row = makePerformanceRow({
      contentId: new mongoose.Types.ObjectId(),
      uniqueStudents: 10,
      correctStudents: 9,
      rawAttemptCount: 30,
    });
    const result = classifyPerformanceRows([row], new Map());
    expect(result.performanceCandidates).toHaveLength(0);
  });
});

describe("privacy gates", () => {
  test("fewer than 10 students suppresses performance classification", () => {
    const row = makePerformanceRow({
      contentId: new mongoose.Types.ObjectId(),
      uniqueStudents: 9,
      correctStudents: 1,
      rawAttemptCount: 30,
    });
    const result = classifyPerformanceRows([row], new Map());
    expect(result.performanceCandidates).toHaveLength(0);
    expect(result.suppressedPerformanceQuestionCount).toBe(1);
  });

  test("fewer than 25 raw attempts suppresses performance classification", () => {
    const row = makePerformanceRow({
      contentId: new mongoose.Types.ObjectId(),
      uniqueStudents: 10,
      correctStudents: 1,
      rawAttemptCount: 24,
    });
    const result = classifyPerformanceRows([row], new Map());
    expect(result.performanceCandidates).toHaveLength(0);
    expect(result.suppressedPerformanceQuestionCount).toBe(1);
  });

  test("25 raw attempts passes raw gate when unique-student gate also passes", () => {
    const row = makePerformanceRow({
      contentId: new mongoose.Types.ObjectId(),
      uniqueStudents: 10,
      correctStudents: 5,
      rawAttemptCount: 25,
    });
    const result = classifyPerformanceRows([row], new Map());
    expect(result.performanceCandidates).toHaveLength(0);
    expect(result.eligiblePerformanceQuestionCount).toBe(1);
    expect(result.suppressedPerformanceQuestionCount).toBe(0);
  });

  test("both gates must pass", () => {
    const row = makePerformanceRow({
      contentId: new mongoose.Types.ObjectId(),
      uniqueStudents: 9,
      correctStudents: 0,
      rawAttemptCount: 24,
    });
    const result = classifyPerformanceRows([row], new Map());
    expect(result.performanceCandidates).toHaveLength(0);
    expect(result.eligiblePerformanceQuestionCount).toBe(0);
  });

  test("10-19 sample band hides exact count", () => {
    expect(studentSampleBand(15)).toBe("10-19");
    expect(studentSampleBand(20)).toBe("20-49");
    expect(studentSampleBand(50)).toBe("50+");
  });
});

describe("structural signals", () => {
  test("exam without mark scheme detected", () => {
    expect(examHasMarkScheme({ questionMode: "single", markScheme: [] })).toBe(false);
    expect(examHasMarkScheme({ questionMode: "single", markScheme: ["Point 1"] })).toBe(true);
  });

  test("composite requires each part mark scheme", () => {
    expect(
      examHasMarkScheme({
        questionMode: "composite",
        parts: [{ markScheme: [] }, { markScheme: ["a"] }],
      })
    ).toBe(false);
    expect(
      examHasMarkScheme({
        questionMode: "composite",
        parts: [{ markScheme: ["a"] }, { markScheme: ["b"] }],
      })
    ).toBe(true);
  });
});

describe("aggregatePerformanceByQuestion pipeline", () => {
  const contentId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();
  const baseTime = new Date("2026-01-01T12:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("eligible match accepts only modern quiz_mcq slice-1 rows", async () => {
    const attempts = [
      {
        specKey: SPEC,
        contentType: "quiz_mcq",
        contentId,
        studentId,
        isCorrect: true,
        createdAt: baseTime,
        _id: new mongoose.Types.ObjectId(),
      },
      {
        specKey: SPEC,
        contentType: "quiz_short",
        contentId,
        studentId,
        isCorrect: true,
        createdAt: baseTime,
        _id: new mongoose.Types.ObjectId(),
      },
      {
        specKey: SPEC,
        contentType: "exam_question",
        contentId,
        studentId,
        isCorrect: false,
        createdAt: baseTime,
        _id: new mongoose.Types.ObjectId(),
      },
      {
        specKey: SPEC,
        contentType: "past_paper_question",
        contentId,
        studentId,
        isCorrect: true,
        createdAt: baseTime,
        _id: new mongoose.Types.ObjectId(),
      },
      {
        specKey: "edexcel-igcse-biology",
        contentType: "quiz_mcq",
        contentId,
        studentId,
        isCorrect: true,
        createdAt: baseTime,
        _id: new mongoose.Types.ObjectId(),
      },
      {
        specKey: SPEC,
        contentType: "quiz_mcq",
        contentId: null,
        studentId,
        isCorrect: true,
        createdAt: baseTime,
        _id: new mongoose.Types.ObjectId(),
      },
      {
        specKey: SPEC,
        contentType: "quiz_mcq",
        contentId,
        studentId: null,
        isCorrect: true,
        createdAt: baseTime,
        _id: new mongoose.Types.ObjectId(),
      },
      {
        specKey: SPEC,
        questionId: contentId,
        userId: studentId,
        isCorrect: true,
        createdAt: baseTime,
        _id: new mongoose.Types.ObjectId(),
      },
      {
        specKey: SPEC,
        sourceType: "examQuestion",
        sourceId: contentId,
        outcome: "correct",
        studentId,
        createdAt: baseTime,
        _id: new mongoose.Types.ObjectId(),
      },
    ];

    mockAggregateFromAttempts(attempts);
    await aggregatePerformanceByQuestion(SPEC);

    const pipelines = PracticeAttempt.aggregate.mock.calls.map((call) => call[0]);
    const matchStages = pipelines.map((p) => p.find((s) => s.$match)?.$match);
    for (const match of matchStages) {
      expect(match).toEqual({
        specKey: SPEC,
        contentType: PERFORMANCE_CONTENT_TYPE,
        contentId: { $ne: null },
        studentId: { $ne: null },
        isCorrect: { $type: "bool" },
      });
    }

    const rows = await aggregatePerformanceByQuestion(SPEC);
    expect(rows).toHaveLength(1);
    expect(rows[0].contentType).toBe("quiz_mcq");
    expect(String(rows[0].contentId)).toBe(String(contentId));
    expect(rows[0].uniqueStudents).toBe(1);
    expect(rows[0].rawAttemptCount).toBe(1);
  });

  test("latest-per-student uses latest createdAt and does not overweight repeats", async () => {
    const olderId = new mongoose.Types.ObjectId("000000000000000000000001");
    const newerId = new mongoose.Types.ObjectId("000000000000000000000002");
    const attempts = [
      {
        _id: olderId,
        specKey: SPEC,
        contentType: "quiz_mcq",
        contentId,
        studentId,
        isCorrect: true,
        createdAt: new Date("2026-01-01T12:00:00.000Z"),
      },
      {
        _id: newerId,
        specKey: SPEC,
        contentType: "quiz_mcq",
        contentId,
        studentId,
        isCorrect: false,
        createdAt: new Date("2026-01-02T12:00:00.000Z"),
      },
    ];

    mockAggregateFromAttempts(attempts);
    const rows = await aggregatePerformanceByQuestion(SPEC);

    expect(rows).toHaveLength(1);
    expect(rows[0].uniqueStudents).toBe(1);
    expect(rows[0].rawAttemptCount).toBe(2);
    expect(rows[0].correctStudents).toBe(0);
    expect(rows[0].successRate).toBe(0);
  });

  test("latest-per-student pipeline sorts by createdAt then _id for stable tie-break", async () => {
    mockAggregateFromAttempts([]);
    await aggregatePerformanceByQuestion(SPEC);

    const latestPipeline = PracticeAttempt.aggregate.mock.calls[1][0];
    const sortStage = latestPipeline.find((s) => s.$sort);
    expect(sortStage.$sort).toEqual({ createdAt: -1, _id: -1 });
  });
});

describe("buildQuestionIntelligence integration patches", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("NO_MARK_SCHEME emitted for safely attributable exam without mark scheme", async () => {
    const examId = new mongoose.Types.ObjectId();
    setupBuildMocks({
      examRows: [
        {
          _id: examId,
          topicKey: "cell-structure",
          questionMode: "single",
          markScheme: [],
        },
      ],
    });

    const report = await buildQuestionIntelligence({ specKey: SPEC });
    expect(report.reviewCandidates).toHaveLength(1);
    expect(report.reviewCandidates[0].signal).toBe("NO_MARK_SCHEME");
    expect(report.reviewCandidates[0].classification).toBe("REVIEW_CANDIDATE");
    expect(report.reviewCandidates[0].questionKey.contentId).toBe(String(examId));
  });

  test("valid mark scheme does not emit NO_MARK_SCHEME", async () => {
    const examId = new mongoose.Types.ObjectId();
    setupBuildMocks({
      examRows: [
        {
          _id: examId,
          topicKey: "cell-structure",
          questionMode: "single",
          markScheme: ["Award 1 mark for correct point"],
        },
      ],
    });

    const report = await buildQuestionIntelligence({ specKey: SPEC });
    expect(report.reviewCandidates).toHaveLength(0);
  });

  test("wrong-spec structural content is not emitted", async () => {
    setupBuildMocks({
      quizRows: [
        {
          _id: new mongoose.Types.ObjectId(),
          topicKey: "edexcel-igcse-biology:cell-structure",
          specKey: "edexcel-igcse-biology",
        },
      ],
      examRows: [
        {
          _id: new mongoose.Types.ObjectId(),
          topicKey: "edexcel-igcse-biology:cell-structure",
          questionMode: "single",
          markScheme: [],
        },
      ],
    });

    const report = await buildQuestionIntelligence({ specKey: SPEC });
    expect(report.reviewCandidates).toHaveLength(0);
  });

  test("limit is applied after deterministic candidate sorting", async () => {
    setupBuildMocks({
      quizRows: [
        {
          _id: new mongoose.Types.ObjectId("000000000000000000000011"),
          topicKey: "",
          specKey: SPEC,
        },
        {
          _id: new mongoose.Types.ObjectId("000000000000000000000012"),
          topicKey: "",
          specKey: SPEC,
        },
      ],
      examRows: [
        {
          _id: new mongoose.Types.ObjectId("000000000000000000000013"),
          topicKey: "cell-structure",
          questionMode: "single",
          markScheme: [],
        },
      ],
    });

    const report = await buildQuestionIntelligence({ specKey: SPEC, limit: 2 });
    expect(report.reviewCandidates).toHaveLength(2);
    expect(report.reviewCandidates.map((c) => c.signal)).toEqual(["NO_TOPIC_LINK", "NO_TOPIC_LINK"]);
    expect(report.reviewCandidates.some((c) => c.signal === "NO_MARK_SCHEME")).toBe(false);
  });
});

describe("ordering and status", () => {
  test("deterministic signal priority", () => {
    const sorted = sortReviewCandidates([
      {
        signal: "VERY_HIGH_SUCCESS_RATE",
        successRate: 100,
        questionKey: { contentType: "quiz_mcq", contentId: "b" },
      },
      {
        signal: "NO_TOPIC_LINK",
        successRate: null,
        questionKey: { contentType: "quiz_mcq", contentId: "a" },
      },
      {
        signal: "VERY_LOW_SUCCESS_RATE",
        successRate: 5,
        questionKey: { contentType: "quiz_mcq", contentId: "c" },
      },
    ]);
    expect(sorted.map((c) => c.signal)).toEqual([
      "NO_TOPIC_LINK",
      "VERY_LOW_SUCCESS_RATE",
      "VERY_HIGH_SUCCESS_RATE",
    ]);
  });

  test("buildQuestionIntelligence status AMBER when candidate exists", async () => {
    adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue(TAXONOMY);
    PracticeAttempt.aggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    TopicQuizQuestion.find.mockReturnValue(
      mockFindChain([
        {
          _id: new mongoose.Types.ObjectId(),
          topicKey: "",
          specKey: SPEC,
        },
      ])
    );
    ExamQuestion.find.mockReturnValue(mockFindChain([]));

    const report = await buildQuestionIntelligence({ specKey: SPEC });
    expect(report.summary.overallStatus).toBe("AMBER");
    expect(report.summary.humanReviewRequired).toBe(true);
    expect(report.reviewCandidates[0].classification).toBe("REVIEW_CANDIDATE");
    expect(assertValidSpecKey).toHaveBeenCalledWith(SPEC);
  });

  test("GREEN when evaluated performance exists and no candidates", async () => {
    adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue(TAXONOMY);
    const qid = new mongoose.Types.ObjectId();
    PracticeAttempt.aggregate
      .mockResolvedValueOnce([{ _id: { contentType: "quiz_mcq", contentId: qid }, rawAttemptCount: 30 }])
      .mockResolvedValueOnce([
        {
          _id: { contentType: "quiz_mcq", contentId: qid },
          uniqueStudents: 12,
          correctStudents: 8,
        },
      ]);
    TopicQuizQuestion.find.mockReturnValue(
      mockFindChain([{ _id: qid, topicKey: "cell-structure", specKey: SPEC }])
    );
    ExamQuestion.find.mockReturnValue(mockFindChain([]));

    const report = await buildQuestionIntelligence({ specKey: SPEC });
    expect(report.summary.overallStatus).toBe("GREEN");
    expect(report.summary.humanReviewRequired).toBe(false);
    expect(report.eligiblePerformanceQuestionCount).toBe(1);
  });

  test("UNKNOWN when no candidates and no eligible performance", async () => {
    adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue(TAXONOMY);
    PracticeAttempt.aggregate.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    TopicQuizQuestion.find.mockReturnValue(mockFindChain([]));
    ExamQuestion.find.mockReturnValue(mockFindChain([]));

    const report = await buildQuestionIntelligence({ specKey: SPEC });
    expect(report.summary.overallStatus).toBe("UNKNOWN");
    expect(report.summary.humanReviewRequired).toBe(true);
  });
});

describe("integration response privacy", () => {
  test("response JSON has no student identifiers", async () => {
    adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue(TAXONOMY);
    const qid = new mongoose.Types.ObjectId();
    PracticeAttempt.aggregate
      .mockResolvedValueOnce([{ _id: { contentType: "quiz_mcq", contentId: qid }, rawAttemptCount: 30 }])
      .mockResolvedValueOnce([
        {
          _id: { contentType: "quiz_mcq", contentId: qid },
          uniqueStudents: 10,
          correctStudents: 1,
        },
      ]);
    TopicQuizQuestion.find.mockReturnValue(
      mockFindChain([{ _id: qid, topicKey: "cell-structure", specKey: SPEC }])
    );
    ExamQuestion.find.mockReturnValue(mockFindChain([]));

    const report = await buildQuestionIntelligence({ specKey: SPEC });
    const json = JSON.stringify(report);
    expect(json).not.toMatch(/studentId/);
    expect(json).not.toMatch(/userId/);
    expect(json).not.toMatch(/selectedChoiceIndex/);
    expect(report.privacy.minStudentsForPerformance).toBe(MIN_STUDENTS_FOR_PERFORMANCE);
    expect(report.privacy.minRawAttemptsForPerformance).toBe(MIN_RAW_ATTEMPTS_FOR_PERFORMANCE);
  });
});
