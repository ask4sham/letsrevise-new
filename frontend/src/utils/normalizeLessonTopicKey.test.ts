import {
  canonicalSlugFromText,
  isLikelyInvalidTopicSlug,
  normalizeLessonTopicSlug,
} from "./normalizeLessonTopicKey";

describe("normalizeLessonTopicKey", () => {
  it("maps photosynthetic reaction title slug to photosynthesis", () => {
    const bad = "photosynthetic-reaction-aqa-gcse-biology-higher-tier";
    expect(isLikelyInvalidTopicSlug(bad)).toBe(true);
    expect(canonicalSlugFromText(bad)).toBe("photosynthesis");
    const r = normalizeLessonTopicSlug("aqa-gcse-biology", {
      topicKey: bad,
      title: "Photosynthetic Reaction (AQA GCSE Biology) (Higher Tier)",
    });
    expect(r.slug).toBe("photosynthesis");
    expect(r.namespaced).toBe("aqa-gcse-biology:photosynthesis");
    expect(r.repaired).toBe(true);
  });

  it("prefers canonicalTopicKey over invalid stored topicKey", () => {
    const r = normalizeLessonTopicSlug("aqa-gcse-biology", {
      topicKey: "photosynthetic-reaction-aqa-gcse-biology-higher-tier",
      canonicalTopicKey: "photosynthesis",
    });
    expect(r.slug).toBe("photosynthesis");
    expect(r.namespaced).toBe("aqa-gcse-biology:photosynthesis");
  });

  it("recognises photosynthesis reaction phrasing", () => {
    expect(canonicalSlugFromText("photosynthesis reaction")).toBe("photosynthesis");
    expect(canonicalSlugFromText("bioenergetics photosynthesis")).toBe("photosynthesis");
  });
});
