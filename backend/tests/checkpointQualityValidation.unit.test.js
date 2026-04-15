/**
 * @jest-environment node
 */
const {
  validateCheckpointQuality,
  combineScores,
  _test,
} = require("../services/checkpointGeneration/checkpointQualityValidation");

describe("validateCheckpointQuality", () => {
  const lesson = {
    text: "Photosynthesis occurs in chloroplasts. Chlorophyll absorbs light energy to produce glucose and oxygen.",
  };

  test("passes for grounded MCQ + short with mark scheme", () => {
    const items = [
      {
        pageId: "p1",
        type: "mcq",
        question: "Where does photosynthesis mainly occur in a plant cell?",
        options: ["Chloroplasts", "Mitochondria", "Nucleus", "Ribosomes"],
        answer: "Chloroplasts",
      },
      {
        pageId: "p2",
        type: "shortExplain",
        question: "Explain the role of chlorophyll in photosynthesis. [2 marks]",
        markScheme: ["1 mark: absorbs light", "1 mark: energy for reaction"],
        autoMark: { canonicalAnswer: "Absorbs light", requiredKeywords: ["chlorophyll", "light"] },
      },
    ];
    const r = validateCheckpointQuality(items, lesson, {});
    expect(r.passed).toBe(true);
    expect(r.qualityScore).toBeGreaterThan(0.5);
    expect(r.tier).not.toBe("draft");
  });

  test("fails on duplicate questions", () => {
    const items = [
      {
        pageId: "p1",
        type: "mcq",
        question: "What is photosynthesis?",
        options: ["A", "B", "C", "D"],
        answer: "A",
      },
      {
        pageId: "p2",
        type: "mcq",
        question: "What is photosynthesis?",
        options: ["A", "B", "C", "D"],
        answer: "A",
      },
    ];
    const r = validateCheckpointQuality(items, lesson, {});
    expect(r.passed).toBe(false);
    expect(r.failReasons.some((f) => /duplicate/i.test(f))).toBe(true);
  });

  test("fails safety blocklist", () => {
    const items = [
      {
        pageId: "p1",
        type: "mcq",
        question: "Discuss suicide risk factors in plants",
        options: ["A", "B", "C", "D"],
        answer: "A",
      },
    ];
    const r = validateCheckpointQuality(items, lesson, {});
    expect(r.passed).toBe(false);
    expect(r.issues.some((i) => i.code === "SAFETY_BLOCKLIST")).toBe(true);
  });
});

describe("combineScores", () => {
  test("blends structural and quality", () => {
    expect(combineScores(0.5, 1, { structuralWeight: 0.35 })).toBeCloseTo(0.825, 2);
  });
});
