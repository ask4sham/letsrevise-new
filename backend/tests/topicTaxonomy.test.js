/**
 * USP 3a: topicTaxonomy findTopicByKey unit test.
 */
const { findTopicByKey, getBiologyTopics } = require("../utils/topicTaxonomy");

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
