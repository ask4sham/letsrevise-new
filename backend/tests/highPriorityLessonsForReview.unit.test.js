/**
 * @jest-environment node
 */
const {
  computeCurriculumPriorityScore,
  buildRecommendedCurriculumCheckSet,
  needsCurriculumReviewAttention,
  isEligibleDraftForCurriculumReview,
} = require("../utils/highPriorityLessonsForReview");

describe("highPriorityLessonsForReview", () => {
  test("computeCurriculumPriorityScore increases with views and taxonomy", () => {
    const low = computeCurriculumPriorityScore({
      views: 0,
      specKey: "",
      topicKey: "",
      updatedAt: new Date(Date.now() - 400 * 86400000),
    });
    const high = computeCurriculumPriorityScore({
      views: 200,
      specKey: "aqa-gcse-biology",
      topicKey: "aqa-gcse-biology:cell-biology",
      updatedAt: new Date(),
    });
    expect(high).toBeGreaterThan(low);
  });

  test("needsCurriculumReviewAttention when missing or incomplete review", () => {
    expect(needsCurriculumReviewAttention({})).toBe(true);
    expect(needsCurriculumReviewAttention({ curriculumAiReview: { status: "completed", result: {} } })).toBe(false);
    expect(needsCurriculumReviewAttention({ curriculumAiReview: { status: "running" } })).toBe(false);
  });

  test("buildRecommendedCurriculumCheckSet caps and ranks", () => {
    const lessons = [
      {
        _id: "a",
        isPublished: false,
        status: "draft",
        views: 0,
        updatedAt: new Date(),
        curriculumAiReview: { status: "idle" },
      },
      {
        _id: "b",
        isPublished: false,
        status: "draft",
        views: 500,
        specKey: "x",
        topicKey: "x:y",
        updatedAt: new Date(),
        curriculumAiReview: { status: "idle" },
      },
    ];
    const set = buildRecommendedCurriculumCheckSet(lessons, 1);
    expect(set.size).toBe(1);
    expect(set.has("b")).toBe(true);
  });

  test("isEligibleDraftForCurriculumReview rejects published", () => {
    expect(isEligibleDraftForCurriculumReview({ isPublished: true, status: "published" })).toBe(false);
    expect(isEligibleDraftForCurriculumReview({ isPublished: false, status: "draft" })).toBe(true);
  });
});
