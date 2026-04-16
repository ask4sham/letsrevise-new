/**
 * Pattern B: validation accepts static JSON keys; admin overlay is sync-cached (empty in Jest without refresh).
 */
const { assertValidSpecTopic, assertValidNamespacedTopicKey } = require("../utils/specTopicValidation");

describe("specTopicValidation (canonical topics)", () => {
  test("assertValidSpecTopic accepts static biology slug", () => {
    expect(() => assertValidSpecTopic({ specKey: "aqa-gcse-biology", topicKey: "digestive-system" })).not.toThrow();
  });

  test("assertValidNamespacedTopicKey accepts namespaced canonical", () => {
    expect(() =>
      assertValidNamespacedTopicKey("aqa-gcse-biology", "aqa-gcse-biology:digestive-system")
    ).not.toThrow();
  });

  test("unknown slug still fails when not in static or cache", () => {
    expect(() => assertValidSpecTopic({ specKey: "aqa-gcse-biology", topicKey: "not-a-real-topic-slug-xyz" })).toThrow();
  });
});
