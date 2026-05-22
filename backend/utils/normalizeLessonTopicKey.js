/**
 * Map imported / free-text topic labels to valid taxonomy slugs (e.g. photosynthesis).
 * Never persist title-derived slugs like "photosynthetic-reaction-aqa-gcse-biology-higher-tier".
 */
const { parseTopicKey, buildTopicKey } = require("./topicKey");
const { isValidTopicSlugForSpec } = require("./specTopicRegistry");
const { topicDisplayToCanonicalKey } = require("./topicTaxonomy");

const PHOTOSYNTHESIS_RE = /\bphotosynth(?:esis|etic)\b/i;
const RESPIRATION_RE = /\b(?:aerobic|anaerobic)?\s*respiration\b/i;

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function normalizeTopicString(raw = "") {
  return safeStr(raw)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} normalized - output of normalizeTopicString
 * @returns {string | null}
 */
function canonicalSlugFromNormalized(normalized) {
  const t = normalizeTopicString(normalized);
  if (!t) return null;
  if (PHOTOSYNTHESIS_RE.test(t)) return "photosynthesis";
  if (/\bbioenergetics\b/.test(t) && /\bphoto/.test(t)) return "photosynthesis";
  if (t.includes("photosynthesis")) return "photosynthesis";
  if (RESPIRATION_RE.test(t)) return "respiration";
  if (/\baerobic\b/.test(t) && /\banaerobic\b/.test(t)) return "respiration";
  if (t.includes("respiration")) return "respiration";
  return null;
}

function canonicalSlugFromText(raw) {
  return canonicalSlugFromNormalized(normalizeTopicString(raw));
}

function extractTopicSlug(topicKeyRaw) {
  const raw = safeStr(topicKeyRaw);
  if (!raw) return "";
  if (raw.includes(":")) {
    const parsed = parseTopicKey(raw);
    return safeStr(parsed.topicKey) || raw.slice(raw.indexOf(":") + 1);
  }
  return raw;
}

/**
 * Heuristic: slug looks like a slugified lesson title, not a syllabus sub-topic key.
 * @param {string} slug
 */
function isLikelyInvalidTopicSlug(slug) {
  const s = safeStr(slug).toLowerCase();
  if (!s) return true;
  if (s.length > 48) return true;
  if (/\b(aqa|gcse|ocr|edexcel|wjec)\b/.test(s) && s.split("-").length >= 4) return true;
  if (/\b(foundation|higher)(-tier)?\b/.test(s)) return true;
  return false;
}

/**
 * @param {string} specKey
 * @param {{ topicKey?: string, canonicalTopicKey?: string, title?: string, topic?: string, subTopic?: string }} fields
 * @returns {{ slug: string | null, namespaced: string | null, repaired: boolean }}
 */
function normalizeLessonTopicSlug(specKey, fields = {}) {
  const spec = safeStr(specKey);
  if (!spec) return { slug: null, namespaced: null, repaired: false };

  const canonicalHint = safeStr(fields.canonicalTopicKey);
  const rawSlug = extractTopicSlug(fields.topicKey);
  const title = safeStr(fields.title);
  const topic = safeStr(fields.topic) || safeStr(fields.subTopic);

  const trySlug = (candidate) => {
    const s = safeStr(candidate);
    if (!s || !isValidTopicSlugForSpec(spec, s)) return null;
    return s;
  };

  let slug =
    trySlug(canonicalHint) ||
    (rawSlug && !isLikelyInvalidTopicSlug(rawSlug) ? trySlug(rawSlug) : null);

  let repaired = false;

  if (!slug && rawSlug && isLikelyInvalidTopicSlug(rawSlug)) {
    repaired = true;
  }

  if (!slug) {
    const fromAlias =
      canonicalSlugFromText(rawSlug) ||
      canonicalSlugFromText(topic) ||
      canonicalSlugFromText(title);
    slug = trySlug(fromAlias);
    if (slug) repaired = true;
  }

  if (!slug) {
    const fromDisplay =
      trySlug(topicDisplayToCanonicalKey(topic, spec)) ||
      trySlug(topicDisplayToCanonicalKey(title, spec));
    if (fromDisplay) {
      slug = fromDisplay;
      repaired = true;
    }
  }

  if (!slug && rawSlug && !isLikelyInvalidTopicSlug(rawSlug)) {
    slug = trySlug(rawSlug);
  }

  if (!slug) return { slug: null, namespaced: null, repaired };

  return {
    slug,
    namespaced: buildTopicKey(spec, slug),
    repaired: repaired || (rawSlug && rawSlug !== slug),
  };
}

/**
 * Normalize before assertValidNamespacedTopicKey on lesson create/update.
 * @returns {string | null} namespaced topicKey or null if cannot resolve
 */
function normalizeNamespacedLessonTopicKey(specKey, fields = {}) {
  const { namespaced } = normalizeLessonTopicSlug(specKey, fields);
  return namespaced;
}

module.exports = {
  normalizeTopicString,
  canonicalSlugFromText,
  isLikelyInvalidTopicSlug,
  normalizeLessonTopicSlug,
  normalizeNamespacedLessonTopicKey,
  extractTopicSlug,
};
