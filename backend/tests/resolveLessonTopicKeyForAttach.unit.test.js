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
});
