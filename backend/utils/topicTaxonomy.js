/**
 * Canonical AQA GCSE Biology topic taxonomy.
 * Used by: teacher UI topic picker, Biology factory prompts, diagram mapping, question bank tagging.
 */
const path = require("path");
const fs = require("fs");

let _taxonomy = null;

function loadTaxonomy() {
  if (_taxonomy) return _taxonomy;
  const filePath = path.join(__dirname, "..", "config", "aqa_gcse_biology_topics.json");
  const raw = fs.readFileSync(filePath, "utf8");
  _taxonomy = JSON.parse(raw);
  return _taxonomy;
}

/**
 * Get full AQA GCSE Biology taxonomy (subject, examBoard, level, units with topics).
 * @returns {Object} { subject, examBoard, level, units: [{ unit, topics: [{ topic, key, tier, requiredPractical }] }] }
 */
function getBiologyTopics() {
  return loadTaxonomy();
}

/**
 * Find a topic by its canonical key (e.g. "cell-structure", "rp-microscopy").
 * @param {string} key - Topic key (lowercase, hyphenated).
 * @returns {Object|null} Topic object { topic, key, tier, requiredPractical } or null.
 */
function findTopicByKey(key) {
  if (!key || typeof key !== "string") return null;
  const k = key.trim().toLowerCase();
  if (!k) return null;
  const taxonomy = loadTaxonomy();
  if (!Array.isArray(taxonomy.units)) return null;
  for (const u of taxonomy.units) {
    const topics = Array.isArray(u.topics) ? u.topics : [];
    const found = topics.find((t) => t.key === k);
    if (found) return found;
  }
  return null;
}

/**
 * Normalize a free-text topic to a key (lowercase, hyphenated, no punctuation).
 * @param {string} topic - Display name or free text.
 * @returns {string} Normalized key.
 */
function topicToKey(topic) {
  if (!topic || typeof topic !== "string") return "";
  return topic
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

module.exports = {
  getBiologyTopics,
  findTopicByKey,
  topicToKey,
};
