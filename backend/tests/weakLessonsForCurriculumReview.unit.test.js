/**
 * @jest-environment node
 */
const { buildWeakReasonTags } = require("../utils/weakLessonsForCurriculumReview");

describe("buildWeakReasonTags", () => {
  test("flags low accuracy", () => {
    expect(buildWeakReasonTags(0.4, 0, 1)).toContain("low_accuracy");
  });
  test("flags high-confidence wrong pattern", () => {
    expect(buildWeakReasonTags(0.8, 3, 1)).toContain("high_confidence_wrong");
  });
  test("flags repeat attempts per student", () => {
    expect(buildWeakReasonTags(0.7, 0, 3)).toContain("repeat_attempts");
  });
});
