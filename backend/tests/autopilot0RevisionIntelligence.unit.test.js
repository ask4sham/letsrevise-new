/**
 * Autopilot 0 Revision Intelligence V1 — unit tests (mastery parity, privacy, classification).
 */
const fs = require("fs");
const path = require("path");

const SERVICE_PATH = path.join(
  __dirname,
  "..",
  "services",
  "autopilot0",
  "revisionIntelligenceService.js"
);
const serviceSource = fs.readFileSync(SERVICE_PATH, "utf8");

const {
  VERSION,
  LEVEL,
  WEAK_THRESHOLD,
  MIN_STUDENTS_FOR_TOPIC,
  MIN_ATTEMPTS_FOR_TOPIC,
  computeMasteryFromCounts,
  hasCalculableMastery,
  isWeakMastery,
  classifyConfidence,
  studentSampleBand,
  formatStudentsWithEvidence,
  buildTopicAliasMap,
  resolveCanonicalTopicKey,
  rollupTopicMetrics,
  normalizeUserTopicRows,
  mergeUserTopicRow,
  sortTopicWeakness,
  sortCrossSignals,
  buildRevisionIntelligence,
} = require("../services/autopilot0/revisionIntelligenceService");

jest.mock("../models/LearningEvidenceEvent", () => ({
  aggregate: jest.fn().mockResolvedValue([]),
  find: jest.fn(),
}));
jest.mock("../models/Lesson", () => ({ aggregate: jest.fn().mockResolvedValue([]) }));
jest.mock("../models/TopicFlashcard", () => ({ aggregate: jest.fn().mockResolvedValue([]) }));
jest.mock("../models/TopicQuizQuestion", () => ({ aggregate: jest.fn().mockResolvedValue([]) }));
jest.mock("../models/ExamQuestion", () => ({ aggregate: jest.fn().mockResolvedValue([]) }));
jest.mock("../services/adminTaxonomyService", () => ({
  getMergedTaxonomyBySpecKey: jest.fn(),
}));
jest.mock("../utils/specTopicValidation", () => ({
  assertValidSpecKey: jest.fn(),
}));

const LearningEvidenceEvent = require("../models/LearningEvidenceEvent");
const Lesson = require("../models/Lesson");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const adminTaxonomyService = require("../services/adminTaxonomyService");
const { assertValidSpecKey } = require("../utils/specTopicValidation");
const studentTopicEvidenceService = require("../services/studentTopicEvidenceService");

const SPEC = "aqa-gcse-biology";
const TOPIC_SLUG = "cell-structure";
const CANONICAL_TOPIC = `${SPEC}:${TOPIC_SLUG}`;

