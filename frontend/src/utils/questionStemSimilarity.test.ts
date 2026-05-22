import { isNearDuplicateStem, normalizeQuestionStem, stemSimilarity } from "./questionStemSimilarity";

describe("questionStemSimilarity", () => {
  it("treats identical stems as duplicates", () => {
    expect(isNearDuplicateStem("What is a limiting factor?", "what is a limiting factor?")).toBe(true);
  });

  it("detects near-duplicate paraphrases", () => {
    const a = "What is a limiting factor in photosynthesis?";
    const b = "What is a limiting factor in photosynthesis";
    expect(stemSimilarity(a, b)).toBeGreaterThan(0.9);
    expect(isNearDuplicateStem(a, b)).toBe(true);
  });

  it("allows clearly different revision stems", () => {
    const checkpoint = "What is a limiting factor?";
    const revision = "Without looking back at the lesson — Which option best describes limiting factors?";
    expect(normalizeQuestionStem(checkpoint)).not.toBe(normalizeQuestionStem(revision));
    expect(isNearDuplicateStem(checkpoint, revision)).toBe(false);
  });
});
