/**
 * Autopilot 0 Revision Outcome Intelligence V1 — unit tests.
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const SERVICE_PATH = path.join(
  __dirname,
  "..",
  "services",
  "autopilot0",
  "revisionOutcomeIntelligenceService.js"
);
const serviceSource = fs.readFileSync(SERVICE_PATH, "utf8");

const {
  VERSION,
  LEVEL,
  WEAK_MASTERY_THRESHOLD,
  classifyTopicOutcome,
  computeTopicOutcome,
  sortTopicOutcomes,
  computeOverallStatus,
  buildRevisionOutcomeIntelligence,
} = require("../services/autopilot0/revisionOutcomeIntelligenceService");
const {
  LOOKBACK_DAYS,
  WINDOW_DAYS,
  MIN_PAIRED_STUDENTS,
  MIN_EARLIER_ATTEMPTS,
  MIN_RECENT_ATTEMPTS,
  IMPROVING_THRESHOLD_PP,
  DECLINING_THRESHOLD_PP,
  QUIZ_EXAM_EVENT_TYPES,
  pairedStudentSampleBand,
  computeWindowCutoffs,
  classifyEventWindow,
  classifyTrendLabel,
  mergeAggregatedRowsByCanonicalTopic,
  buildTopicWindowMaps,
  masteryFromCountRow,
} = require("../services/autopilot0/learningTrendIntelligenceService");
const {
  computeMasteryFromCounts,
  buildTopicAliasMap,
} = require("../services/autopilot0/revisionIntelligenceService");

jest.mock("../models/LearningEvidenceEvent", () => ({ aggregate: jest.fn() }));
jest.mock("../services/adminTaxonomyService", () => ({
  getMergedTaxonomyBySpecKey: jest.fn(),
}));
jest.mock("../utils/specTopicValidation", () => ({
  assertValidSpecKey: jest.fn(),
}));

const LearningEvidenceEvent = require("../models/LearningEvidenceEvent");
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

function topicDataFromRows(rows, canonicalTopicKey = CANONICAL) {
  const merged = mergeAggregatedRowsByCanonicalTopic(
    rows,
    SPEC,
    buildTopicAliasMap(SPEC, TAXONOMY).aliasToCanonical
  );
  const maps = buildTopicWindowMaps(merged);
  return maps.get(canonicalTopicKey);
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

describe("revisionOutcomeIntelligenceService contract", () => {
  test("version and level", () => {
    expect(VERSION).toBe("autopilot0-revision-outcome-intelligence-v1");
    expect(LEVEL).toBe("L0");
    expect(WEAK_MASTERY_THRESHOLD).toBe(70);
  });

  test("service uses LearningEvidenceEvent only", () => {
    expect(serviceSource).toMatch(/LearningEvidenceEvent/);
    expect(serviceSource).not.toMatch(/require\([^)]*PracticeAttempt/);
    expect(serviceSource).not.toMatch(/require\([^)]*TopicMastery/);
    expect(serviceSource).not.toMatch(/require\([^)]*StudentTopicProgress/);
    expect(serviceSource).not.toMatch(/effectiveness/i);
  });

  test("eligible event types are quiz and exam only", () => {
    expect(QUIZ_EXAM_EVENT_TYPES).toEqual(["quiz_attempt", "exam_question_attempt"]);
  });
});

describe("window cutoffs", () => {
  test("computes 90/45 day windows once from fixed now", () => {
    const cutoffs = computeWindowCutoffs(FIXED_NOW);
    expect(cutoffs.generatedAt).toBe(FIXED_NOW.toISOString());
    expect(cutoffs.recentEnd.getTime()).toBe(FIXED_NOW.getTime());
    expect(cutoffs.recentStart.getTime()).toBe(
      FIXED_NOW.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    expect(cutoffs.earlierStart.getTime()).toBe(
      FIXED_NOW.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    );
    expect(cutoffs.earlierEnd.getTime()).toBe(cutoffs.recentStart.getTime());
  });

  test("earlier/recent boundary handling", () => {
    const cutoffs = computeWindowCutoffs(FIXED_NOW);
    expect(classifyEventWindow(cutoffs.earlierStart, cutoffs)).toBe("earlier");
    expect(classifyEventWindow(new Date(cutoffs.recentStart.getTime() - 1), cutoffs)).toBe(
      "earlier"
    );
    expect(classifyEventWindow(cutoffs.recentStart, cutoffs)).toBe("recent");
    expect(classifyEventWindow(cutoffs.recentEnd, cutoffs)).toBe("recent");
  });
});

describe("canonical alias merge before mastery", () => {
  test("merges alias topic keys into one student canonical window", () => {
    const userId = new mongoose.Types.ObjectId();
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    const merged = mergeAggregatedRowsByCanonicalTopic(
      [
        makeAggRow({
          userId,
          topicKey: "cell-structure",
          window: "earlier",
          quizAttempts: 2,
          quizCorrect: 1,
        }),
        makeAggRow({
          userId,
          topicKey: CANONICAL,
          window: "earlier",
          quizAttempts: 3,
          quizCorrect: 2,
        }),
      ],
      SPEC,
      aliasToCanonical
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].quizAttempts).toBe(5);
    expect(masteryFromCountRow(merged[0])).toBe(60);
  });

  test("wrong spec topic excluded", () => {
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    const merged = mergeAggregatedRowsByCanonicalTopic(
      [
        makeAggRow({
          userId: new mongoose.Types.ObjectId(),
          topicKey: "edexcel-igcse-biology:cell-structure",
          window: "earlier",
          quizAttempts: 5,
          quizCorrect: 5,
        }),
      ],
      SPEC,
      aliasToCanonical
    );
    expect(merged).toHaveLength(0);
  });

  test("unresolved topic excluded", () => {
    const { aliasToCanonical } = buildTopicAliasMap(SPEC, TAXONOMY);
    const merged = mergeAggregatedRowsByCanonicalTopic(
      [
        makeAggRow({
          userId: new mongoose.Types.ObjectId(),
          topicKey: "unknown-topic-slug",
          window: "earlier",
          quizAttempts: 5,
          quizCorrect: 5,
        }),
      ],
      SPEC,
      aliasToCanonical
    );
    expect(merged).toHaveLength(0);
  });
});

describe("mastery parity", () => {
  test("quiz-only mastery matches A0.3", () => {
    expect(masteryFromCountRow({ quizAttempts: 4, quizCorrect: 3, examAttempts: 0, examCorrect: 0 })).toBe(
      computeMasteryFromCounts(4, 3, 0, 0)
    );
  });

  test("quiz+exam equal weighting matches A0.3", () => {
    const row = { quizAttempts: 4, quizCorrect: 4, examAttempts: 4, examCorrect: 0 };
    expect(masteryFromCountRow(row)).toBe(computeMasteryFromCounts(4, 4, 4, 0));
    expect(masteryFromCountRow(row)).toBe(50);
  });
});

describe("trend thresholds", () => {
  test("+10 improving boundary", () => {
    expect(classifyTrendLabel(10)).toBe("IMPROVING");
    expect(classifyTrendLabel(9)).toBe("STABLE");
  });

  test("-10 declining boundary", () => {
    expect(classifyTrendLabel(-10)).toBe("DECLINING");
    expect(classifyTrendLabel(-9)).toBe("STABLE");
  });
});

describe("outcome classification precedence", () => {
  test("recent >=70 → NO_LONGER_WEAK", () => {
    expect(classifyTopicOutcome(70, "DECLINING")).toBe("NO_LONGER_WEAK");
    expect(classifyTopicOutcome(85, "IMPROVING")).toBe("NO_LONGER_WEAK");
  });

  test("NO_LONGER_WEAK precedence over trend", () => {
    expect(classifyTopicOutcome(72, "DECLINING")).toBe("NO_LONGER_WEAK");
    expect(classifyTopicOutcome(75, "IMPROVING")).toBe("NO_LONGER_WEAK");
  });

  test("still weak + improving", () => {
    expect(classifyTopicOutcome(55, "IMPROVING")).toBe("WEAK_AND_IMPROVING");
  });

  test("still weak + stable", () => {
    expect(classifyTopicOutcome(50, "STABLE")).toBe("WEAK_AND_STABLE");
  });

  test("still weak + declining", () => {
    expect(classifyTopicOutcome(45, "DECLINING")).toBe("WEAK_AND_DECLINING");
  });
});

describe("paired cohort gates and earlier weakness", () => {
  test("unpaired students excluded", () => {
    const userPaired = new mongoose.Types.ObjectId();
    const userUnpaired = new mongoose.Types.ObjectId();
    const topicData = topicDataFromRows([
      makeAggRow({ userId: userPaired, topicKey: "cell-structure", window: "earlier", quizAttempts: 10, quizCorrect: 4 }),
      makeAggRow({ userId: userPaired, topicKey: "cell-structure", window: "recent", quizAttempts: 10, quizCorrect: 8 }),
      makeAggRow({ userId: userUnpaired, topicKey: "cell-structure", window: "recent", quizAttempts: 10, quizCorrect: 9 }),
    ]);
    const result = computeTopicOutcome(CANONICAL, topicData);
    expect(result.pairedCount).toBe(1);
    expect(result.eligible).toBe(false);
  });

  test("9 paired students insufficient", () => {
    const topicData = topicDataFromRows(pairedStudentRows({ studentCount: 9, attemptsPerWindow: 3 }));
    const result = computeTopicOutcome(CANONICAL, topicData);
    expect(result.eligible).toBe(false);
    expect(result.pairedCount).toBe(9);
  });

  test("10 paired students eligible when earlier weak", () => {
    const topicData = topicDataFromRows(
      pairedStudentRows({ studentCount: 10, earlierMastery: 40, recentMastery: 60, attemptsPerWindow: 3 })
    );
    const result = computeTopicOutcome(CANONICAL, topicData);
    expect(result.eligible).toBe(true);
    expect(result.pairedCount).toBe(10);
    expect(result.earlierAverageMastery).toBeLessThan(70);
    expect(result.outcome).toBe("WEAK_AND_IMPROVING");
  });

  test("earlier exactly 70 is NOT weak", () => {
    const topicData = {
      canonicalTopicKey: CANONICAL,
      earlierByStudent: new Map(),
      recentByStudent: new Map(),
    };
    for (let i = 0; i < 10; i += 1) {
      const sid = `student-${i}`;
      topicData.earlierByStudent.set(sid, {
        quizAttempts: 10,
        quizCorrect: 7,
        examAttempts: 0,
        examCorrect: 0,
      });
      topicData.recentByStudent.set(sid, {
        quizAttempts: 3,
        quizCorrect: 2,
        examAttempts: 0,
        examCorrect: 0,
      });
    }
    const result = computeTopicOutcome(CANONICAL, topicData);
    expect(result.eligible).toBe(false);
    expect(result.notWeakEarlier).toBe(true);
  });

  test("earlier attempt gate suppresses topic", () => {
    const topicData = {
      canonicalTopicKey: CANONICAL,
      earlierByStudent: new Map(),
      recentByStudent: new Map(),
    };
    for (let i = 0; i < 10; i += 1) {
      const sid = `student-${i}`;
      if (i < 9) {
        topicData.earlierByStudent.set(sid, {
          quizAttempts: 1,
          quizCorrect: 0,
          examAttempts: 0,
          examCorrect: 0,
        });
      }
      topicData.recentByStudent.set(sid, {
        quizAttempts: 2,
        quizCorrect: 1,
        examAttempts: 0,
        examCorrect: 0,
      });
    }
    const result = computeTopicOutcome(CANONICAL, topicData);
    expect(result.eligible).toBe(false);
    expect(result.earlierAttempts).toBe(9);
  });

  test("recent attempt gate suppresses topic", () => {
    const topicData = {
      canonicalTopicKey: CANONICAL,
      earlierByStudent: new Map(),
      recentByStudent: new Map(),
    };
    for (let i = 0; i < 10; i += 1) {
      const sid = `student-${i}`;
      topicData.earlierByStudent.set(sid, {
        quizAttempts: 2,
        quizCorrect: 1,
        examAttempts: 0,
        examCorrect: 0,
      });
      if (i < 9) {
        topicData.recentByStudent.set(sid, {
          quizAttempts: 1,
          quizCorrect: 1,
          examAttempts: 0,
          examCorrect: 0,
        });
      }
    }
    const result = computeTopicOutcome(CANONICAL, topicData);
    expect(result.eligible).toBe(false);
    expect(result.recentAttempts).toBe(9);
  });
});

describe("privacy", () => {
  test("paired student sample bands", () => {
    expect(pairedStudentSampleBand(9)).toBeNull();
    expect(pairedStudentSampleBand(15)).toBe("10-19");
    expect(pairedStudentSampleBand(20)).toBe("20+");
  });
});

describe("status semantics", () => {
  test("any still-weak outcome → AMBER", () => {
    expect(
      computeOverallStatus([
        { outcome: "NO_LONGER_WEAK" },
        { outcome: "WEAK_AND_IMPROVING" },
      ])
    ).toBe("AMBER");
    expect(computeOverallStatus([{ outcome: "WEAK_AND_STABLE" }])).toBe("AMBER");
    expect(computeOverallStatus([{ outcome: "WEAK_AND_DECLINING" }])).toBe("AMBER");
  });

  test("all NO_LONGER_WEAK → GREEN", () => {
    expect(
      computeOverallStatus([{ outcome: "NO_LONGER_WEAK" }, { outcome: "NO_LONGER_WEAK" }])
    ).toBe("GREEN");
  });

  test("no eligible weak topics → UNKNOWN", () => {
    expect(computeOverallStatus([])).toBe("UNKNOWN");
  });
});

describe("ordering", () => {
  test("deterministic outcome priority and limit after sort", () => {
    const sorted = sortTopicOutcomes([
      { topicKey: `${SPEC}:z-topic`, outcome: "NO_LONGER_WEAK", medianDeltaPercentagePoints: 30 },
      { topicKey: `${SPEC}:a-topic`, outcome: "WEAK_AND_IMPROVING", medianDeltaPercentagePoints: 20 },
      { topicKey: `${SPEC}:b-topic`, outcome: "WEAK_AND_DECLINING", medianDeltaPercentagePoints: -20 },
      { topicKey: `${SPEC}:c-topic`, outcome: "WEAK_AND_DECLINING", medianDeltaPercentagePoints: -10 },
      { topicKey: `${SPEC}:d-topic`, outcome: "WEAK_AND_STABLE", medianDeltaPercentagePoints: 0 },
    ]);
    expect(sorted.map((r) => r.outcome)).toEqual([
      "WEAK_AND_DECLINING",
      "WEAK_AND_DECLINING",
      "WEAK_AND_STABLE",
      "WEAK_AND_IMPROVING",
      "NO_LONGER_WEAK",
    ]);
    expect(sorted[0].medianDeltaPercentagePoints).toBe(-20);
    expect(sorted[3].medianDeltaPercentagePoints).toBe(20);
    expect(sorted.slice(0, 2).map((r) => r.topicKey)).toEqual([
      `${SPEC}:b-topic`,
      `${SPEC}:c-topic`,
    ]);
  });
});

describe("buildRevisionOutcomeIntelligence integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    adminTaxonomyService.getMergedTaxonomyBySpecKey.mockResolvedValue(TAXONOMY);
  });

  test("still weak declining → AMBER", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      pairedStudentRows({ studentCount: 10, earlierMastery: 40, recentMastery: 20, attemptsPerWindow: 5 })
    );
    const report = await buildRevisionOutcomeIntelligence({ specKey: SPEC, now: FIXED_NOW });
    expect(report.summary.overallStatus).toBe("AMBER");
    expect(report.summary.humanReviewRequired).toBe(true);
    expect(report.topicOutcomes[0].outcome).toBe("WEAK_AND_DECLINING");
    expect(assertValidSpecKey).toHaveBeenCalledWith(SPEC);
  });

  test("still weak improving → AMBER", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      pairedStudentRows({ studentCount: 10, earlierMastery: 40, recentMastery: 55, attemptsPerWindow: 5 })
    );
    const report = await buildRevisionOutcomeIntelligence({ specKey: SPEC, now: FIXED_NOW });
    expect(report.summary.overallStatus).toBe("AMBER");
    expect(report.topicOutcomes[0].outcome).toBe("WEAK_AND_IMPROVING");
  });

  test("all NO_LONGER_WEAK → GREEN", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      pairedStudentRows({ studentCount: 10, earlierMastery: 40, recentMastery: 80, attemptsPerWindow: 5 })
    );
    const report = await buildRevisionOutcomeIntelligence({ specKey: SPEC, now: FIXED_NOW });
    expect(report.summary.overallStatus).toBe("GREEN");
    expect(report.summary.humanReviewRequired).toBe(false);
    expect(report.topicOutcomes[0].outcome).toBe("NO_LONGER_WEAK");
    expect(report.topicOutcomes[0].recentAverageMastery).toBeGreaterThanOrEqual(70);
  });

  test("no eligible weak topics → UNKNOWN", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue([]);
    const report = await buildRevisionOutcomeIntelligence({ specKey: SPEC, now: FIXED_NOW });
    expect(report.summary.overallStatus).toBe("UNKNOWN");
    expect(report.summary.humanReviewRequired).toBe(true);
    expect(report.eligibleOutcomeCount).toBe(0);
  });

  test("response has no student identifiers", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      pairedStudentRows({ studentCount: 10, earlierMastery: 40, recentMastery: 55, attemptsPerWindow: 3 })
    );
    const report = await buildRevisionOutcomeIntelligence({ specKey: SPEC, now: FIXED_NOW });
    const json = JSON.stringify(report);
    expect(json).not.toMatch(/studentId/);
    expect(json).not.toMatch(/userId/);
    expect(report.generatedAt).toBe(FIXED_NOW.toISOString());
    expect(report.windows.lookbackDays).toBe(LOOKBACK_DAYS);
    expect(report.policy.minPairedStudents).toBe(MIN_PAIRED_STUDENTS);
    expect(report.policy.weakMasteryThreshold).toBe(WEAK_MASTERY_THRESHOLD);
  });

  test("limit applied after sorting", async () => {
    const declining = pairedStudentRows({
      studentCount: 10,
      earlierMastery: 60,
      recentMastery: 10,
      attemptsPerWindow: 10,
    });
    const improving = pairedStudentRows({
      studentCount: 10,
      earlierMastery: 30,
      recentMastery: 55,
      attemptsPerWindow: 3,
    }).map((row) => ({
      ...row,
      userId: new mongoose.Types.ObjectId(),
      topicKey: `${SPEC}:cell-division`,
    }));
    LearningEvidenceEvent.aggregate.mockResolvedValue([...declining, ...improving]);
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
    const report = await buildRevisionOutcomeIntelligence({
      specKey: SPEC,
      now: FIXED_NOW,
      limit: 1,
    });
    expect(report.topicOutcomes).toHaveLength(1);
    expect(report.topicOutcomes[0].outcome).toBe("WEAK_AND_DECLINING");
  });

  test("aggregate match requires boolean correct and eligible event types", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue([]);
    await buildRevisionOutcomeIntelligence({ specKey: SPEC, now: FIXED_NOW });
    const pipeline = LearningEvidenceEvent.aggregate.mock.calls[0][0];
    const match = pipeline.find((stage) => stage.$match).$match;
    expect(match.specKey).toBe(SPEC);
    expect(match.eventType.$in).toEqual(QUIZ_EXAM_EVENT_TYPES);
    expect(match.correct).toEqual({ $type: "bool" });
  });

  test("non-weak earlier topic excluded from outcomes", async () => {
    LearningEvidenceEvent.aggregate.mockResolvedValue(
      pairedStudentRows({ studentCount: 10, earlierMastery: 90, recentMastery: 95, attemptsPerWindow: 10 })
    );
    const report = await buildRevisionOutcomeIntelligence({ specKey: SPEC, now: FIXED_NOW });
    expect(report.topicOutcomes).toEqual([]);
    expect(report.eligibleOutcomeCount).toBe(0);
    expect(report.summary.overallStatus).toBe("UNKNOWN");
  });
});
