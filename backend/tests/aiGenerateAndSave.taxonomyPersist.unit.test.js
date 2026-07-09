/**
 * AI generate-and-save taxonomy persist contract (unit-level, no OpenAI).
 * Ensures namespaced topicKey + specKey + canonicalTopicKey when taxonomy match exists.
 */
const { parseTopicKey } = require("../utils/topicKey");
const { resolveSpecIdentity } = require("../config/specRegistry");
const { resolveSpecAndTopicKey } = require("../services/syllabusAlignment");
const { isValidTopicForSpec } = require("../utils/topicTaxonomy");

function simulateAiTaxonomyPersist({ topicKey, bodySpecKey, board, subject, level, topic }) {
  let specKey =
    (topicKey && parseTopicKey(topicKey).specKey) ||
    bodySpecKey ||
    null;

  const rawFromRequest = topicKey ? parseTopicKey(topicKey).topicKey || topicKey.trim() : null;
  let canonicalTopicKey = rawFromRequest || null;

  if (!canonicalTopicKey) {
    const resolved = resolveSpecAndTopicKey(board, subject, topic, level);
    if (!resolved) return null;
    canonicalTopicKey = resolved.topicKey;
    if (!specKey) specKey = resolved.specKey;
  }

  if (specKey && canonicalTopicKey && !isValidTopicForSpec(specKey, canonicalTopicKey)) {
    return { error: "unmapped" };
  }

  const namespacedLessonTopicKey =
    topicKey && String(topicKey).includes(":")
      ? topicKey
      : canonicalTopicKey
        ? `${specKey}:${canonicalTopicKey}`
        : null;

  const identity = resolveSpecIdentity({
    topicKey: namespacedLessonTopicKey,
    specKey: bodySpecKey || specKey,
    board,
    subject,
    level,
    topic,
  });

  return {
    topicKey: namespacedLessonTopicKey,
    specKey: identity.specKey || specKey,
    canonicalTopicKey:
      (namespacedLessonTopicKey && parseTopicKey(namespacedLessonTopicKey).topicKey) ||
      canonicalTopicKey,
    board: identity.board,
    level: identity.level,
  };
}

describe("AI generate-and-save taxonomy persist contract", () => {
  test("Edexcel namespaced topicKey is not saved as slug-only", () => {
    const out = simulateAiTaxonomyPersist({
      topicKey: "edexcel-igcse-biology:roles-of-fsh-and-lh-in-the-menstrual-cycle",
      bodySpecKey: "edexcel-igcse-biology",
      board: "Edexcel",
      subject: "Biology",
      level: "IGCSE",
      topic: "Roles of FSH & LH in the Menstrual Cycle",
    });
    expect(out.topicKey).toBe(
      "edexcel-igcse-biology:roles-of-fsh-and-lh-in-the-menstrual-cycle"
    );
    expect(out.specKey).toBe("edexcel-igcse-biology");
    expect(out.canonicalTopicKey).toBe("roles-of-fsh-and-lh-in-the-menstrual-cycle");
    expect(out.level).toBe("IGCSE");
    expect(out.board).toBe("Edexcel");
  });

  test("Edexcel slug-only request is namespaced when specKey known", () => {
    const out = simulateAiTaxonomyPersist({
      topicKey: "roles-of-fsh-and-lh-in-the-menstrual-cycle",
      bodySpecKey: "edexcel-igcse-biology",
      board: "Edexcel",
      subject: "Biology",
      level: "IGCSE",
      topic: "Roles of FSH & LH in the Menstrual Cycle",
    });
    expect(out.topicKey).toBe(
      "edexcel-igcse-biology:roles-of-fsh-and-lh-in-the-menstrual-cycle"
    );
    expect(out.specKey).toBe("edexcel-igcse-biology");
  });

  test("Edexcel label resolve via syllabusAlignment when topicKey omitted", () => {
    const out = simulateAiTaxonomyPersist({
      topicKey: null,
      bodySpecKey: null,
      board: "Edexcel",
      subject: "Biology",
      level: "IGCSE",
      topic: "Roles of FSH & LH in the Menstrual Cycle",
    });
    expect(out).not.toBeNull();
    expect(out.topicKey).toBe(
      "edexcel-igcse-biology:roles-of-fsh-and-lh-in-the-menstrual-cycle"
    );
    expect(out.specKey).toBe("edexcel-igcse-biology");
  });

  test("AQA still namespaced", () => {
    const out = simulateAiTaxonomyPersist({
      topicKey: "aqa-gcse-biology:cell-structure",
      bodySpecKey: "aqa-gcse-biology",
      board: "AQA",
      subject: "Biology",
      level: "GCSE",
      topic: "Cell structure",
    });
    expect(out.topicKey).toBe("aqa-gcse-biology:cell-structure");
    expect(out.level).toBe("GCSE");
  });
});
