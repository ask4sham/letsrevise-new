/**
 * Autopilot 0 System Brief V1 — unit tests (service contract, classification, read-only).
 */
const fs = require("fs");
const path = require("path");

const SERVICE_PATH = path.join(__dirname, "..", "services", "autopilot0", "systemBriefService.js");
const serviceSource = fs.readFileSync(SERVICE_PATH, "utf8");

const {
  VERSION,
  LEVEL,
  buildSystemBrief,
  worstStatus,
  makeDomain,
  classifyPlatformHealth,
  classifyContentHealth,
  classifyCurriculumCoverage,
  classifyAssessmentHealth,
  classifyDependencies,
  classifyProductExperience,
  classifyRelease,
} = require("../services/autopilot0/systemBriefService");

jest.mock("../models/Lesson", () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  aggregate: jest.fn().mockResolvedValue([{ totalViews: 0 }]),
}));
jest.mock("../models/LessonIssueReport", () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
}));
jest.mock("../models/BackgroundJob", () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
}));
jest.mock("../models/ExamQuestion", () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
}));
jest.mock("../models/WorksheetAttempt", () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
}));
jest.mock("../models/LearningEvidenceEvent", () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
}));
jest.mock("../models/StudentTopicProgress", () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
}));
jest.mock("../models/Event", () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
}));
jest.mock("../services/adminTaxonomyService", () => ({
  getMergedTaxonomyBySpecKey: jest.fn().mockResolvedValue({
    units: [{ topics: [{ key: "cell-structure", topic: "Cell structure" }] }],
  }),
}));
jest.mock("../services/revisionMetrics", () => ({
  evaluateAlerts: jest.fn().mockReturnValue({ ok: true, alerts: [] }),
  getSnapshot: jest.fn().mockReturnValue({ attempts: 0, completed: 0, stub: 0, recent: [] }),
}));
jest.mock("../services/opsSignals", () => ({
  getSignalSnapshot: jest.fn().mockReturnValue({ at: new Date().toISOString() }),
}));

const Lesson = require("../models/Lesson");

const DOMAIN_KEYS = [
  "platformHealth",
  "contentHealth",
  "curriculumCoverage",
  "assessmentHealth",
  "learningSignals",
  "security",
  "dependencies",
  "productExperience",
];

const VALID_STATUSES = new Set(["GREEN", "AMBER", "RED", "UNKNOWN"]);
const VALID_ACTIONS = new Set(["NONE", "INVESTIGATE", "HUMAN_REVIEW"]);
const VALID_CONFIDENCE = new Set(["HIGH", "MEDIUM", "LOW"]);

function assertDomainContract(domain) {
  expect(VALID_STATUSES.has(domain.status)).toBe(true);
  expect(Array.isArray(domain.evidence)).toBe(true);
  expect(VALID_ACTIONS.has(domain.action)).toBe(true);
  expect(VALID_CONFIDENCE.has(domain.confidence)).toBe(true);
}

