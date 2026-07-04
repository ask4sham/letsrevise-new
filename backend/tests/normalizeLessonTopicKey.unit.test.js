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

  it("maps title-derived slug to respiration for aqa-gcse-biology", () => {
    const bad = "aerobic-anaerobic-respiration-aqa-gcse-biology-higher-tier";
    expect(isLikelyInvalidTopicSlug(bad)).toBe(true);
    const r = normalizeLessonTopicSlug("aqa-gcse-biology", {
      topicKey: bad,
      title: "Aerobic and anaerobic respiration (AQA GCSE Biology) (Higher Tier)",
    });
    expect(r.slug).toBe("respiration");
    expect(isValidTopicSlugForSpec("aqa-gcse-biology", r.slug)).toBe(true);
    expect(r.namespaced).toBe("aqa-gcse-biology:respiration");
  });

  it("maps composite Metabolism lesson topic to metabolism", () => {
    const r = normalizeLessonTopicSlug("aqa-gcse-biology", {
      topic: "Biology — Metabolism (AQA GCSE Biology)",
      title: "Metabolism (AQA GCSE Biology)",
    });
    expect(r.slug).toBe("metabolism");
    expect(r.namespaced).toBe("aqa-gcse-biology:metabolism");
  });

  it("maps Response to exercise sub-topic via subTopic label", () => {
    const r = normalizeLessonTopicSlug("aqa-gcse-biology", {
      topicKey: "response-to-exercise-bioenergetics-aqa-gcse-higher-tier",
      subTopic: "Response to exercise",
      topic: "Response to exercise – Bioenergetics (AQA GCSE) (Higher Tier)",
    });
    expect(r.slug).toBe("response-to-exercise");
    expect(r.namespaced).toBe("aqa-gcse-biology:response-to-exercise");
  });

  it("accepts long stored slug when valid for Edexcel IGCSE spec", () => {
    const longValid = "roles-of-oestrogen-and-progesterone-in-the-menstrual-cycle";
    expect(longValid.length).toBeGreaterThan(48);
    expect(isLikelyInvalidTopicSlug(longValid)).toBe(true);
    expect(isValidTopicSlugForSpec("edexcel-igcse-biology", longValid)).toBe(true);
    const r = normalizeLessonTopicSlug("edexcel-igcse-biology", {
      topicKey: `edexcel-igcse-biology:${longValid}`,
    });
    expect(r.slug).toBe(longValid);
    expect(r.namespaced).toBe(`edexcel-igcse-biology:${longValid}`);
    expect(r.repaired).toBe(false);
  });

  it("still resolves human reproductive systems stored topicKey", () => {
    const slug = "human-male-and-female-reproductive-systems";
    const r = normalizeLessonTopicSlug("edexcel-igcse-biology", {
      topicKey: `edexcel-igcse-biology:${slug}`,
    });
    expect(r.slug).toBe(slug);
    expect(r.namespaced).toBe(`edexcel-igcse-biology:${slug}`);
  });

  it("rejects long random slug that is not in taxonomy", () => {
    const bad = "totally-made-up-long-slug-that-is-not-in-the-edexcel-taxonomy-at-all";
    expect(isLikelyInvalidTopicSlug(bad)).toBe(true);
    expect(isValidTopicSlugForSpec("edexcel-igcse-biology", bad)).toBe(false);
    const r = normalizeLessonTopicSlug("edexcel-igcse-biology", {
      topicKey: `edexcel-igcse-biology:${bad}`,
      title: bad,
    });
    expect(r.slug).toBeNull();
    expect(r.namespaced).toBeNull();
  });
});
