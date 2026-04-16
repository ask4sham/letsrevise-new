/**
 * specTopicValidation + registry interaction (mock wraps real isValidTopicSlugForSpec).
 */
jest.mock("../utils/specTopicRegistry", () => {
  const actual = jest.requireActual("../utils/specTopicRegistry");
  return {
    ...actual,
    isValidTopicSlugForSpec: jest.fn((spec, slug) => actual.isValidTopicSlugForSpec(spec, slug)),
  };
});

const specTopicRegistry = require("../utils/specTopicRegistry");
const actualRegistry = jest.requireActual("../utils/specTopicRegistry");
const { assertValidSpecTopic, assertValidNamespacedTopicKey } = require("../utils/specTopicValidation");

describe("assertValidNamespacedTopicKey (prefix / format)", () => {
  test("rejects namespaced key for a different spec", () => {
    expect(() =>
      assertValidNamespacedTopicKey("aqa-gcse-biology", "aqa-gcse-chemistry:cell-structure")
    ).toThrow();
  });
});

describe("assertValidSpecTopic with wrapped isValidTopicSlugForSpec", () => {
  beforeEach(() => {
    specTopicRegistry.isValidTopicSlugForSpec.mockImplementation((spec, slug) =>
      actualRegistry.isValidTopicSlugForSpec(spec, slug)
    );
  });

  test("fails when slug is not in static taxonomy and registry rejects", () => {
    specTopicRegistry.isValidTopicSlugForSpec.mockReturnValue(false);
    expect(() => assertValidSpecTopic({ specKey: "aqa-gcse-biology", topicKey: "not-in-static-or-registry" })).toThrow();
  });

  test("succeeds when wrapped registry accepts custom slug (Pattern B admin sub-topic)", () => {
    specTopicRegistry.isValidTopicSlugForSpec.mockImplementation((spec, slug) => {
      if (slug === "custom-stomach") return true;
      return actualRegistry.isValidTopicSlugForSpec(spec, slug);
    });
    expect(() => assertValidSpecTopic({ specKey: "aqa-gcse-biology", topicKey: "custom-stomach" })).not.toThrow();
  });
});
