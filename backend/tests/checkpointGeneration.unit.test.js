/**
 * @jest-environment node
 */
const {
  validateAndNormalizeCheckpointPayload,
} = require("../services/checkpointGeneration/validateCheckpointPayload");

describe("validateAndNormalizeCheckpointPayload", () => {
  const lessonShape = {
    pages: [{ pageId: "p1" }, { pageId: "p2" }],
  };

  test("accepts valid MCQ and shortExplain", () => {
    const raw = [
      {
        pageId: "p1",
        type: "mcq",
        question: "Which statement about photosynthesis is correct?",
        options: ["A", "B", "C", "D"],
        answer: "A",
      },
      {
        pageId: "p2",
        type: "shortExplain",
        question: "Explain why chlorophyll is important for plants.",
        markScheme: ["1 mark: absorbs light"],
        autoMark: { canonicalAnswer: "Absorbs light energy", requiredKeywords: ["chlorophyll", "light"] },
      },
    ];
    const { items, issues, qualityScore } = validateAndNormalizeCheckpointPayload(raw, lessonShape);
    expect(items.length).toBe(2);
    expect(issues.filter((i) => i.severity === "error").length).toBe(0);
    expect(qualityScore).toBeGreaterThan(0.5);
  });

  test("rejects MCQ when answer not in options", () => {
    const raw = [
      {
        pageId: "p1",
        type: "mcq",
        question: "Test question long enough here?",
        options: ["A", "B", "C", "D"],
        answer: "Z",
      },
    ];
    const { items, issues } = validateAndNormalizeCheckpointPayload(raw, lessonShape);
    expect(items.length).toBe(0);
    expect(issues.some((i) => i.code === "MCQ_ANSWER_MISMATCH")).toBe(true);
  });
});
