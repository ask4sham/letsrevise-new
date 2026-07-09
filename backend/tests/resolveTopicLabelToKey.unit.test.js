/**
 * Label → key resolution for flat (AQA) and section-nested (Edexcel IGCSE) taxonomies.
 */
const {
  resolveTopicLabelToKey,
  loosenSlugForCompare,
} = require("../utils/resolveTopicLabelToKey");
const { flattenTaxonomyLeafTopics, getTaxonomyBySpecKey } = require("../utils/topicTaxonomy");

describe("resolveTopicLabelToKey + flattenTaxonomyLeafTopics", () => {
  test("flattenTaxonomyLeafTopics unions flat and section-nested leaves", () => {
    const edexcel = getTaxonomyBySpecKey("edexcel-igcse-biology");
    const leaves = flattenTaxonomyLeafTopics(edexcel);
    expect(leaves.length).toBeGreaterThan(50);
    expect(leaves.some((t) => t.key === "roles-of-fsh-and-lh-in-the-menstrual-cycle")).toBe(true);
    expect(leaves.some((t) => t.key === "human-male-and-female-reproductive-systems")).toBe(true);

    const aqa = getTaxonomyBySpecKey("aqa-gcse-biology");
    const aqaLeaves = flattenTaxonomyLeafTopics(aqa);
    expect(aqaLeaves.some((t) => t.key === "cell-structure")).toBe(true);
  });

  test("Edexcel: Roles of FSH & LH in the Menstrual Cycle", () => {
    const hit = resolveTopicLabelToKey(
      "edexcel-igcse-biology",
      "Roles of FSH & LH in the Menstrual Cycle"
    );
    expect(hit.key).toBe("roles-of-fsh-and-lh-in-the-menstrual-cycle");
  });

  test("Edexcel: FSH & LH menstrual-cycle label resolves (not ADH sibling)", () => {
    const hit = resolveTopicLabelToKey(
      "edexcel-igcse-biology",
      "Roles of FSH and LH in the Menstrual Cycle"
    );
    expect(hit.key).toBe("roles-of-fsh-and-lh-in-the-menstrual-cycle");
  });

  test("Edexcel: human reproductive systems leaf", () => {
    const hit = resolveTopicLabelToKey(
      "edexcel-igcse-biology",
      "Human Male and Female Reproductive Systems"
    );
    expect(hit.key).toBe("human-male-and-female-reproductive-systems");
  });

  test("Edexcel: menstrual cycle oestrogen/progesterone leaf", () => {
    const hit = resolveTopicLabelToKey(
      "edexcel-igcse-biology",
      "Roles of Oestrogen & Progesterone in the Menstrual Cycle"
    );
    expect(hit.key).toBe("roles-of-oestrogen-and-progesterone-in-the-menstrual-cycle");
  });

  test("AQA regression: Cell structure still resolves", () => {
    const hit = resolveTopicLabelToKey("aqa-gcse-biology", "Cell structure");
    expect(hit.key).toBe("cell-structure");
  });

  test("loosenSlugForCompare treats and as optional", () => {
    expect(loosenSlugForCompare("roles-of-fsh-and-lh-in-the-menstrual-cycle")).toBe(
      loosenSlugForCompare("roles-of-fsh-lh-in-the-menstrual-cycle")
    );
  });
});
