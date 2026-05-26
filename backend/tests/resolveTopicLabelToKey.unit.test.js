const {
  extractLabelCandidates,
  resolveTopicLabelToKey,
} = require("../utils/resolveTopicLabelToKey");

describe("resolveTopicLabelToKey", () => {
  it("extracts Metabolism from composite lesson topic label", () => {
    const c = extractLabelCandidates("Biology — Metabolism (AQA GCSE Biology)");
    expect(c).toContain("Metabolism");
  });

  it("maps Metabolism display to metabolism key", () => {
    const r = resolveTopicLabelToKey("aqa-gcse-biology", "Metabolism");
    expect(r.key).toBe("metabolism");
    expect(r.match).toBe("exact-display");
  });

  it("maps composite Biology — Metabolism label to metabolism", () => {
    const r = resolveTopicLabelToKey("aqa-gcse-biology", "Biology — Metabolism (AQA GCSE Biology)");
    expect(r.key).toBe("metabolism");
  });

  it("maps Respiration via alias from aerobic/anaerobic title", () => {
    const r = resolveTopicLabelToKey(
      "aqa-gcse-biology",
      "Aerobic and anaerobic respiration (AQA GCSE Biology) (Higher Tier)"
    );
    expect(r.key).toBe("respiration");
  });

  it("maps limiting factors lesson title to photosynthesis", () => {
    const r = resolveTopicLabelToKey(
      "aqa-gcse-biology",
      "Interactions of Limiting Factors (AQA GCSE Biology)"
    );
    expect(r.key).toBe("photosynthesis");
  });

  it("maps uses of glucose lesson title to photosynthesis", () => {
    const r = resolveTopicLabelToKey(
      "aqa-gcse-biology",
      "Uses of Glucose from Photosynthesis (AQA GCSE Biology)"
    );
    expect(r.key).toBe("photosynthesis");
  });

  it("maps Cell structure via slug match", () => {
    const r = resolveTopicLabelToKey("aqa-gcse-biology", "Cell structure");
    expect(r.key).toBe("cell-structure");
  });
});
