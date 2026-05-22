import {
  buildRevisionVariantsFromCheckpoints,
  shuffleOptionsDeterministic,
} from "./revisionPracticeVariants";
import { isNearDuplicateStem } from "./questionStemSimilarity";

describe("revisionPracticeVariants", () => {
  it("shuffles options but keeps correct answer text", () => {
    const { options, correctAnswer } = shuffleOptionsDeterministic(
      ["A", "B", "C", "D"],
      "B",
      "test-seed"
    );
    expect(options).toHaveLength(4);
    expect(options).toContain("B");
    expect(correctAnswer).toBe("B");
  });

  it("builds stems that differ from checkpoint prompts", () => {
    const sources = [
      {
        prompt: "What is a limiting factor?",
        options: ["A", "B", "C", "D"],
        correctAnswer: "B",
      },
    ];
    const variants = buildRevisionVariantsFromCheckpoints(sources);
    expect(variants).toHaveLength(1);
    expect(isNearDuplicateStem(variants[0].question, sources[0].prompt)).toBe(false);
    expect(variants[0].correctAnswer).toBe("B");
  });
});
