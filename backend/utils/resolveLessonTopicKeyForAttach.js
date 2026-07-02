/**
 * Resolve lesson (or explicit override) to a valid namespaced topicKey for attach / classroom-ready.
 * Uses normalizeLessonTopicKey — same path as lesson save — not raw topicToKey(lesson.topic).
 */
const { parseTopicKey, buildTopicKey, DEFAULT_SPEC_LEGACY } = require("./topicKey");
const { normalizeNamespacedLessonTopicKey } = require("./normalizeLessonTopicKey");
const { isValidTopicForSpec } = require("./topicTaxonomy");

function lessonSpecKey(lesson) {
  const spec = lesson?.specKey && String(lesson.specKey).trim();
  if (spec) return spec;
  const tk = lesson?.topicKey && String(lesson.topicKey).trim();
  if (tk && tk.includes(":")) {
    const parsed = parseTopicKey(tk);
    if (parsed.specKey) return parsed.specKey;
  }
  return DEFAULT_SPEC_LEGACY;
}

function lessonFieldsForNormalize(lesson) {
  return {
    topicKey: lesson?.topicKey,
    canonicalTopicKey: lesson?.canonicalTopicKey ?? lesson?.metadata?.canonicalTopicKey,
    title: lesson?.title,
    topic: lesson?.topic,
    subTopic: lesson?.subTopic,
  };
}

/**
 * Spec-aware taxonomy check. Validates the topic slug against the lesson's own
 * spec taxonomy (AQA GCSE Biology, Edexcel IGCSE Biology, Chemistry, Physics, …)
 * rather than defaulting every subject to AQA GCSE Biology.
 * @param {string} specKey
 * @param {string} slug - unprefixed topic slug
 * @returns {boolean}
 */
function slugInSpecTaxonomy(specKey, slug) {
  if (!slug || typeof slug !== "string") return false;
  const spec = (specKey && String(specKey).trim()) || DEFAULT_SPEC_LEGACY;
  return isValidTopicForSpec(spec, slug.trim().toLowerCase());
}

/**
 * @param {Object} lesson
 * @param {string|null|undefined} overrideTopicKey - optional body topicKey (slug or namespaced)
 * @returns {string|null} namespaced topicKey e.g. aqa-gcse-biology:response-to-exercise
 */
function resolveLessonTopicKeyForAttach(lesson, overrideTopicKey = null) {
  const override =
    overrideTopicKey != null && String(overrideTopicKey).trim() !== ""
      ? String(overrideTopicKey).trim()
      : null;

  const spec =
    override && override.includes(":")
      ? parseTopicKey(override).specKey || lessonSpecKey(lesson)
      : lessonSpecKey(lesson);

  if (override) {
    const namespaced =
      normalizeNamespacedLessonTopicKey(spec, {
        topicKey: override,
        ...lessonFieldsForNormalize(lesson),
      }) || (override.includes(":") ? override : null);
    if (namespaced) {
      const nsParsed = parseTopicKey(namespaced);
      const slug = nsParsed.topicKey;
      if (slugInSpecTaxonomy(nsParsed.specKey || spec, slug)) return namespaced;
    }
    const parsed = parseTopicKey(override);
    const slug = (parsed.topicKey || override).toLowerCase();
    if (slugInSpecTaxonomy(parsed.specKey || spec, slug)) {
      return buildTopicKey(parsed.specKey || spec, slug);
    }
    return null;
  }

  const namespaced = normalizeNamespacedLessonTopicKey(spec, lessonFieldsForNormalize(lesson));
  if (!namespaced) return null;
  const nsParsed = parseTopicKey(namespaced);
  const slug = nsParsed.topicKey;
  return slugInSpecTaxonomy(nsParsed.specKey || spec, slug) ? namespaced : null;
}

module.exports = {
  resolveLessonTopicKeyForAttach,
  lessonSpecKey,
};