const TAXONOMY = {
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

function eventsFromCounts(quizAttempts, quizCorrect, examAttempts, examCorrect) {
  const events = [];
  for (let i = 0; i < quizAttempts; i += 1) {
    events.push({ eventType: "quiz_attempt", correct: i < quizCorrect });
  }
  for (let i = 0; i < examAttempts; i += 1) {
    events.push({ eventType: "exam_question_attempt", correct: i < examCorrect });
  }
  return events;
}

async function canonicalMasteryFromProductionService(events, userId = "parity-user-1") {
  LearningEvidenceEvent.find.mockReturnValue({
    lean: jest.fn().mockResolvedValue(events),
  });
  const evidence = await studentTopicEvidenceService.getTopicLearningEvidence(
    SPEC,
    TOPIC_SLUG,
    userId
  );
  return evidence.derivedMetrics.masteryScore;
}

function makeUserRows(topicKey, users) {
  return users.map((u, idx) => ({
    userId: `user-${idx}`,
    topicKey,
    quizAttempts: u.quizAttempts || 0,
    quizCorrect: u.quizCorrect || 0,
    examAttempts: u.examAttempts || 0,
    examCorrect: u.examCorrect || 0,
  }));
}

describe("revisionIntelligenceService contract constants", () => {
  test("version exact", () => {
    expect(VERSION).toBe("autopilot0-revision-intelligence-v1");
  });

  test("L0 exact", () => {
    expect(LEVEL).toBe("L0");
  });
});

describe("canonical mastery parity against production studentTopicEvidenceService", () => {
  test("quiz only", async () => {
    const events = eventsFromCounts(4, 3, 0, 0);
    const canonical = await canonicalMasteryFromProductionService(events);
    expect(computeMasteryFromCounts(4, 3, 0, 0)).toBe(canonical);
    expect(canonical).toBe(75);
  });

  test("exam only", async () => {
    const events = eventsFromCounts(0, 0, 5, 2);
    const canonical = await canonicalMasteryFromProductionService(events);
    expect(computeMasteryFromCounts(0, 0, 5, 2)).toBe(canonical);
    expect(canonical).toBe(40);
  });

  test("quiz + exam equal weighting (not pooled attempt ratio)", async () => {
    const events = eventsFromCounts(10, 9, 1, 1);
    const canonical = await canonicalMasteryFromProductionService(events);
    expect(computeMasteryFromCounts(10, 9, 1, 1)).toBe(canonical);
    expect(canonical).toBe(95);
    expect(canonical).not.toBe(Math.round((10 / 11) * 100));
  });

  test("later incorrect evidence can reduce mastery", async () => {
    const beforeEvents = eventsFromCounts(2, 2, 0, 0);
    const afterEvents = eventsFromCounts(4, 2, 0, 0);
    const before = await canonicalMasteryFromProductionService(beforeEvents);
    const after = await canonicalMasteryFromProductionService(afterEvents);
    expect(computeMasteryFromCounts(2, 2, 0, 0)).toBe(before);
    expect(computeMasteryFromCounts(4, 2, 0, 0)).toBe(after);
    expect(before).toBe(100);
    expect(after).toBe(50);
  });

  test("mastery edge 69 is weak", () => {
    expect(isWeakMastery(69)).toBe(true);
    expect(isWeakMastery(computeMasteryFromCounts(100, 69, 0, 0))).toBe(true);
  });

  test("mastery edge 70 is not weak", () => {
    expect(isWeakMastery(70)).toBe(false);
    expect(isWeakMastery(71)).toBe(false);
  });

  test("null correct values do not count as correct", async () => {
    const events = [
      { eventType: "quiz_attempt", correct: null },
      { eventType: "quiz_attempt", correct: true },
    ];
    const canonical = await canonicalMasteryFromProductionService(events);
    expect(computeMasteryFromCounts(2, 1, 0, 0)).toBe(canonical);
    expect(canonical).toBe(50);
  });
});

describe("privacy and confidence", () => {
  test("<5 students topic suppressed", () => {
    const users = Array.from({ length: 4 }, () => ({
      quizAttempts: 3,
      quizCorrect: 1,
      examAttempts: 0,
      examCorrect: 0,
    }));
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    const rows = normalizeUserTopicRows(
      SPEC,
      makeUserRows("cell-structure", users),
      aliasToCanonical
    );
    const { topics, suppressedTopicCount } = rollupTopicMetrics(rows);
    expect(topics).toHaveLength(0);
    expect(suppressedTopicCount).toBe(1);
  });

  test("<10 attempts topic suppressed", () => {
    const users = Array.from({ length: 6 }, () => ({
      quizAttempts: 1,
      quizCorrect: 0,
      examAttempts: 0,
      examCorrect: 0,
    }));
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    const rows = normalizeUserTopicRows(
      SPEC,
      makeUserRows("cell-structure", users),
      aliasToCanonical
    );
    const { topics } = rollupTopicMetrics(rows);
    expect(topics).toHaveLength(0);
  });

  test("5-9 students returns sample band but not exact student count", () => {
    expect(studentSampleBand(7)).toBe("5-9");
    expect(formatStudentsWithEvidence(7)).toBeNull();
  });

  test(">=10 may return exact aggregate count", () => {
    expect(studentSampleBand(12)).toBe("10-19");
    expect(formatStudentsWithEvidence(12)).toBe(12);
  });

  test("LOW confidence", () => {
    expect(classifyConfidence(8, 15)).toBe("LOW");
  });

  test("SUFFICIENT_SAMPLE confidence", () => {
    expect(classifyConfidence(8, 25)).toBe("SUFFICIENT_SAMPLE");
  });

  test("HIGH_CONFIDENCE", () => {
    expect(classifyConfidence(25, 120)).toBe("HIGH_CONFIDENCE");
  });

  test("exact privacy and confidence edges", () => {
    const users4 = Array.from({ length: 4 }, () => ({
      quizAttempts: 25,
      quizCorrect: 5,
      examAttempts: 0,
      examCorrect: 0,
    }));
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    expect(rollupTopicMetrics(normalizeUserTopicRows(SPEC, makeUserRows("cell-structure", users4), aliasToCanonical)).topics).toHaveLength(0);

    const users5lowAttempts = Array.from({ length: 5 }, () => ({
      quizAttempts: 1,
      quizCorrect: 0,
      examAttempts: 0,
      examCorrect: 0,
    }));
    expect(
      rollupTopicMetrics(
        normalizeUserTopicRows(SPEC, makeUserRows("cell-structure", users5lowAttempts), aliasToCanonical)
      ).topics
    ).toHaveLength(0);

    const users5min = Array.from({ length: 5 }, () => ({
      quizAttempts: 2,
      quizCorrect: 1,
      examAttempts: 0,
      examCorrect: 0,
    }));
    const included = rollupTopicMetrics(
      normalizeUserTopicRows(SPEC, makeUserRows("cell-structure", users5min), aliasToCanonical)
    );
    expect(included.topics).toHaveLength(1);
    expect(included.topics[0].confidence).toBe("LOW");

    expect(classifyConfidence(5, 19)).toBe("LOW");
    expect(classifyConfidence(5, 20)).toBe("SUFFICIENT_SAMPLE");
    expect(classifyConfidence(19, 100)).toBe("SUFFICIENT_SAMPLE");
    expect(classifyConfidence(20, 99)).toBe("SUFFICIENT_SAMPLE");
    expect(classifyConfidence(20, 100)).toBe("HIGH_CONFIDENCE");
  });
});

describe("weakRate calculation and ordering", () => {
  test("weakRate calculation", () => {
    const users = [
      { quizAttempts: 2, quizCorrect: 2, examAttempts: 0, examCorrect: 0 },
      { quizAttempts: 2, quizCorrect: 0, examAttempts: 0, examCorrect: 0 },
      { quizAttempts: 2, quizCorrect: 0, examAttempts: 0, examCorrect: 0 },
      { quizAttempts: 2, quizCorrect: 0, examAttempts: 0, examCorrect: 0 },
      { quizAttempts: 2, quizCorrect: 0, examAttempts: 0, examCorrect: 0 },
      { quizAttempts: 2, quizCorrect: 2, examAttempts: 0, examCorrect: 0 },
    ];
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    const rows = normalizeUserTopicRows(
      SPEC,
      makeUserRows("cell-structure", users),
      aliasToCanonical
    );
    const { topics } = rollupTopicMetrics(rows);
    expect(topics).toHaveLength(1);
    expect(topics[0].weakRate).toBeCloseTo(4 / 6, 3);
    expect(topics[0].averageMastery).toBe(Math.round((100 + 0 + 0 + 0 + 0 + 100) / 6));
  });

  test("averageMastery uses per-student canonical mastery not global attempt ratio", () => {
    const users = [
      { quizAttempts: 10, quizCorrect: 9, examAttempts: 1, examCorrect: 1 },
      { quizAttempts: 10, quizCorrect: 0, examAttempts: 1, examCorrect: 0 },
      { quizAttempts: 10, quizCorrect: 9, examAttempts: 1, examCorrect: 1 },
      { quizAttempts: 10, quizCorrect: 0, examAttempts: 1, examCorrect: 0 },
      { quizAttempts: 10, quizCorrect: 9, examAttempts: 1, examCorrect: 1 },
      { quizAttempts: 10, quizCorrect: 0, examAttempts: 1, examCorrect: 0 },
    ];
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    const rows = normalizeUserTopicRows(SPEC, makeUserRows("cell-structure", users), aliasToCanonical);
    const { topics } = rollupTopicMetrics(rows);
    const perStudentAverage = Math.round((95 + 0 + 95 + 0 + 95 + 0) / 6);
    const globalRatio = Math.round(((9 + 0 + 9 + 0 + 9 + 0 + 3) / 66) * 100);
    expect(topics[0].averageMastery).toBe(perStudentAverage);
    expect(topics[0].averageMastery).not.toBe(globalRatio);
  });

  test("weakRate excludes students without calculable mastery", () => {
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    const rows = normalizeUserTopicRows(
      SPEC,
      [
        ...makeUserRows("cell-structure", Array.from({ length: 5 }, () => ({
          quizAttempts: 2,
          quizCorrect: 0,
          examAttempts: 0,
          examCorrect: 0,
        }))),
        {
          userId: "lesson-only",
          topicKey: "cell-structure",
          quizAttempts: 0,
          quizCorrect: 0,
          examAttempts: 0,
          examCorrect: 0,
        },
      ],
      aliasToCanonical
    );
    const { topics } = rollupTopicMetrics(rows);
    expect(topics).toHaveLength(1);
    expect(topics[0].weakRate).toBe(1);
  });

  test("deterministic topic ordering", () => {
    const ordered = sortTopicWeakness([
      { topicKey: `${SPEC}:b-topic`, weakRate: 0.5, attemptCount: 20 },
      { topicKey: `${SPEC}:a-topic`, weakRate: 0.8, attemptCount: 10 },
      { topicKey: `${SPEC}:c-topic`, weakRate: 0.8, attemptCount: 30 },
    ]);
    expect(ordered.map((t) => t.topicKey)).toEqual([
      `${SPEC}:c-topic`,
      `${SPEC}:a-topic`,
      `${SPEC}:b-topic`,
    ]);
  });
});

describe("topic key normalisation", () => {
  test("alias topic keys normalise to one canonical topic", () => {
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    const rows = normalizeUserTopicRows(
      SPEC,
      [
        {
          userId: "u1",
          topicKey: "cell-structure",
          quizAttempts: 2,
          quizCorrect: 1,
          examAttempts: 0,
          examCorrect: 0,
        },
        {
          userId: "u2",
          topicKey: `${SPEC}:cell-structure`,
          quizAttempts: 2,
          quizCorrect: 1,
          examAttempts: 0,
          examCorrect: 0,
        },
      ],
      aliasToCanonical
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.canonicalTopicKey))).toEqual(
      new Set([`${SPEC}:cell-structure`])
    );
  });

  test("no duplicate canonical topic rows after rollup", () => {
    const users = Array.from({ length: 6 }, () => ({
      quizAttempts: 2,
      quizCorrect: 1,
      examAttempts: 0,
      examCorrect: 0,
    }));
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    const rows = normalizeUserTopicRows(
      SPEC,
      makeUserRows("cell-structure", users),
      aliasToCanonical
    );
    const { topics } = rollupTopicMetrics(rows);
    expect(topics).toHaveLength(1);
  });

  test("mergeUserTopicRow combines counts", () => {
    const target = { quizAttempts: 1, quizCorrect: 1, examAttempts: 1, examCorrect: 0 };
    mergeUserTopicRow(target, { quizAttempts: 2, quizCorrect: 1, examAttempts: 1, examCorrect: 1 });
    expect(target).toEqual({ quizAttempts: 3, quizCorrect: 2, examAttempts: 2, examCorrect: 1 });
  });

  test("resolveCanonicalTopicKey handles namespaced key", () => {
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    expect(resolveCanonicalTopicKey(SPEC, `${SPEC}:cell-structure`, aliasToCanonical)).toBe(
      `${SPEC}:cell-structure`
    );
  });

  test("unknown raw topic key is excluded", () => {
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    const rows = normalizeUserTopicRows(
      SPEC,
      [
        {
          userId: "u1",
          topicKey: "totally-unknown-topic",
          quizAttempts: 5,
          quizCorrect: 1,
          examAttempts: 0,
          examCorrect: 0,
        },
      ],
      aliasToCanonical
    );
    expect(rows).toHaveLength(0);
  });

  test("cross-spec namespaced key is excluded", () => {
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    expect(
      resolveCanonicalTopicKey(SPEC, "edexcel-igcse-biology:cell-structure", aliasToCanonical)
    ).toBeNull();
  });
});

