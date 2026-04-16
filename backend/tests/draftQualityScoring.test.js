/**
 * @jest-environment node
 */
const {
  deriveQualityBand,
  scoreFlashcardDraft,
  scoreQuizMcqDraft,
  scoreExamDraft,
  eligibleForQualityRewrite,
  metadataQualityPatch,
} = require("../utils/draftQualityScoring");

describe("draftQualityScoring", () => {
  it("deriveQualityBand", () => {
    expect(deriveQualityBand(90)).toBe("high");
    expect(deriveQualityBand(80)).toBe("high");
    expect(deriveQualityBand(70)).toBe("medium");
    expect(deriveQualityBand(59)).toBe("low");
  });

  it("good flashcard scores high", () => {
    const r = scoreFlashcardDraft({
      front: "What is the role of mitochondria in a cell?",
      back: "Mitochondria carry out aerobic respiration to release energy (ATP) for the cell.",
    });
    expect(r.qualityScore).toBeGreaterThanOrEqual(80);
    expect(r.qualityBand).toBe("high");
    expect(r.qualityFlags.length).toBe(0);
  });

  it("vague short flashcard scores lower", () => {
    const r = scoreFlashcardDraft({
      front: "What?",
      back: "Short",
    });
    expect(r.qualityScore).toBeLessThan(80);
    expect(r.qualityFlags.length).toBeGreaterThan(0);
  });

  it("good MCQ scores high", () => {
    const r = scoreQuizMcqDraft({
      questionText: "Which organelle is the site of aerobic respiration?",
      choices: ["Nucleus", "Mitochondrion", "Ribosome", "Chloroplast"],
      correctIndex: 1,
      explanation: "Mitochondria produce ATP through aerobic respiration using oxygen.",
    });
    expect(r.qualityScore).toBeGreaterThanOrEqual(75);
  });

  it("weak quiz scores lower", () => {
    const r = scoreQuizMcqDraft({
      questionText: "Respiration?",
      choices: ["a", "b", "c", "d"],
      correctIndex: 0,
      explanation: "ok",
    });
    expect(r.qualityScore).toBeLessThan(75);
  });

  it("metadataQualityPatch includes scoreVersion", () => {
    const r = scoreFlashcardDraft({ front: "Q", back: "A".repeat(50) });
    const m = metadataQualityPatch(r, "heuristic");
    expect(m.qualityScore).toBeDefined();
    expect(m.scoreVersion).toBeDefined();
    expect(m.qualityScoredBy).toBe("heuristic");
  });

  it("eligibleForQualityRewrite respects high score", () => {
    expect(eligibleForQualityRewrite(85, ["answer_too_short"])).toBe(false);
  });

  it("eligibleForQualityRewrite low score with flags", () => {
    expect(eligibleForQualityRewrite(45, ["vague_front"])).toBe(true);
  });
});
