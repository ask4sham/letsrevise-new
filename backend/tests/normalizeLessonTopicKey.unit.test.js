const {
  canonicalSlugFromText,
  isLikelyInvalidTopicSlug,
  normalizeLessonTopicSlug,
  normalizeNamespacedLessonTopicKey,
} = require("../utils/normalizeLessonTopicKey");
const { isValidTopicSlugForSpec } = require("../utils/specTopicRegistry");

describe("normalizeLessonTopicKey", () => {
  it("maps title-derived slug to photosynthesis for aqa-gcse-biology", () => {
    const bad = "photosynthetic-reaction-aqa-gcse-biology-higher-tier";
    expect(isLikelyInvalidTopicSlug(bad)).toBe(true);
    const r = normalizeLessonTopicSlug("aqa-gcse-biology", {
      topicKey: bad,
      title: "Photosynthetic Reaction (AQA GCSE Biology) (Higher Tier)",
    });
    expect(r.slug).toBe("photosynthesis");
    expect(isValidTopicSlugForSpec("aqa-gcse-biology", r.slug)).toBe(true);
    expect(r.namespaced).toBe("aqa-gcse-biology:photosynthesis");
  });

  it("normalizeNamespacedLessonTopicKey returns valid namespaced key", () => {
    const ns = normalizeNamespacedLessonTopicKey("aqa-gcse-biology", {
      topicKey: "photosynthetic-reaction-aqa-gcse-biology-higher-tier",
    });
    expect(ns).toBe("aqa-gcse-biology:photosynthesis");
  });

  it("canonicalSlugFromText handles photosynthetic and photosynthesis reaction", () => {
    expect(canonicalSlugFromText("photosynthetic reaction")).toBe("photosynthesis");
    expect(canonicalSlugFromText("photosynthesis reaction")).toBe("photosynthesis");
  });
});
