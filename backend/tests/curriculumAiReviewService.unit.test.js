/**
 * @jest-environment node
 */
const { validateAndNormalizeReviewResult } = require("../services/curriculumAiReviewService");

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
