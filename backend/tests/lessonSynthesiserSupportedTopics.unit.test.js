"use strict";

const {
  mapTeacherBodyToSynthesiseInput,
} = require("../services/lessonSynthesiser/supportedTopics");

describe("Lesson Synthesiser supported topics (P1)", () => {
  test("maps Edexcel IGCSE gametes with namespaced topicKey and omits tier (4BI1 untiered)", () => {
    const mapped = mapTeacherBodyToSynthesiseInput({
      subject: "Biology",
      level: "IGCSE",
      board: "Edexcel",
      topic: "Gametes and Fertilisation",
      specKey: "edexcel-igcse-biology",
      topicKey: "edexcel-igcse-biology:gametes-and-fertilisation",
      tier: "Higher",
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.synthesiseInput.tier).toBeUndefined();
    expect(mapped.synthesiseInput.topicKey).toBe("reproduction/gametes-fertilisation");
  });

  test("teacher taxonomy gametes-and-fertilisation maps to Synthesiser topicKey", () => {
    const mapped = mapTeacherBodyToSynthesiseInput({
      subject: "Biology",
      level: "IGCSE",
      board: "Edexcel",
      topic: "Gametes & Fertilisation",
      specKey: "edexcel-igcse-biology",
      topicKey: "edexcel-igcse-biology:gametes-and-fertilisation",
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.synthesiseInput.topicKey).toBe("reproduction/gametes-fertilisation");
    expect(mapped.teacherTopicKey).toBe(
      "edexcel-igcse-biology:gametes-and-fertilisation"
    );
  });

  test("unsupported topic returns SYNTHESISER_TOPIC_UNSUPPORTED", () => {
    const mapped = mapTeacherBodyToSynthesiseInput({
      subject: "Biology",
      level: "IGCSE",
      board: "Edexcel",
      specKey: "edexcel-igcse-biology",
      topicKey: "reproduction/unknown-unit",
      topic: "Unknown",
    });
    expect(mapped.ok).toBe(false);
    expect(mapped.code).toBe("SYNTHESISER_TOPIC_UNSUPPORTED");
  });
});
