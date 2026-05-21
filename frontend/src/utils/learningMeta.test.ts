import {
  attachLearningMetaForPersist,
  collectLearningMetaWarnings,
  deriveLearningIntelligenceSummary,
  safeDeriveLearningIntelligenceSummary,
  sanitizeLearningMeta,
} from "./learningMeta";

describe("learningMeta", () => {
  it("sanitizes valid learningMeta and drops unknown fields", () => {
    expect(
      sanitizeLearningMeta({
        concept: " Active transport ",
        skill: "Recall",
        difficulty: "medium",
        extra: "ignored",
      })
    ).toEqual({
      concept: "Active transport",
      skill: "Recall",
      difficulty: "medium",
    });
  });

  it("returns undefined for empty or invalid difficulty", () => {
    expect(sanitizeLearningMeta({})).toBeUndefined();
    expect(sanitizeLearningMeta({ difficulty: "extreme" })).toBeUndefined();
  });

  it("attachLearningMetaForPersist leaves block unchanged when meta absent", () => {
    const out = attachLearningMetaForPersist({ type: "text", content: "Hello" }, { type: "text" });
    expect(out).toEqual({ type: "text", content: "Hello" });
    expect(out).not.toHaveProperty("learningMeta");
  });

  it("attachLearningMetaForPersist merges sanitised meta", () => {
    const out = attachLearningMetaForPersist(
      { type: "graph", graphType: "line" },
      { learningMeta: { concept: "Limiting factors", difficulty: "hard" } }
    );
    expect(out.learningMeta).toEqual({ concept: "Limiting factors", difficulty: "hard" });
    expect(out.type).toBe("graph");
  });

  it("collectLearningMetaWarnings lists blocks without meta", () => {
    const warnings = collectLearningMetaWarnings([
      {
        blocks: [
          { type: "text", content: "A" },
          { type: "text", content: "B", learningMeta: { concept: "X" } },
        ],
      },
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].blockIndex).toBe(0);
  });

  it("deriveLearningIntelligenceSummary returns empty state for legacy lessons", () => {
    const summary = deriveLearningIntelligenceSummary([
      { blocks: [{ type: "text", content: "Hello" }] },
    ]);
    expect(summary.hasAnyMeta).toBe(false);
    expect(summary.totalBlocks).toBe(1);
    expect(summary.concepts).toHaveLength(0);
  });

  it("safeDeriveLearningIntelligenceSummary never throws on undefined pages", () => {
    expect(safeDeriveLearningIntelligenceSummary(undefined).hasAnyMeta).toBe(false);
    expect(safeDeriveLearningIntelligenceSummary(undefined).concepts).toEqual([]);
  });

  it("deriveLearningIntelligenceSummary groups duplicate concepts and counts difficulty", () => {
    const summary = deriveLearningIntelligenceSummary([
      {
        blocks: [
          { learningMeta: { concept: "Photosynthesis", skill: "Explain", difficulty: "medium" } },
          { learningMeta: { concept: "photosynthesis", examSkill: "6-mark", difficulty: "hard" } },
          { learningMeta: { misconceptionRisk: "Light only", difficulty: "easy" } },
        ],
      },
    ]);
    expect(summary.hasAnyMeta).toBe(true);
    expect(summary.blocksWithMeta).toBe(3);
    expect(summary.concepts).toEqual([{ label: "Photosynthesis", count: 2 }]);
    expect(summary.skills).toEqual([{ label: "Explain", count: 1 }]);
    expect(summary.misconceptionRisks).toEqual([{ label: "Light only", count: 1 }]);
    expect(summary.examSkills).toEqual([{ label: "6-mark", count: 1 }]);
    expect(summary.difficultyBalance).toEqual({ easy: 1, medium: 1, hard: 1, unspecified: 0 });
  });
});