describe("cross-signal selection helpers", () => {
  test("sortCrossSignals deterministic", () => {
    const ordered = sortCrossSignals([
      { topicKey: `${SPEC}:b`, coverageScore: 80, averageMastery: 40 },
      { topicKey: `${SPEC}:a`, coverageScore: 90, averageMastery: 50 },
      { topicKey: `${SPEC}:c`, coverageScore: 90, averageMastery: 30 },
    ]);
    expect(ordered[0].topicKey).toBe(`${SPEC}:c`);
    expect(ordered[1].topicKey).toBe(`${SPEC}:a`);
  });
});

describe("buildRevisionIntelligence integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assertValidSpecKey.mockImplementation(() => true);
    adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue(TAXONOMY);
    LearningEvidenceEvent.aggregate.mockResolvedValue([]);
    Lesson.aggregate.mockResolvedValue([]);
    TopicFlashcard.aggregate.mockResolvedValue([]);
    TopicQuizQuestion.aggregate.mockResolvedValue([]);
    ExamQuestion.aggregate.mockResolvedValue([]);
  });

  test("UNKNOWN when no sufficient evidence", async () => {
    const report = await buildRevisionIntelligence({ specKey: SPEC });
    expect(report.summary.overallStatus).toBe("UNKNOWN");
    expect(report.summary.humanReviewRequired).toBe(true);
    expect(report.topicWeakness).toEqual([]);
    expect(report.contentLearningCrossSignals).toEqual([]);
    expect(report.cohort.cohortScope).toBe("SPEC_ONLY");
    expect(report.cohort.tierSupported).toBe(false);
    expect(report.cohort.tier).toBeNull();
    expect(report.mastery.source).toBe("LearningEvidenceEvent");
    expect(report.mastery.policy).toBe("student-topic-evidence");
    expect(report.mastery.weakThreshold).toBe(WEAK_THRESHOLD);
  });

  test("GREEN when sufficient evidence and no cross-signal", async () => {
    const users = Array.from({ length: 6 }, () => ({
      quizAttempts: 4,
      quizCorrect: 4,
      examAttempts: 0,
      examCorrect: 0,
    }));
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      users.map((u, idx) => ({
        _id: { userId: `u${idx}`, topicKey: "cell-structure" },
        quizAttempts: u.quizAttempts,
        quizCorrect: u.quizCorrect,
        examAttempts: 0,
        examCorrect: 0,
      }))
    );
  Lesson.aggregate.mockResolvedValue([{ _id: "cell-structure", count: 1 }]);
  TopicFlashcard.aggregate.mockResolvedValue([{ _id: "cell-structure", count: 5 }]);
  TopicQuizQuestion.aggregate.mockResolvedValue([{ _id: "cell-structure", count: 3 }]);
  ExamQuestion.aggregate.mockResolvedValue([{ _id: "cell-structure", count: 2 }]);

    const report = await buildRevisionIntelligence({ specKey: SPEC, limit: 20 });
    expect(report.topicWeakness.length).toBeGreaterThan(0);
    expect(report.contentLearningCrossSignals).toEqual([]);
    expect(report.summary.overallStatus).toBe("GREEN");
    expect(report.summary.humanReviewRequired).toBe(false);
  });

  test("no cross-signal if coverage <70", async () => {
    const users = Array.from({ length: 6 }, () => ({
      quizAttempts: 4,
      quizCorrect: 1,
      examAttempts: 0,
      examCorrect: 0,
    }));
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      users.map((u, idx) => ({
        _id: { userId: `u${idx}`, topicKey: "cell-structure" },
        quizAttempts: u.quizAttempts,
        quizCorrect: u.quizCorrect,
        examAttempts: 0,
        examCorrect: 0,
      }))
    );
    Lesson.aggregate.mockResolvedValue([]);
    TopicFlashcard.aggregate.mockResolvedValue([]);
    TopicQuizQuestion.aggregate.mockResolvedValue([]);
    ExamQuestion.aggregate.mockResolvedValue([]);

    const report = await buildRevisionIntelligence({ specKey: SPEC });
    expect(report.contentLearningCrossSignals).toEqual([]);
  });

  test("no cross-signal if mastery >=70", async () => {
    const users = Array.from({ length: 6 }, () => ({
      quizAttempts: 4,
      quizCorrect: 4,
      examAttempts: 0,
      examCorrect: 0,
    }));
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      users.map((u, idx) => ({
        _id: { userId: `u${idx}`, topicKey: "cell-structure" },
        quizAttempts: u.quizAttempts,
        quizCorrect: u.quizCorrect,
        examAttempts: 0,
        examCorrect: 0,
      }))
    );
    Lesson.aggregate.mockResolvedValue([{ _id: "cell-structure", count: 1 }]);
    TopicFlashcard.aggregate.mockResolvedValue([{ _id: "cell-structure", count: 5 }]);
    TopicQuizQuestion.aggregate.mockResolvedValue([{ _id: "cell-structure", count: 3 }]);
    ExamQuestion.aggregate.mockResolvedValue([{ _id: "cell-structure", count: 2 }]);

    const report = await buildRevisionIntelligence({ specKey: SPEC });
    expect(report.contentLearningCrossSignals).toEqual([]);
  });

  test("AMBER overall when cross-signal exists", async () => {
    const users = Array.from({ length: 6 }, () => ({
      quizAttempts: 4,
      quizCorrect: 1,
      examAttempts: 0,
      examCorrect: 0,
    }));
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      users.map((u, idx) => ({
        _id: { userId: `u${idx}`, topicKey: "cell-structure" },
        quizAttempts: u.quizAttempts,
        quizCorrect: u.quizCorrect,
        examAttempts: 0,
        examCorrect: 0,
      }))
    );
    Lesson.aggregate.mockResolvedValue([{ _id: "cell-structure", count: 1 }]);
    TopicFlashcard.aggregate.mockResolvedValue([{ _id: "cell-structure", count: 5 }]);
    TopicQuizQuestion.aggregate.mockResolvedValue([{ _id: "cell-structure", count: 3 }]);
    ExamQuestion.aggregate.mockResolvedValue([{ _id: "cell-structure", count: 2 }]);

    const report = await buildRevisionIntelligence({ specKey: SPEC });
    expect(report.contentLearningCrossSignals.length).toBeGreaterThan(0);
    expect(report.contentLearningCrossSignals[0].signal).toBe("HIGH_CONTENT_LOW_MASTERY");
    expect(report.contentLearningCrossSignals[0].status).toBe("AMBER");
    expect(report.summary.overallStatus).toBe("AMBER");
    expect(report.summary.humanReviewRequired).toBe(true);
  });

  test("evidence aggregate filters to quiz/exam only for requested specKey", async () => {
    await buildRevisionIntelligence({ specKey: SPEC });
    expect(LearningEvidenceEvent.aggregate).toHaveBeenCalled();
    const pipeline = LearningEvidenceEvent.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match.specKey).toBe(SPEC);
    expect(pipeline[0].$match.eventType.$in).toEqual([
      "quiz_attempt",
      "exam_question_attempt",
    ]);
  });

  test("invalid spec throws INVALID_SPEC_KEY", async () => {
    assertValidSpecKey.mockImplementation(() => {
      const err = new Error("Unknown specKey: bad-spec");
      err.code = "INVALID_SPEC_KEY";
      throw err;
    });
    await expect(buildRevisionIntelligence({ specKey: "bad-spec" })).rejects.toMatchObject({
      code: "INVALID_SPEC_KEY",
    });
  });
});

