/**
 * Canonical AQA GCSE Biology and Chemistry topic taxonomies.
 * Used by: teacher UI topic picker, factory prompts, diagram mapping, question bank tagging.
 */
const path = require("path");
const fs = require("fs");
const { parseTopicKey } = require("./topicKey");

let _biologyTaxonomy = null;
let _chemistryTaxonomy = null;
let _physicsTaxonomy = null;

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

function loadPhysicsTaxonomy() {
  if (_physicsTaxonomy) return _physicsTaxonomy;
  const filePath = path.join(__dirname, "..", "config", "aqa_gcse_physics_topics.json");
  const raw = fs.readFileSync(filePath, "utf8");
  _physicsTaxonomy = JSON.parse(raw);
  return _physicsTaxonomy;
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
 * Get full AQA GCSE Physics taxonomy (subject, examBoard, level, units with topics).
 * @returns {Object} { subject, examBoard, level, units: [{ unit, topics: [{ topic, key, tier, requiredPractical }] }] }
 */
function getPhysicsTopics() {
  return loadPhysicsTaxonomy();
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
 * Find a Chemistry topic by its canonical key (e.g. "simple-model-of-the-atom").
 * @param {string} key - Topic key (lowercase, hyphenated).
 * @returns {Object|null} Topic object with unit: { unit, topic, key, tier, requiredPractical } or null.
 */
function findChemistryTopicByKey(key) {
  if (!key || typeof key !== "string") return null;
  const k = key.trim().toLowerCase();
  if (!k) return null;
  const taxonomy = loadChemistryTaxonomy();
  if (!Array.isArray(taxonomy.units)) return null;
  for (const u of taxonomy.units) {
    const topics = Array.isArray(u.topics) ? u.topics : [];
    const found = topics.find((t) => t.key === k);
    if (found) return { unit: u.unit, ...found };
  }
  return null;
}

/**
 * PR-CHEM-3: Check if topicKey exists in the given spec taxonomy.
 * Strips namespace from topicKey before lookup.
 * @param {string} specKey - "aqa-gcse-biology" | "aqa-gcse-chemistry" | "aqa-gcse-physics"
 * @param {string} topicKey - Possibly namespaced key; only the suffix is used for lookup.
 * @returns {boolean}
 */
function isValidTopicForSpec(specKey, topicKey) {
  if (!specKey || !topicKey) return false;
  const { topicKey: raw } = parseTopicKey(topicKey);
  const k = raw.trim().toLowerCase();
  if (!k) return false;
  if (specKey === "aqa-gcse-biology") {
    return findTopicByKey(k) !== null;
  }
  if (specKey === "aqa-gcse-chemistry") {
    return findChemistryTopicByKey(k) !== null;
  }
  if (specKey === "aqa-gcse-physics") {
    return findPhysicsTopicByKey(k) !== null;
  }
  return false;
}

/**
 * PR-CHEM-3: Find topic by spec and key (strip namespace from key first).
 * @param {string} specKey - "aqa-gcse-biology" | "aqa-gcse-chemistry" | "aqa-gcse-physics"
 * @param {string} topicKey - Possibly namespaced key
 * @returns {Object|null} Topic with unit for chemistry/physics; topic only for biology
 */
function findTopicBySpecAndKey(specKey, topicKey) {
  if (!specKey || !topicKey) return null;
  const { topicKey: raw } = parseTopicKey(topicKey);
  const k = raw.trim().toLowerCase();
  if (!k) return null;
  if (specKey === "aqa-gcse-biology") {
    return findTopicByKey(k);
  }
  if (specKey === "aqa-gcse-chemistry") {
    return findChemistryTopicByKey(k);
  }
  if (specKey === "aqa-gcse-physics") {
    return findPhysicsTopicByKey(k);
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
  getPhysicsTopics,
  findTopicByKey,
  findChemistryTopicByKey,
  findPhysicsTopicByKey,
  findTopicBySpecAndKey,
  isValidTopicForSpec,
  topicToKey,
  loadBiologyTaxonomy,
  loadChemistryTaxonomy,
  loadPhysicsTaxonomy,
};
