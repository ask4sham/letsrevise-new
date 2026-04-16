/**
 * Pattern B hardening — pure unit tests (no DB). Mocks in-memory spec topic registry mapping layer.
 */
jest.mock("../utils/specTopicRegistry", () => ({
  getRuntimeMappingForSpecSlug: jest.fn(),
  refreshSpecTopicRegistryCache: jest.fn(),
  isValidTopicSlugForSpec: jest.fn(),
}));

const { getRuntimeMappingForSpecSlug } = require("../utils/specTopicRegistry");
const {
  resolveQuestionBankNamespacedTopicKey,
  resolveAnalyticsNamespacedTopicKey,
  rollupTopicKeyForMastery,
  resolveTopicRuntimeKeys,
} = require("../utils/resolveTopicRuntimeKeys");

describe("Pattern B resolveTopicRuntimeKeys (mocked registry)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRuntimeMappingForSpecSlug.mockReturnValue(null);
  });

  test("resolveQuestionBankNamespacedTopicKey prefers inheritQuestionBankFrom", () => {
    getRuntimeMappingForSpecSlug.mockReturnValue({
      inheritQuestionBankFrom: "aqa-gcse-biology:cell-structure",
      mapsToCanonicalKey: "aqa-gcse-biology:photosynthesis",
    });
    expect(
      resolveQuestionBankNamespacedTopicKey("aqa-gcse-biology", "aqa-gcse-biology:custom-topic")
    ).toBe("aqa-gcse-biology:cell-structure");
  });

  test("resolveQuestionBankNamespacedTopicKey falls back to mapsToCanonicalKey", () => {
    getRuntimeMappingForSpecSlug.mockReturnValue({
      inheritQuestionBankFrom: "",
      mapsToCanonicalKey: "aqa-gcse-biology:photosynthesis",
    });
    expect(
      resolveQuestionBankNamespacedTopicKey("aqa-gcse-biology", "aqa-gcse-biology:custom-topic")
    ).toBe("aqa-gcse-biology:photosynthesis");
  });

  test("resolveAnalyticsNamespacedTopicKey prefers inheritAnalyticsFrom", () => {
    getRuntimeMappingForSpecSlug.mockReturnValue({
      inheritAnalyticsFrom: "aqa-gcse-biology:digestive-system",
      mapsToCanonicalKey: "aqa-gcse-biology:other",
    });
    expect(
      resolveAnalyticsNamespacedTopicKey("aqa-gcse-biology", "aqa-gcse-biology:custom-topic")
    ).toBe("aqa-gcse-biology:digestive-system");
  });

  test("rollupTopicKeyForMastery uses analytics inheritance for custom namespaced topic", () => {
    getRuntimeMappingForSpecSlug.mockReturnValue({
      inheritAnalyticsFrom: "aqa-gcse-biology:digestive-system",
    });
    expect(rollupTopicKeyForMastery("aqa-gcse-biology:stomach-custom")).toBe(
      "aqa-gcse-biology:digestive-system"
    );
  });

  test("resolveTopicRuntimeKeys returns all three projections", () => {
    getRuntimeMappingForSpecSlug.mockReturnValue({
      inheritQuestionBankFrom: "aqa-gcse-biology:cell-structure",
      inheritAnalyticsFrom: "aqa-gcse-biology:digestive-system",
    });
    const r = resolveTopicRuntimeKeys("aqa-gcse-biology", "aqa-gcse-biology:lab-topic");
    expect(r.resolvedTopicKey).toBe("aqa-gcse-biology:lab-topic");
    expect(r.questionBankTopicKey).toBe("aqa-gcse-biology:cell-structure");
    expect(r.analyticsTopicKey).toBe("aqa-gcse-biology:digestive-system");
  });
});
