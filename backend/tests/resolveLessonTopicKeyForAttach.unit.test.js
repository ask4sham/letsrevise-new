const { resolveLessonTopicKeyForAttach } = require("../utils/resolveLessonTopicKeyForAttach");

describe("resolveLessonTopicKeyForAttach", () => {
  it("resolves from subTopic when stored topicKey is title-derived", () => {
    const key = resolveLessonTopicKeyForAttach({
      specKey: "aqa-gcse-biology",
      topicKey: "response-to-exercise-bioenergetics-aqa-gcse-higher-tier",
      subTopic: "Response to exercise",
      topic: "Response to exercise – Bioenergetics (AQA GCSE) (Higher Tier)",
    });
    expect(key).toBe("aqa-gcse-biology:response-to-exercise");
  });

  it("accepts namespaced override from client", () => {
    const key = resolveLessonTopicKeyForAttach(
      { specKey: "aqa-gcse-biology", topic: "Not set" },
      "aqa-gcse-biology:respiration"
    );
    expect(key).toBe("aqa-gcse-biology:respiration");
  });

  it("resolves an Edexcel IGCSE Biology lesson against its own taxonomy (not AQA)", () => {
    const lesson = {
      specKey: "edexcel-igcse-biology",
      topicKey: "edexcel-igcse-biology:human-male-and-female-reproductive-systems",
      subTopic: "Human Reproductive Systems",
      topic: "Human Reproductive Systems (Edexcel IGCSE Biology) Exam code: 4BI1 (Higher Tier)",
    };
    expect(resolveLessonTopicKeyForAttach(lesson)).toBe(
      "edexcel-igcse-biology:human-male-and-female-reproductive-systems"
    );
    expect(
      resolveLessonTopicKeyForAttach(
        lesson,
        "edexcel-igcse-biology:human-male-and-female-reproductive-systems"
      )
    ).toBe("edexcel-igcse-biology:human-male-and-female-reproductive-systems");
  });

  it("still rejects an invalid slug within a known spec", () => {
    const key = resolveLessonTopicKeyForAttach({
      specKey: "edexcel-igcse-biology",
      topicKey: "edexcel-igcse-biology:not-a-real-topic-xyz",
    });
    expect(key).toBeNull();
  });
});