describe("static safety", () => {
  test("no write-capable source patterns", () => {
    expect(serviceSource).not.toMatch(/\.save\(/);
    expect(serviceSource).not.toMatch(/\.create\(/);
    expect(serviceSource).not.toMatch(/\.insert/);
    expect(serviceSource).not.toMatch(/\.update\(/);
    expect(serviceSource).not.toMatch(/\.delete\(/);
    expect(serviceSource).not.toMatch(/findOneAndUpdate/);
    expect(serviceSource).not.toMatch(/bulkWrite/);
    expect(serviceSource).not.toMatch(/enqueue/);
  });

  test("no external/subprocess patterns", () => {
    expect(serviceSource).not.toMatch(/child_process/);
    expect(serviceSource).not.toMatch(/spawn\(/);
    expect(serviceSource).not.toMatch(/exec\(/);
    expect(serviceSource).not.toMatch(/npm audit/);
    expect(serviceSource).not.toMatch(/openai/i);
    expect(serviceSource).not.toMatch(/axios/);
    expect(serviceSource).not.toMatch(/fetch\(/);
  });

  test("hasCalculableMastery requires at least one quiz/exam attempt", () => {
    expect(hasCalculableMastery(0, 0, null)).toBe(false);
    expect(hasCalculableMastery(1, 0, 50)).toBe(true);
  });
});
