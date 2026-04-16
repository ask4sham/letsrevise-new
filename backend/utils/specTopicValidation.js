const { getTaxonomyBySpecKey } = require("./topicTaxonomy");
const { isValidTopicSlugForSpec } = require("./specTopicRegistry");

/**
 * Ensures specKey exists in taxonomy. Use before processing items to fail fast (e.g. 400).
 */
function assertValidSpecKey(specKey) {
  const taxonomy = getTaxonomyBySpecKey(specKey);
  if (!taxonomy) {
    const err = new Error(`Unknown specKey: ${specKey}`);
    err.code = "INVALID_SPEC_KEY";
    throw err;
  }
  return true;
}

/**
 * Ensures the provided (specKey, topicKey) exists in taxonomy (static JSON OR active admin sub-topic).
 * IMPORTANT: topicKey here must be the NON-namespaced slug (taxonomy key).
 */
function assertValidSpecTopic({ specKey, topicKey }) {
  assertValidSpecKey(specKey);
  const slug = String(topicKey || "").trim();
  if (!slug) {
    const err = new Error(`Unknown topicKey for specKey "${specKey}": ${topicKey}`);
    err.code = "INVALID_TOPIC_KEY";
    throw err;
  }
  if (!isValidTopicSlugForSpec(specKey, slug)) {
    const err = new Error(`Unknown topicKey for specKey "${specKey}": ${topicKey}`);
    err.code = "INVALID_TOPIC_KEY";
    throw err;
  }
  return true;
}

/**
 * Validates that namespacedTopicKey is of form "specKey:topicSlug" and topicSlug exists in taxonomy.
 * Use for student/submit flows where topicKey is sent namespaced.
 */
function assertValidNamespacedTopicKey(specKey, namespacedTopicKey) {
  assertValidSpecKey(specKey);
  if (!namespacedTopicKey || typeof namespacedTopicKey !== "string") {
    const err = new Error("topicKey is required and must be namespaced (specKey:topicSlug)");
    err.code = "INVALID_TOPIC_KEY";
    throw err;
  }
  const trimmed = namespacedTopicKey.trim();
  const prefix = `${String(specKey).trim()}:`;
  if (!trimmed.startsWith(prefix)) {
    const err = new Error(`topicKey must start with ${prefix}`);
    err.code = "INVALID_TOPIC_KEY";
    throw err;
  }
  const topicSlug = trimmed.slice(prefix.length);
  if (!topicSlug) {
    const err = new Error("topicKey must have a topic slug after the colon");
    err.code = "INVALID_TOPIC_KEY";
    throw err;
  }
  assertValidSpecTopic({ specKey, topicKey: topicSlug });
  return true;
}

module.exports = { assertValidSpecKey, assertValidSpecTopic, assertValidNamespacedTopicKey };
