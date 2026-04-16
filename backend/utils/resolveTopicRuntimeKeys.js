/**
 * Pattern B: resolve question-bank and analytics topic keys from a lesson's validated namespaced topic.
 * Exact-match bank queries use inheritQuestionBankFrom / mapsToCanonicalKey when set on admin sub-topics.
 */
const { parseTopicKey, buildTopicKey, DEFAULT_SPEC_LEGACY } = require("./topicKey");
const { getRuntimeMappingForSpecSlug } = require("./specTopicRegistry");

/**
 * @param {string} specKey
 * @param {string} namespacedTopicKey - e.g. aqa-gcse-biology:stomach
 * @returns {string} namespaced key to use for TopicQuizQuestion / TopicFlashcard exact topicKey match
 */
function resolveQuestionBankNamespacedTopicKey(specKey, namespacedTopicKey) {
  const s = String(specKey || "").trim();
  const trimmed = String(namespacedTopicKey || "").trim();
  if (!s || !trimmed) return trimmed;
  const slug = parseTopicKey(trimmed).topicKey || trimmed.split(":").pop() || "";
  const m = getRuntimeMappingForSpecSlug(s, slug);
  if (m?.inheritQuestionBankFrom) return String(m.inheritQuestionBankFrom).trim();
  if (m?.mapsToCanonicalKey) return String(m.mapsToCanonicalKey).trim();
  return trimmed;
}

/**
 * @param {string} specKey
 * @param {string} namespacedTopicKey
 * @returns {string} namespaced key for mastery / analytics rollup
 */
function resolveAnalyticsNamespacedTopicKey(specKey, namespacedTopicKey) {
  const s = String(specKey || "").trim();
  const trimmed = String(namespacedTopicKey || "").trim();
  if (!s || !trimmed) return trimmed;
  const slug = parseTopicKey(trimmed).topicKey || trimmed.split(":").pop() || "";
  const m = getRuntimeMappingForSpecSlug(s, slug);
  if (m?.inheritAnalyticsFrom) return String(m.inheritAnalyticsFrom).trim();
  if (m?.mapsToCanonicalKey) return String(m.mapsToCanonicalKey).trim();
  return trimmed;
}

/**
 * @param {string} specKey
 * @param {string} namespacedTopicKey
 * @returns {{ resolvedTopicKey: string, questionBankTopicKey: string, analyticsTopicKey: string }}
 */
function resolveTopicRuntimeKeys(specKey, namespacedTopicKey) {
  const resolvedTopicKey = String(namespacedTopicKey || "").trim();
  const qb = resolveQuestionBankNamespacedTopicKey(specKey, namespacedTopicKey);
  const an = resolveAnalyticsNamespacedTopicKey(specKey, namespacedTopicKey);
  return {
    resolvedTopicKey,
    questionBankTopicKey: qb || resolvedTopicKey,
    analyticsTopicKey: an || resolvedTopicKey,
  };
}

/**
 * Build namespaced key from spec + slug (helper for callers that only have slug).
 */
function namespacedFromSpecAndSlug(specKey, slug) {
  const s = String(specKey || "").trim();
  const t = String(slug || "").trim();
  if (!s || !t) return t;
  if (t.includes(":")) return t;
  return buildTopicKey(s, t);
}

/**
 * Single place for mastery read/write topicKey — matches analytics inheritance (mapsToCanonicalKey / inheritAnalyticsFrom).
 * @param {string} topicKey
 * @returns {string}
 */
function rollupTopicKeyForMastery(topicKey) {
  const tk = String(topicKey || "").trim();
  if (!tk) return tk;
  const parsed = parseTopicKey(tk);
  const spec = parsed.specKey || DEFAULT_SPEC_LEGACY;
  const namespaced = parsed.isNamespaced ? tk : buildTopicKey(spec, parsed.topicKey || tk);
  return resolveAnalyticsNamespacedTopicKey(spec, namespaced);
}

module.exports = {
  resolveQuestionBankNamespacedTopicKey,
  resolveAnalyticsNamespacedTopicKey,
  resolveTopicRuntimeKeys,
  namespacedFromSpecAndSlug,
  rollupTopicKeyForMastery,
};
