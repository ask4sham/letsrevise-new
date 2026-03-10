/**
 * PR-CHEM-3: Namespace topicKey as specKey:topicKey to avoid Biology/Chemistry collisions.
 * Legacy topicKey (no ':') is treated as Biology by default when reading.
 */

const DEFAULT_SPEC_LEGACY = "aqa-gcse-biology";

/**
 * Build a namespaced topic key for storage/query.
 * @param {string} specKey - e.g. "aqa-gcse-biology", "aqa-gcse-chemistry"
 * @param {string} topicKey - Unprefixed key e.g. "rate-of-reaction"
 * @returns {string} e.g. "aqa-gcse-chemistry:rate-of-reaction"
 */
function buildTopicKey(specKey, topicKey) {
  if (!specKey || !topicKey) return (topicKey || "").trim();
  const s = String(specKey).trim();
  const t = String(topicKey).trim();
  if (!s || !t) return t || "";
  return `${s}:${t}`;
}

/**
 * Parse a full key into spec and topic. Handles legacy (no colon) keys.
 * @param {string} fullKey - Stored key, possibly "spec:topic" or legacy "topic"
 * @returns {{ specKey: string|null, topicKey: string, isNamespaced: boolean }}
 */
function parseTopicKey(fullKey) {
  if (!fullKey || typeof fullKey !== "string") {
    return { specKey: null, topicKey: "", isNamespaced: false };
  }
  const trimmed = fullKey.trim();
  const idx = trimmed.indexOf(":");
  if (idx === -1) {
    return { specKey: null, topicKey: trimmed, isNamespaced: false };
  }
  return {
    specKey: trimmed.slice(0, idx),
    topicKey: trimmed.slice(idx + 1),
    isNamespaced: true,
  };
}

/**
 * @param {string} fullKey
 * @returns {boolean}
 */
function isNamespacedTopicKey(fullKey) {
  if (!fullKey || typeof fullKey !== "string") return false;
  return fullKey.trim().indexOf(":") !== -1;
}

/**
 * Resolve a possibly-namespaced key to the canonical stored form.
 * If legacy (no colon), prefix with default spec for Biology.
 * @param {string} fullKey - From client: "spec:topic" or "topic"
 * @param {string} [defaultSpec] - Default when key is legacy (default: aqa-gcse-biology)
 * @returns {string} Namespaced key for storage/query
 */
function normalizeToStoredKey(fullKey, defaultSpec = DEFAULT_SPEC_LEGACY) {
  const { specKey, topicKey, isNamespaced } = parseTopicKey(fullKey);
  if (!topicKey) return "";
  if (isNamespaced && specKey) return `${specKey}:${topicKey}`;
  return buildTopicKey(defaultSpec, topicKey);
}

/**
 * Return candidate keys for a query: [namespaced, legacy] so $in finds both.
 * Optionally include unit__topic legacy format when unitKey provided.
 * @param {string} specKey - e.g. "aqa-gcse-chemistry"
 * @param {string} topicKeyOnly - Unprefixed key e.g. "rate-of-reaction"
 * @param {string} [unitKey] - Optional unit slug e.g. "cell-biology" for legacy "unit__topic" format
 * @returns {string[]} e.g. ["aqa-gcse-chemistry:rate-of-reaction", "rate-of-reaction", "cell-biology:rate-of-reaction"]
 */
function queryCandidates(specKey, topicKeyOnly, unitKey) {
  if (!topicKeyOnly) return [].filter(Boolean);
  const t = String(topicKeyOnly).trim();
  if (!t) return [];
  const base = specKey ? [buildTopicKey(specKey, t), t] : [t];
  if (unitKey && String(unitKey).trim()) {
    const u = String(unitKey).trim().toLowerCase().replace(/\s+/g, "-");
    base.push(`${u}__${t}`);
  }
  return [...new Set(base)];
}

module.exports = {
  buildTopicKey,
  parseTopicKey,
  isNamespacedTopicKey,
  normalizeToStoredKey,
  queryCandidates,
  DEFAULT_SPEC_LEGACY,
};
