"use strict";

/**
 * BFF boundary: main-app (teacher taxonomy) topic identity → Lesson Synthesiser pack identity.
 *
 * Teacher authority: namespaced topicKey from create-lesson taxonomy
 * (e.g. backend/config/edexcel_igcse_biology_topics.json → topicKey field).
 *
 * Synthesiser authority: curriculum pack topicKey route (e.g. reproduction/gametes-fertilisation
 * in letsrevise-lesson-synthesiser edexcel-igcse-biology pack).
 *
 * Add new supported topics by extending P1_TOPIC_BRIDGES — no heuristics, fail-closed.
 */

const { buildTopicKey, parseTopicKey } = require("../../utils/topicKey");

const TIER_MODE = Object.freeze({
  TIERED: "TIERED",
  UNTIERED: "UNTIERED",
});

/**
 * Declarative bridges for P1-supported topics only.
 * @type {ReadonlyArray<{
 *   id: string,
 *   teacherSpecKey: string,
 *   teacherTopicKey: string,
 *   teacherCanonicalSlug: string,
 *   taxonomySource: string,
 *   synthesiserSpecKey: string,
 *   synthesiserTopicKey: string,
 *   synthesiserSource: string,
 *   subject: string,
 *   level: string,
 *   examBoard: string,
 *   tierMode: string,
 *   displayTopic: string,
 * }>}
 */
const P1_TOPIC_BRIDGES = Object.freeze([
  Object.freeze({
    id: "p1-edexcel-igcse-biology-gametes",
    teacherSpecKey: "edexcel-igcse-biology",
    teacherTopicKey: "edexcel-igcse-biology:gametes-and-fertilisation",
    teacherCanonicalSlug: "gametes-and-fertilisation",
    taxonomySource: "backend/config/edexcel_igcse_biology_topics.json (key: gametes-and-fertilisation)",
    synthesiserSpecKey: "edexcel-igcse-biology",
    synthesiserTopicKey: "reproduction/gametes-fertilisation",
    synthesiserSource:
      "Lesson Synthesiser pack edexcel-igcse-biology TOPIC_PACKS topicKey / canonicalTopicKey",
    subject: "Biology",
    level: "IGCSE",
    examBoard: "Edexcel",
    tierMode: TIER_MODE.UNTIERED,
    displayTopic: "Gametes and Fertilisation",
  }),
  Object.freeze({
    id: "p1-edexcel-igcse-biology-sexual-vs-asexual",
    teacherSpecKey: "edexcel-igcse-biology",
    teacherTopicKey:
      "edexcel-igcse-biology:sexual-and-asexual-reproduction-differences",
    teacherCanonicalSlug: "sexual-and-asexual-reproduction-differences",
    taxonomySource:
      "backend/config/edexcel_igcse_biology_topics.json (key: sexual-and-asexual-reproduction-differences)",
    synthesiserSpecKey: "edexcel-igcse-biology",
    synthesiserTopicKey: "reproduction/sexual-vs-asexual-reproduction",
    synthesiserSource:
      "Lesson Synthesiser pack edexcel-igcse-biology TOPIC_PACKS reproduction/sexual-vs-asexual-reproduction",
    subject: "Biology",
    level: "IGCSE",
    examBoard: "Edexcel",
    tierMode: TIER_MODE.UNTIERED,
    displayTopic: "Sexual and Asexual Reproduction: Differences",
  }),
  Object.freeze({
    id: "p1-edexcel-igcse-biology-photosynthesis-process",
    teacherSpecKey: "edexcel-igcse-biology",
    teacherTopicKey: "edexcel-igcse-biology:the-process-of-photosynthesis",
    teacherCanonicalSlug: "the-process-of-photosynthesis",
    taxonomySource:
      "backend/config/edexcel_igcse_biology_topics.json (key: the-process-of-photosynthesis)",
    synthesiserSpecKey: "edexcel-igcse-biology",
    synthesiserTopicKey: "photosynthesis/the-process-of-photosynthesis",
    synthesiserSource:
      "Lesson Synthesiser pack edexcel-igcse-biology photosynthesis/the-process-of-photosynthesis",
    subject: "Biology",
    level: "IGCSE",
    examBoard: "Edexcel",
    tierMode: TIER_MODE.UNTIERED,
    displayTopic: "The Process of Photosynthesis",
  }),
  Object.freeze({
    id: "p1-edexcel-igcse-biology-levels-of-organisation",
    teacherSpecKey: "edexcel-igcse-biology",
    teacherTopicKey: "edexcel-igcse-biology:levels-of-organisation",
    teacherCanonicalSlug: "levels-of-organisation",
    taxonomySource:
      "backend/config/edexcel_igcse_biology_topics.json (key: levels-of-organisation)",
    synthesiserSpecKey: "edexcel-igcse-biology",
    synthesiserTopicKey: "organisation/levels-of-organisation",
    synthesiserSource:
      "Lesson Synthesiser pack edexcel-igcse-biology organisation/levels-of-organisation",
    subject: "Biology",
    level: "IGCSE",
    examBoard: "Edexcel",
    tierMode: TIER_MODE.UNTIERED,
    displayTopic: "Levels of Organisation",
  }),
  Object.freeze({
    id: "p1-edexcel-igcse-biology-pathogens",
    teacherSpecKey: "edexcel-igcse-biology",
    teacherTopicKey: "edexcel-igcse-biology:pathogens",
    teacherCanonicalSlug: "pathogens",
    taxonomySource: "backend/config/edexcel_igcse_biology_topics.json (key: pathogens)",
    synthesiserSpecKey: "edexcel-igcse-biology",
    synthesiserTopicKey: "variety/pathogens",
    synthesiserSource:
      "Lesson Synthesiser pack edexcel-igcse-biology variety/pathogens",
    subject: "Biology",
    level: "IGCSE",
    examBoard: "Edexcel",
    tierMode: TIER_MODE.UNTIERED,
    displayTopic: "Pathogens",
  }),
  Object.freeze({
    id: "p1-edexcel-igcse-biology-animal-plant-cells",
    teacherSpecKey: "edexcel-igcse-biology",
    teacherTopicKey:
      "edexcel-igcse-biology:animal-and-plant-cells-similarities-and-differences",
    teacherCanonicalSlug: "animal-and-plant-cells-similarities-and-differences",
    taxonomySource:
      "backend/config/edexcel_igcse_biology_topics.json (key: animal-and-plant-cells-similarities-and-differences)",
    synthesiserSpecKey: "edexcel-igcse-biology",
    synthesiserTopicKey: "cells/animal-and-plant-cells-similarities-and-differences",
    synthesiserSource:
      "Lesson Synthesiser pack edexcel-igcse-biology cells/animal-and-plant-cells-similarities-and-differences",
    subject: "Biology",
    level: "IGCSE",
    examBoard: "Edexcel",
    tierMode: TIER_MODE.UNTIERED,
    displayTopic: "Animal & Plant Cells: Similarities & Differences",
  }),
]);

