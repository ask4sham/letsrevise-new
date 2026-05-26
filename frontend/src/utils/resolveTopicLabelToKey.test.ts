import {
  extractLabelCandidates,
  resolveTopicLabelFromUnits,
} from "./resolveTopicLabelToKey";
import type { TaxonomyUnit } from "../api/taxonomy";

describe("resolveTopicLabelToKey", () => {
  const biologyUnits = [
    {
      unit: "Bioenergetics",
      topics: [
        { topic: "Photosynthesis", key: "photosynthesis", tier: ["foundation", "higher"], requiredPractical: false },
        { topic: "Respiration", key: "respiration", tier: ["foundation", "higher"], requiredPractical: false },
        { topic: "Metabolism", key: "metabolism", tier: ["foundation", "higher"], requiredPractical: false },
      ],
    },
    {
      unit: "Cell Biology",
      topics: [
        { topic: "Cell structure", key: "cell-structure", tier: ["foundation", "higher"], requiredPractical: false },
      ],
    },
  ] as TaxonomyUnit[];

  it("extracts Metabolism from composite label", () => {
    expect(extractLabelCandidates("Biology — Metabolism (AQA GCSE Biology)")).toContain("Metabolism");
  });

  it("maps composite Metabolism label", () => {
    const r = resolveTopicLabelFromUnits(
      biologyUnits,
      "Biology — Metabolism (AQA GCSE Biology)"
    );
    expect(r.key).toBe("metabolism");
  });

  it("maps limiting factors title to photosynthesis", () => {
    const r = resolveTopicLabelFromUnits(
      biologyUnits,
      "Interactions of Limiting Factors (AQA GCSE Biology)"
    );
    expect(r.key).toBe("photosynthesis");
  });
});
