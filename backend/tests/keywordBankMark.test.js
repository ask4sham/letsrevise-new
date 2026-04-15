const {
  autoMarkShortAnswer,
  normalizeForMatch,
  keywordMatched,
  normalizeBank,
} = require("../services/checkpointAutoMark/keywordBankMark");

describe("keywordBankMark", () => {
  test("normalizeForMatch lowercases and strips punctuation", () => {
    expect(normalizeForMatch("Hello, World!")).toBe("hello world");
  });

  test("all required keywords → correct", () => {
    const r = autoMarkShortAnswer("Arteries have thick walls with muscle", {
      requiredKeywords: ["artery", "thick", "muscle"],
      minMatchThreshold: 0.6,
    });
    expect(r.verdict).toBe("correct");
    expect(r.matchedRequired.length).toBe(3);
    expect(r.missingRequired.length).toBe(0);
  });

  test("partial when above threshold but not all required", () => {
    const r = autoMarkShortAnswer("Arteries are thick", {
      requiredKeywords: ["artery", "thick", "muscle", "elastic"],
      minMatchThreshold: 0.5,
    });
    expect(r.verdict).toBe("partial");
    expect(r.matchedRequired.length).toBe(2);
    expect(r.missingRequired.length).toBe(2);
  });

  test("incorrect below threshold", () => {
    const r = autoMarkShortAnswer("blood", {
      requiredKeywords: ["artery", "thick", "muscle"],
      minMatchThreshold: 0.6,
    });
    expect(r.verdict).toBe("incorrect");
  });

  test("forbidden misconception forces incorrect", () => {
    const r = autoMarkShortAnswer("Veins carry oxygenated blood away from the heart", {
      requiredKeywords: ["vein"],
      forbiddenMisconceptions: ["veins carry oxygenated blood"],
      minMatchThreshold: 0.5,
    });
    expect(r.verdict).toBe("incorrect");
    expect(r.misconceptionHits.length).toBeGreaterThan(0);
  });

  test("accepted variant gives correct when no required list", () => {
    const r = autoMarkShortAnswer("The pulmonary artery carries deoxygenated blood to the lungs", {
      requiredKeywords: [],
      acceptedVariants: ["pulmonary artery carries deoxygenated blood to the lungs"],
    });
    expect(r.verdict).toBe("correct");
  });

  test("canonical answer substring match", () => {
    const r = autoMarkShortAnswer("Capillaries are one cell thick for diffusion", {
      requiredKeywords: ["diffusion"],
      canonicalAnswer: "Capillaries have walls one cell thick to allow diffusion",
      minMatchThreshold: 0.5,
    });
    expect(["correct", "partial"]).toContain(r.verdict);
  });

  test("empty student answer", () => {
    const r = autoMarkShortAnswer("", {
      requiredKeywords: ["heart"],
    });
    expect(r.verdict).toBe("incorrect");
  });

  test("normalizeBank clamps threshold", () => {
    const b = normalizeBank({ minMatchThreshold: 99 });
    expect(b.minMatchThreshold).toBe(1);
  });
});