describe("autopilot0 systemBriefService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Lesson.countDocuments.mockResolvedValue(0);
    Lesson.aggregate.mockResolvedValue([{ totalViews: 0 }]);
  });

  test("service source contains no write operations", () => {
    const prohibited = [
      /\.save\s*\(/,
      /\.create\s*\(/,
      /\.insert/,
      /\.update\s*\(/,
      /\.updateOne\s*\(/,
      /\.updateMany\s*\(/,
      /\.delete\s*\(/,
      /\.deleteOne\s*\(/,
      /\.deleteMany\s*\(/,
      /\.findOneAndUpdate\s*\(/,
      /\.bulkWrite\s*\(/,
      /\.enqueue\s*\(/,
      /child_process/,
      /exec\s*\(/,
      /spawn\s*\(/,
      /npm audit/,
      /openai/i,
    ];
    for (const pattern of prohibited) {
      expect(serviceSource).not.toMatch(pattern);
    }
  });

  test("returns version autopilot0-system-brief-v1 and level L0", async () => {
    const brief = await buildSystemBrief();
    expect(brief.version).toBe(VERSION);
    expect(brief.version).toBe("autopilot0-system-brief-v1");
    expect(brief.level).toBe(LEVEL);
    expect(brief.level).toBe("L0");
  });

  test("includes expected domain keys with valid contract", async () => {
    const brief = await buildSystemBrief();
    for (const key of DOMAIN_KEYS) {
      expect(brief.domains).toHaveProperty(key);
      assertDomainContract(brief.domains[key]);
    }
    expect(brief.release).toEqual(
      expect.objectContaining({
        commit: expect.any(String),
        status: expect.any(String),
        confidence: expect.any(String),
        evidence: expect.any(Array),
      })
    );
    expect(brief.summary).toEqual(
      expect.objectContaining({
        overallStatus: expect.any(String),
        humanReviewRequired: expect.any(Boolean),
      })
    );
  });

  test("worstStatus follows RED > AMBER > UNKNOWN > GREEN", () => {
    expect(worstStatus(["GREEN", "AMBER"])).toBe("AMBER");
    expect(worstStatus(["GREEN", "UNKNOWN"])).toBe("UNKNOWN");
    expect(worstStatus(["GREEN", "RED"])).toBe("RED");
    expect(worstStatus(["GREEN", "GREEN"])).toBe("GREEN");
    expect(worstStatus(["UNKNOWN", "AMBER"])).toBe("AMBER");
    expect(worstStatus(["AMBER", "RED"])).toBe("RED");
  });

  test("humanReviewRequired is true whenever overallStatus is not GREEN", async () => {
    const brief = await buildSystemBrief();
    if (brief.summary.overallStatus === "GREEN") {
      expect(brief.summary.humanReviewRequired).toBe(false);
    } else {
      expect(brief.summary.humanReviewRequired).toBe(true);
    }
  });

  test("humanReviewRequired invariant for explicit status cases", () => {
    const cases = [
      { statuses: ["GREEN", "GREEN"], humanReviewRequired: false, overall: "GREEN" },
      { statuses: ["GREEN", "UNKNOWN"], humanReviewRequired: true, overall: "UNKNOWN" },
      { statuses: ["GREEN", "AMBER"], humanReviewRequired: true, overall: "AMBER" },
      { statuses: ["GREEN", "RED"], humanReviewRequired: true, overall: "RED" },
    ];
    for (const c of cases) {
      const overall = worstStatus(c.statuses);
      expect(overall).toBe(c.overall);
      expect(overall !== "GREEN").toBe(c.humanReviewRequired);
    }
  });

  test("classifyPlatformHealth marks mongo disconnect as RED", () => {
    const domain = classifyPlatformHealth({
      mongoConnected: false,
      revisionAlertCount: 0,
      backgroundFailureCount: 0,
      sentryConfigured: true,
    });
    expect(domain.status).toBe("RED");
    expect(domain.action).toBe("HUMAN_REVIEW");
  });

  test("classifyPlatformHealth marks revision alerts as AMBER", () => {
    const domain = classifyPlatformHealth({
      mongoConnected: true,
      revisionAlertCount: 2,
      backgroundFailureCount: 0,
      sentryConfigured: false,
    });
    expect(domain.status).toBe("AMBER");
  });

  test("dependencies domain is UNKNOWN without npm audit", () => {
    const domain = classifyDependencies();
    expect(domain.status).toBe("UNKNOWN");
    expect(domain.evidence[0].code).toBe("DEPENDENCY_RUNTIME_AUDIT_NOT_WIRED");
    expect(domain.action).toBe("INVESTIGATE");
  });

  test("product experience domain reports PRODUCT_ANALYTICS_LIMITED", () => {
    const domain = classifyProductExperience({ paywallEventCount: 3, totalLessonViews: 100 });
    expect(domain.status).toBe("UNKNOWN");
    expect(domain.evidence.some((e) => e.code === "PRODUCT_ANALYTICS_LIMITED")).toBe(true);
  });

  test("classifyRelease returns UNKNOWN for missing commit", () => {
    const domain = classifyRelease("unknown");
    expect(domain.status).toBe("UNKNOWN");
  });

  test("optional unavailable curriculum signal becomes UNKNOWN rather than crash", async () => {
    const adminTaxonomyService = require("../services/adminTaxonomyService");
    adminTaxonomyService.getMergedTaxonomyBySpecKey.mockRejectedValueOnce(new Error("taxonomy down"));
    const brief = await buildSystemBrief();
    expect(brief.domains.curriculumCoverage.status).toBe("UNKNOWN");
  });

  test("brief JSON does not include student-private fields", async () => {
    Lesson.countDocuments.mockResolvedValue(5);
    const brief = await buildSystemBrief();
    const json = JSON.stringify(brief);
    expect(json).not.toMatch(/studentId|userId|email|@/i);
    expect(brief).not.toHaveProperty("student");
    expect(brief).not.toHaveProperty("users");
  });

  test("content health classification responds to open issues", () => {
    const domain = classifyContentHealth({
      publishedLessonCount: 10,
      draftLessonCount: 2,
      openContentIssueCount: 12,
      lessonsMissingTaxonomyCount: 0,
    });
    expect(domain.status).toBe("AMBER");
  });

  test("curriculum coverage classification handles partial coverage", () => {
    const domain = classifyCurriculumCoverage({
      specKey: "aqa-gcse-biology",
      totalTopics: 60,
      curatedTopics: 20,
      missingTopics: 40,
      topPriorityGaps: [{ topicKey: "x", reason: "missingLesson" }],
    });
    expect(domain.status).toBe("AMBER");
  });

  test("assessment health UNKNOWN when counts null", () => {
    const domain = classifyAssessmentHealth({
      unmarkedWorksheetCount: null,
      questionsWithoutMarkSchemeCount: 0,
      questionsWithoutTopicLinkCount: 0,
    });
    expect(domain.status).toBe("UNKNOWN");
  });

  test("makeDomain produces stable shape", () => {
    const d = makeDomain("GREEN", [{ code: "TEST", detail: "ok" }], "NONE", "HIGH");
    assertDomainContract(d);
  });
});
