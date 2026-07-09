/**
 * Simulated create-lesson taxonomy finalize (mirrors POST /api/lessons contract).
 */
const { parseTopicKey, buildTopicKey } = require("../utils/topicKey");
const { normalizeNamespacedLessonTopicKey } = require("../utils/normalizeLessonTopicKey");
const { assertValidNamespacedTopicKey } = require("../utils/specTopicValidation");
const { resolveSpecIdentity } = require("../config/specRegistry");

function simulateCreateTopicNormalization(lessonData) {
  if (typeof lessonData.topicKey !== "string" || !lessonData.topicKey.trim()) {
    return lessonData;
  }
  const spec =
    (lessonData.specKey && String(lessonData.specKey).trim()) ||
    parseTopicKey(lessonData.topicKey).specKey ||
    "aqa-gcse-biology";
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
  lessonData.specKey = lessonData.specKey || spec;

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
  if (!lessonData.canonicalTopicKey && lessonData.topicKey.includes(":")) {
    lessonData.canonicalTopicKey = lessonData.topicKey.slice(lessonData.topicKey.indexOf(":") + 1);
  }
  return lessonData;
}

describe("createLessonTaxonomyPersist (contract)", () => {
  test("Edexcel IGCSE Biology persists namespaced topicKey, canonicalTopicKey, board, level", () => {
    const out = simulateCreateTopicNormalization({
      title: "Roles of FSH & LH",
      subject: "Biology",
      level: "GCSE",
      board: "Edexcel",
      topic: "Roles of FSH & LH in the Menstrual Cycle",
      topicKey: "edexcel-igcse-biology:roles-of-fsh-and-lh-in-the-menstrual-cycle",
      specKey: "edexcel-igcse-biology",
      subTopic: "Roles of FSH & LH in the Menstrual Cycle",
    });
    expect(out.topicKey).toBe(
      "edexcel-igcse-biology:roles-of-fsh-and-lh-in-the-menstrual-cycle"
    );
    expect(out.specKey).toBe("edexcel-igcse-biology");
    expect(out.canonicalTopicKey).toBe("roles-of-fsh-and-lh-in-the-menstrual-cycle");
    expect(out.board).toBe("Edexcel");
    expect(out.level).toBe("IGCSE");
  });

  test("AQA GCSE Biology still persists without IGCSE rewrite", () => {
    const out = simulateCreateTopicNormalization({
      title: "Cell structure",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      topicKey: "aqa-gcse-biology:cell-structure",
      specKey: "aqa-gcse-biology",
    });
    expect(out.topicKey).toBe("aqa-gcse-biology:cell-structure");
    expect(out.specKey).toBe("aqa-gcse-biology");
    expect(out.canonicalTopicKey).toBe("cell-structure");
    expect(out.board).toBe("AQA");
    expect(out.level).toBe("GCSE");
  });
});