function normalizeSpecKey(specKey) {
  return String(specKey || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

/**
 * Normalize teacher-side topic identity to namespaced key + canonical slug.
 */
function normalizeTeacherTopicIdentity(specKey, topicKeyRaw) {
  const raw = String(topicKeyRaw || "").trim();
  if (!raw) {
    return { namespacedTopicKey: "", canonicalSlug: "" };
  }
  const parsed = parseTopicKey(raw);
  const spec = normalizeSpecKey(specKey || parsed.specKey || "");
  if (parsed.isNamespaced && parsed.specKey && parsed.topicKey) {
    return {
      namespacedTopicKey: `${parsed.specKey}:${parsed.topicKey}`,
      canonicalSlug: parsed.topicKey,
    };
  }
  const slug = parsed.topicKey || raw;
  const namespaced = spec ? buildTopicKey(specKey || parsed.specKey, slug) : slug;
  return { namespacedTopicKey: namespaced, canonicalSlug: slug };
}

/**
 * @param {{
 *   specKey?: string,
 *   topicKey?: string,
 *   canonicalTopicKey?: string,
 * }} input
 * @returns {{
 *   ok: true,
 *   bridge: typeof P1_TOPIC_BRIDGES[number],
 *   synthesiserSpecKey: string,
 *   synthesiserTopicKey: string,
 *   teacherTopicKey: string,
 *   tierMode: string,
 * } | { ok: false, code: string, message: string, teacherTopicKey?: string }}
 */
function mapTeacherIdentityToSynthesiserIdentity(input) {
  const specKey = String(input?.specKey || "").trim();
  const topicKeyRaw =
    String(input?.topicKey || "").trim() ||
    String(input?.canonicalTopicKey || "").trim();

  if (!specKey || !topicKeyRaw) {
    return {
      ok: false,
      code: "SYNTHESISER_INPUT_INCOMPLETE",
      message: "specKey and topicKey are required for Lesson Synthesiser generation.",
    };
  }

  const teacher = normalizeTeacherTopicIdentity(specKey, topicKeyRaw);
  const specNorm = normalizeSpecKey(specKey);

  const bridge = P1_TOPIC_BRIDGES.find((entry) => {
    if (normalizeSpecKey(entry.teacherSpecKey) !== specNorm) return false;
    if (entry.teacherTopicKey === teacher.namespacedTopicKey) return true;
    if (entry.teacherCanonicalSlug === teacher.canonicalSlug) return true;
    return false;
  });

  if (!bridge) {
    return {
      ok: false,
      code: "SYNTHESISER_TOPIC_UNSUPPORTED",
      message:
        `Topic is not supported by Lesson Synthesiser P1 (${specKey} / ${teacher.namespacedTopicKey || teacher.canonicalSlug}). Use legacy AI generator or choose a supported topic.`,
      teacherTopicKey: teacher.namespacedTopicKey || topicKeyRaw,
    };
  }

  return {
    ok: true,
    bridge,
    synthesiserSpecKey: bridge.synthesiserSpecKey,
    synthesiserTopicKey: bridge.synthesiserTopicKey,
    teacherTopicKey: bridge.teacherTopicKey,
    tierMode: bridge.tierMode,
  };
}

/** Teacher-facing + Synthesiser identities for status endpoint and tests. */
function listP1SupportedTopicIdentities() {
  return P1_TOPIC_BRIDGES.map((b) => ({
    id: b.id,
    specKey: b.synthesiserSpecKey,
    topicKey: b.synthesiserTopicKey,
    teacherSpecKey: b.teacherSpecKey,
    teacherTopicKey: b.teacherTopicKey,
    teacherCanonicalSlug: b.teacherCanonicalSlug,
    tierMode: b.tierMode,
    displayTopic: b.displayTopic,
  }));
}

function findBridgeBySynthesiserIdentity(specKey, synthesiserTopicKey) {
  const spec = normalizeSpecKey(specKey);
  const topic = String(synthesiserTopicKey || "").trim();
  return P1_TOPIC_BRIDGES.find(
    (b) =>
      normalizeSpecKey(b.synthesiserSpecKey) === spec &&
      b.synthesiserTopicKey === topic
  );
}

module.exports = {
  TIER_MODE,
  P1_TOPIC_BRIDGES,
  normalizeTeacherTopicIdentity,
  mapTeacherIdentityToSynthesiserIdentity,
  listP1SupportedTopicIdentities,
  findBridgeBySynthesiserIdentity,
  normalizeSpecKey,
};
