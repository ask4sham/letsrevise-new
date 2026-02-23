/**
 * Canonical AQA GCSE Biology and Chemistry topic taxonomies.
 * Used by: teacher UI topic picker, factory prompts, diagram mapping, question bank tagging.
 */
const path = require("path");
const fs = require("fs");

let _biologyTaxonomy = null;
let _chemistryTaxonomy = null;

function loadBiologyTaxonomy() {
  if (_biologyTaxonomy) return _biologyTaxonomy;
  const filePath = path.join(__dirname, "..", "config", "aqa_gcse_biology_topics.json");
  const raw = fs.readFileSync(filePath, "utf8");
  _biologyTaxonomy = JSON.parse(raw);
  return _biologyTaxonomy;
}

function loadChemistryTaxonomy() {
  if (_chemistryTaxonomy) return _chemistryTaxonomy;
  const filePath = path.join(__dirname, "..", "config", "aqa_gcse_chemistry_topics.json");
  const raw = fs.readFileSync(filePath, "utf8");
  _chemistryTaxonomy = JSON.parse(raw);
  return _chemistryTaxonomy;
}

/** @deprecated use loadBiologyTaxonomy */
function loadTaxonomy() {
  return loadBiologyTaxonomy();
}

/**
 * Get full AQA GCSE Biology taxonomy (subject, examBoard, level, units with topics).
 * @returns {Object} { subject, examBoard, level, units: [{ unit, topics: [{ topic, key, tier, requiredPractical }] }] }
 */
function getBiologyTopics() {
  return loadBiologyTaxonomy();
}

/**
 * Get full AQA GCSE Chemistry taxonomy (subject, examBoard, level, units with topics).
 * @returns {Object} { subject, examBoard, level, units: [{ unit, topics: [{ topic, key, tier, requiredPractical }] }] }
 */
function getChemistryTopics() {
  return loadChemistryTaxonomy();
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
  getChemistryTopics,
  findTopicByKey,
  findChemistryTopicByKey,
  topicToKey,
  loadBiologyTaxonomy,
  loadChemistryTaxonomy,
};
