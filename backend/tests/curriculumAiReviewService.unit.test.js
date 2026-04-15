/**
 * @jest-environment node
 */
const {
  validateAndNormalizeReviewResult,
  getCurriculumReviewPublishWarning,
  shouldSkipAutoDraftSaveReview,
} = require("../services/curriculumAiReviewService");

describe("validateAndNormalizeReviewResult", () => {
  test("accepts a well-formed payload", () => {
    const raw = {
      curriculumMatchScore: 72,
      lessonQualityScore: 68,
      issues: ["a"],
      warnings: ["w"],
      missingCoverage: ["m"],
      terminologyFixes: [{ from: "mitochondria", to: "mitochondrion", note: "singular in some MS" }],
      suggestedRewrites: [
        {
          section: "Page 1",
          originalSnippet: "foo",
          suggestion: "bar",
          note: "clearer",
        },
      ],
      suggestedObjectives: ["obj"],
      suggestedPriorKnowledge: ["pk"],
      suggestedKeywords: ["k"],
      examAlignmentNotes: ["e"],
      checkpointAlignmentNotes: ["c"],
    };
    const r = validateAndNormalizeReviewResult(raw);
    expect(r.ok).toBe(true);
    expect(r.data.curriculumMatchScore).toBe(72);
    expect(r.data.lessonQualityScore).toBe(68);
    expect(r.data.issues).toEqual(["a"]);
    expect(r.data.terminologyFixes[0].from).toBe("mitochondria");
  });

  test("rejects bad scores", () => {
    expect(validateAndNormalizeReviewResult({ curriculumMatchScore: 101, lessonQualityScore: 50 }).ok).toBe(false);
    expect(validateAndNormalizeReviewResult({ curriculumMatchScore: 50, lessonQualityScore: -1 }).ok).toBe(false);
    expect(validateAndNormalizeReviewResult(null).ok).toBe(false);
  });
});

describe("getCurriculumReviewPublishWarning", () => {
  const prevWarn = process.env.CURRICULUM_AI_REVIEW_PUBLISH_WARNINGS;
  const prevEn = process.env.CURRICULUM_AI_REVIEW_ENABLED;
  const prevMin = process.env.CURRICULUM_AI_REVIEW_MIN_PUBLISH_SCORE;

  afterEach(() => {
    process.env.CURRICULUM_AI_REVIEW_PUBLISH_WARNINGS = prevWarn;
    process.env.CURRICULUM_AI_REVIEW_ENABLED = prevEn;
    process.env.CURRICULUM_AI_REVIEW_MIN_PUBLISH_SCORE = prevMin;
  });

  test("returns null when warnings disabled", () => {
    process.env.CURRICULUM_AI_REVIEW_ENABLED = "true";
    process.env.CURRICULUM_AI_REVIEW_PUBLISH_WARNINGS = "false";
    expect(getCurriculumReviewPublishWarning({ curriculumAiReview: null })).toBe(null);
  });

  test("warns when review missing and warnings on", () => {
    process.env.CURRICULUM_AI_REVIEW_ENABLED = "true";
    process.env.CURRICULUM_AI_REVIEW_PUBLISH_WARNINGS = "true";
    const w = getCurriculumReviewPublishWarning({});
    expect(w).not.toBe(null);
    expect(w.code).toBe("CURRICULUM_REVIEW_MISSING_OR_INCOMPLETE");
  });

  test("warns when score below threshold", () => {
    process.env.CURRICULUM_AI_REVIEW_ENABLED = "true";
    process.env.CURRICULUM_AI_REVIEW_PUBLISH_WARNINGS = "true";
    process.env.CURRICULUM_AI_REVIEW_MIN_PUBLISH_SCORE = "70";
    const w = getCurriculumReviewPublishWarning({
      curriculumAiReview: {
        status: "completed",
        result: { curriculumMatchScore: 50, lessonQualityScore: 60 },
      },
    });
    expect(w?.code).toBe("CURRICULUM_REVIEW_BELOW_THRESHOLD");
  });
});

describe("shouldSkipAutoDraftSaveReview (Phase 4)", () => {
  const prevMs = process.env.CURRICULUM_AI_REVIEW_AUTO_MIN_INTERVAL_MS;

  afterEach(() => {
    process.env.CURRICULUM_AI_REVIEW_AUTO_MIN_INTERVAL_MS = prevMs;
  });

  test("skips when published", () => {
    const r = shouldSkipAutoDraftSaveReview({
      status: "draft",
      isPublished: true,
      curriculumAiReview: {},
    });
    expect(r.skip).toBe(true);
    expect(r.reason).toBe("published");
  });

  test("skips when not draft", () => {
    const r = shouldSkipAutoDraftSaveReview({
      status: "in_review",
      isPublished: false,
      curriculumAiReview: {},
    });
    expect(r.skip).toBe(true);
    expect(r.reason).toBe("not_draft");
  });

  test("skips when review running", () => {
    const r = shouldSkipAutoDraftSaveReview({
      status: "draft",
      isPublished: false,
      curriculumAiReview: { status: "running" },
    });
    expect(r.skip).toBe(true);
    expect(r.reason).toBe("already_running");
  });

  test("skips when completed review is recent within min interval", () => {
    process.env.CURRICULUM_AI_REVIEW_AUTO_MIN_INTERVAL_MS = String(3600000);
    const r = shouldSkipAutoDraftSaveReview({
      status: "draft",
      isPublished: false,
      curriculumAiReview: {
        status: "completed",
        generatedAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    });
    expect(r.skip).toBe(true);
    expect(r.reason).toBe("recent_completed_review");
  });

  test("does not skip when completed review is older than min interval", () => {
    process.env.CURRICULUM_AI_REVIEW_AUTO_MIN_INTERVAL_MS = String(3600000);
    const r = shouldSkipAutoDraftSaveReview({
      status: "draft",
      isPublished: false,
      curriculumAiReview: {
        status: "completed",
        generatedAt: new Date(Date.now() - 2 * 3600000),
      },
    });
    expect(r.skip).toBe(false);
  });

  test("does not skip when last review failed", () => {
    const r = shouldSkipAutoDraftSaveReview({
      status: "draft",
      isPublished: false,
      curriculumAiReview: { status: "failed", generatedAt: new Date() },
    });
    expect(r.skip).toBe(false);
  });
});
