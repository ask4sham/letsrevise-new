const { resolveLessonCreateSpecKey } = require("../utils/resolveLessonCreateSpecKey");
const { normalizeNamespacedLessonTopicKey } = require("../utils/normalizeLessonTopicKey");
const { assertValidNamespacedTopicKey } = require("../utils/specTopicValidation");
const { resolveSpecIdentity } = require("../config/specRegistry");
const { parseTopicKey, buildTopicKey, DEFAULT_SPEC_LEGACY } = require("../utils/topicKey");

function simulateCreateTopicNormalization(lessonData) {
  if (typeof lessonData.topicKey !== "string" || !lessonData.topicKey.trim()) {
    const specOnly = resolveLessonCreateSpecKey(lessonData);
    if (specOnly) {
      lessonData.specKey = specOnly;
      const identity = resolveSpecIdentity({
        specKey: specOnly,
        board: lessonData.board,
        subject: lessonData.subject,
        level: lessonData.level,
      });
      if (identity.board) lessonData.board = identity.board;
      if (identity.level) lessonData.level = identity.level;
      if (identity.subject) lessonData.subject = identity.subject;
    }
    return lessonData;
  }
  const spec = resolveLessonCreateSpecKey(lessonData);
  if (!spec) {
    const err = new Error("unresolved spec");
    err.code = "INVALID_SPEC_KEY";
    throw err;
  }
  const namespaced =
    normalizeNamespacedLessonTopicKey(spec, {
      topicKey: lessonData.topicKey,
      canonicalTopicKey: lessonData.canonicalTopicKey,
      title: lessonData.title,
      topic: lessonData.topic,
      subTopic: lessonData.subTopic,
    }) ||
    (lessonData.topicKey.trim().includes(":")
      ? lessonData.topicKey.trim()
      : buildTopicKey(spec, lessonData.topicKey.trim()));
  assertValidNamespacedTopicKey(spec, namespaced);
  lessonData.topicKey = namespaced;
  lessonData.specKey = spec;
  const identity = resolveSpecIdentity({
    topicKey: lessonData.topicKey,
    specKey: lessonData.specKey,
    board: lessonData.board,
    subject: lessonData.subject,
    level: lessonData.level,
    title: lessonData.title,
    topic: lessonData.topic,
    subTopic: lessonData.subTopic,
  });
  if (identity.specKey) lessonData.specKey = identity.specKey;
  if (identity.level) lessonData.level = identity.level;
  if (identity.board) lessonData.board = identity.board;
  if (identity.subject) lessonData.subject = identity.subject;
  if (lessonData.topicKey.includes(":")) {
    lessonData.canonicalTopicKey = lessonData.topicKey.slice(lessonData.topicKey.indexOf(":") + 1);
  }
  return lessonData;
}

describe("resolveLessonCreateSpecKey", () => {
  test("explicit Edexcel + IGCSE + valid specKey persists Edexcel taxonomy", () => {
    const out = simulateCreateTopicNormalization({
      title: "Adaptations for Pollination",
      subject: "Biology",
      level: "IGCSE",
      board: "Edexcel",
      topic: "Adaptations for Pollination",
      topicKey: "reproduction/adaptations-for-pollination",
      canonicalTopicKey: "reproduction/adaptations-for-pollination",
      specKey: "edexcel-igcse-biology",
      tier: "higher",
    });
    expect(out.board).toBe("Edexcel");
    expect(out.level).toBe("IGCSE");
    expect(out.specKey).toBe("edexcel-igcse-biology");
    expect(out.topicKey).toBe("edexcel-igcse-biology:adaptations-for-pollination");
    expect(out.canonicalTopicKey).toBe("adaptations-for-pollination");
  });

  test("explicit Edexcel + IGCSE without specKey does not fall back to AQA", () => {
    expect(
      resolveLessonCreateSpecKey({
        board: "Edexcel",
        level: "IGCSE",
        subject: "Biology",
        topicKey: "reproduction/adaptations-for-pollination",
      })
    ).toBe("edexcel-igcse-biology");

    const out = simulateCreateTopicNormalization({
      title: "Adaptations for Pollination",
      subject: "Biology",
      level: "IGCSE",
      board: "Edexcel",
      topic: "Adaptations for Pollination",
      topicKey: "reproduction/adaptations-for-pollination",
      canonicalTopicKey: "reproduction/adaptations-for-pollination",
    });
    expect(out.board).toBe("Edexcel");
    expect(out.level).toBe("IGCSE");
    expect(out.specKey).toBe("edexcel-igcse-biology");
    expect(out.topicKey).toBe("edexcel-igcse-biology:adaptations-for-pollination");
    expect(out.specKey).not.toBe(DEFAULT_SPEC_LEGACY);
  });

  test("valid namespaced Edexcel topicKey resolves Edexcel", () => {
    const out = simulateCreateTopicNormalization({
      title: "Adaptations for Pollination",
      subject: "Biology",
      topicKey: "edexcel-igcse-biology:adaptations-for-pollination",
    });
    expect(out.specKey).toBe("edexcel-igcse-biology");
    expect(out.board).toBe("Edexcel");
    expect(out.level).toBe("IGCSE");
  });

  test("legacy payload with no taxonomy identity retains AQA fallback", () => {
    expect(resolveLessonCreateSpecKey({})).toBe(DEFAULT_SPEC_LEGACY);
    expect(
      resolveLessonCreateSpecKey({
        topicKey: "cell-structure",
      })
    ).toBe(DEFAULT_SPEC_LEGACY);
  });

  test("resolveSpecIdentity does not overwrite explicit Edexcel using unrelated AQA default", () => {
    const spec = resolveLessonCreateSpecKey({
      board: "Edexcel",
      level: "IGCSE",
      subject: "Biology",
      topicKey: "adaptations-for-pollination",
    });
    expect(spec).toBe("edexcel-igcse-biology");
    const identity = resolveSpecIdentity({
      specKey: spec,
      board: "Edexcel",
      level: "IGCSE",
      subject: "Biology",
      topicKey: "edexcel-igcse-biology:adaptations-for-pollination",
    });
    expect(identity.board).toBe("Edexcel");
    expect(identity.level).toBe("IGCSE");
    expect(identity.specKey).toBe("edexcel-igcse-biology");
  });

  test("AQA create path remains AQA GCSE", () => {
    const out = simulateCreateTopicNormalization({
      title: "Cell structure",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      topicKey: "aqa-gcse-biology:cell-structure",
      specKey: "aqa-gcse-biology",
    });
    expect(out.board).toBe("AQA");
    expect(out.level).toBe("GCSE");
    expect(out.specKey).toBe("aqa-gcse-biology");
    expect(parseTopicKey(out.topicKey).specKey).toBe("aqa-gcse-biology");
  });
});
