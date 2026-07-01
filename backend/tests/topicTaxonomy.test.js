/**
 * USP 3a: topicTaxonomy findTopicByKey unit test.
 */
const {
  findTopicByKey,
  getBiologyTopics,
  isValidTopicForSpec,
  findEdexcelIgcseBiologyTopicByKey,
} = require("../utils/topicTaxonomy");

const EDEXCEL_MENSTRUAL_CYCLE_KEY = "roles-of-oestrogen-and-progesterone-in-the-menstrual-cycle";
const EDEXCEL_MENSTRUAL_CYCLE_NAMESPACED = `edexcel-igcse-biology:${EDEXCEL_MENSTRUAL_CYCLE_KEY}`;

describe("topicTaxonomy", () => {
  test("findTopicByKey returns topic for valid key", () => {
    const t = findTopicByKey("photosynthesis");
    expect(t).not.toBeNull();
    expect(t.topic).toBe("Photosynthesis");
    expect(t.key).toBe("photosynthesis");
  });

  test("findTopicByKey returns topic for cell-structure", () => {
    const t = findTopicByKey("cell-structure");
    expect(t).not.toBeNull();
    expect(t.topic).toBe("Cell structure");
  });

  test("findTopicByKey returns null for invalid key", () => {
    expect(findTopicByKey("not-a-key")).toBeNull();
    expect(findTopicByKey("")).toBeNull();
    expect(findTopicByKey(null)).toBeNull();
  });

  test("getBiologyTopics returns subject, examBoard, level, units", () => {
    const tax = getBiologyTopics();
    expect(tax.subject).toBe("Biology");
    expect(tax.examBoard).toBe("AQA");
    expect(tax.level).toBe("GCSE");
    expect(Array.isArray(tax.units)).toBe(true);
    expect(tax.units.length).toBeGreaterThan(0);
  });
});

describe("Edexcel IGCSE Biology topic validation", () => {
  test("findEdexcelIgcseBiologyTopicByKey accepts leaf topic slug", () => {
    const t = findEdexcelIgcseBiologyTopicByKey(EDEXCEL_MENSTRUAL_CYCLE_KEY);
    expect(t).not.toBeNull();
    expect(t.key).toBe(EDEXCEL_MENSTRUAL_CYCLE_KEY);
    expect(t.topic).toMatch(/Oestrogen/i);
  });

  test("findEdexcelIgcseBiologyTopicByKey accepts namespaced topicKey", () => {
    const t = findEdexcelIgcseBiologyTopicByKey(EDEXCEL_MENSTRUAL_CYCLE_NAMESPACED);
    expect(t).not.toBeNull();
    expect(t.topicKey).toBe(EDEXCEL_MENSTRUAL_CYCLE_NAMESPACED);
  });

  test("isValidTopicForSpec accepts valid Edexcel leaf topic", () => {
    expect(isValidTopicForSpec("edexcel-igcse-biology", EDEXCEL_MENSTRUAL_CYCLE_KEY)).toBe(true);
    expect(isValidTopicForSpec("edexcel-igcse-biology", EDEXCEL_MENSTRUAL_CYCLE_NAMESPACED)).toBe(true);
  });

  test("isValidTopicForSpec rejects invalid Edexcel topic", () => {
    expect(isValidTopicForSpec("edexcel-igcse-biology", "not-a-real-edexcel-topic")).toBe(false);
  });

  test("isValidTopicForSpec rejects Edexcel main topic key", () => {
    expect(isValidTopicForSpec("edexcel-igcse-biology", "reproduction-and-inheritance")).toBe(false);
  });

  test("isValidTopicForSpec rejects Edexcel section slug", () => {
    expect(isValidTopicForSpec("edexcel-igcse-biology", "reproduction")).toBe(false);
  });

  test("AQA GCSE Biology validation remains unchanged", () => {
    expect(isValidTopicForSpec("aqa-gcse-biology", "photosynthesis")).toBe(true);
    expect(isValidTopicForSpec("aqa-gcse-biology", "not-a-real-topic-key-xyz")).toBe(false);
  });
});
