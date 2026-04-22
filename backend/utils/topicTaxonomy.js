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
let _mathsFoundationTaxonomy = null;
let _mathsHigherTaxonomy = null;
let _furtherMathsTaxonomy = null;
let _englishLiteratureTaxonomy = null;
let _englishLanguageTaxonomy = null;

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

function loadMathsFoundationTaxonomy() {
  if (_mathsFoundationTaxonomy) return _mathsFoundationTaxonomy;
  const filePath = path.join(__dirname, "..", "config", "aqa_gcse_maths_foundation_topics.json");
  const raw = fs.readFileSync(filePath, "utf8");
  _mathsFoundationTaxonomy = JSON.parse(raw);
  return _mathsFoundationTaxonomy;
}

function loadMathsHigherTaxonomy() {
  if (_mathsHigherTaxonomy) return _mathsHigherTaxonomy;
  const filePath = path.join(__dirname, "..", "config", "aqa_gcse_maths_higher_topics.json");
  const raw = fs.readFileSync(filePath, "utf8");
  _mathsHigherTaxonomy = JSON.parse(raw);
  return _mathsHigherTaxonomy;
}

function loadFurtherMathsTaxonomy() {
  if (_furtherMathsTaxonomy) return _furtherMathsTaxonomy;
  const filePath = path.join(__dirname, "..", "config", "aqa_l2_further_maths_topics.json");
  const raw = fs.readFileSync(filePath, "utf8");
  _furtherMathsTaxonomy = JSON.parse(raw);
  return _furtherMathsTaxonomy;
}

function loadEnglishLiteratureTaxonomy() {
  if (_englishLiteratureTaxonomy) return _englishLiteratureTaxonomy;
  const filePath = path.join(__dirname, "..", "config", "aqa_gcse_english_literature_topics.json");
  const raw = fs.readFileSync(filePath, "utf8");
  _englishLiteratureTaxonomy = JSON.parse(raw);
  return _englishLiteratureTaxonomy;
}

function loadEnglishLanguageTaxonomy() {
  if (_englishLanguageTaxonomy) return _englishLanguageTaxonomy;
  const filePath = path.join(__dirname, "..", "config", "aqa_gcse_english_language_topics.json");
  const raw = fs.readFileSync(filePath, "utf8");
  _englishLanguageTaxonomy = JSON.parse(raw);
  return _englishLanguageTaxonomy;
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
 * Get full AQA GCSE Maths (Foundation) taxonomy (subject, examBoard, level, units with topics).
 * @returns {Object} { subject, examBoard, level, specKey, tier, units: [{ unit, key?, topics }] }
 */
function getMathsFoundationTopics() {
  return loadMathsFoundationTaxonomy();
}

/**
 * Get full AQA GCSE Maths (Higher) taxonomy (subject, examBoard, level, units with topics).
 * @returns {Object} { subject, examBoard, level, specKey, tier, units }
 */
function getMathsHigherTopics() {
  return loadMathsHigherTaxonomy();
}

/**
 * Get full AQA Level 2 Further Maths taxonomy (subject, examBoard, level, units with topics).
 * @returns {Object} { subject, examBoard, level, specKey, tier, units }
 */
function getFurtherMathsTopics() {
  return loadFurtherMathsTaxonomy();
}

/**
 * Get full AQA GCSE English Literature taxonomy (subject, examBoard, level, units with topics).
 * @returns {Object} { subject, examBoard, level, specKey, tier, units }
 */
function getEnglishLiteratureTopics() {
  return loadEnglishLiteratureTaxonomy();
}

/**
 * Get full AQA GCSE English Language taxonomy (subject, examBoard, level, units with topics).
 * @returns {Object} { subject, examBoard, level, specKey, tier, units }
 */
function getEnglishLanguageTopics() {
  return loadEnglishLanguageTaxonomy();
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
 * Find a Physics topic by its canonical key (e.g. "energy-stores-and-transfers").
 * @param {string} key - Topic key (lowercase, hyphenated).
 * @returns {Object|null} Topic object with unit: { unit, topic, key, tier, requiredPractical } or null.
 */
function findPhysicsTopicByKey(key) {
  if (!key || typeof key !== "string") return null;
  const k = key.trim().toLowerCase();
  if (!k) return null;
  const taxonomy = loadPhysicsTaxonomy();
  if (!Array.isArray(taxonomy.units)) return null;
  for (const u of taxonomy.units) {
    const topics = Array.isArray(u.topics) ? u.topics : [];
    const found = topics.find((t) => t.key === k);
    if (found) return { unit: u.unit, ...found };
  }
  return null;
}

/**
 * Find a Maths (Foundation) topic by its canonical key (e.g. "fractions").
 * @param {string} key - Topic key (lowercase, hyphenated).
 * @returns {Object|null} Topic object with unit: { unit, topic, key, tier, requiredPractical } or null.
 */
function findMathsFoundationTopicByKey(key) {
  if (!key || typeof key !== "string") return null;
  const k = key.trim().toLowerCase();
  if (!k) return null;
  const taxonomy = loadMathsFoundationTaxonomy();
  if (!Array.isArray(taxonomy.units)) return null;
  for (const u of taxonomy.units) {
    const topics = Array.isArray(u.topics) ? u.topics : [];
    const found = topics.find((t) => t.key === k);
    if (found) return { unit: u.unit, ...found };
  }
  return null;
}

/**
 * Find a Maths (Higher) topic by its canonical key (e.g. "fractions", "higher-surds-exact-values").
 * @param {string} key - Topic key (lowercase, hyphenated).
 * @returns {Object|null} Topic object with unit: { unit, topic, key, tier, requiredPractical } or null.
 */
function findMathsHigherTopicByKey(key) {
  if (!key || typeof key !== "string") return null;
  const k = key.trim().toLowerCase();
  if (!k) return null;
  const taxonomy = loadMathsHigherTaxonomy();
  if (!Array.isArray(taxonomy.units)) return null;
  for (const u of taxonomy.units) {
    const topics = Array.isArray(u.topics) ? u.topics : [];
    const found = topics.find((t) => t.key === k);
    if (found) return { unit: u.unit, ...found };
  }
  return null;
}

/**
 * Find a Further Maths (L2) topic by its canonical key.
 * @param {string} key - Topic key (lowercase, hyphenated).
 * @returns {Object|null} Topic object with unit: { unit, topic, key, tier, requiredPractical } or null.
 */
function findFurtherMathsTopicByKey(key) {
  if (!key || typeof key !== "string") return null;
  const k = key.trim().toLowerCase();
  if (!k) return null;
  const taxonomy = loadFurtherMathsTaxonomy();
  if (!Array.isArray(taxonomy.units)) return null;
  for (const u of taxonomy.units) {
    const topics = Array.isArray(u.topics) ? u.topics : [];
    const found = topics.find((t) => t.key === k);
    if (found) return { unit: u.unit, ...found };
  }
  return null;
}

/**
 * Find an English Literature topic by its canonical key (e.g. "macbeth-overview", "novel-structuring-the-essay").
 * @param {string} key - Topic key (lowercase, hyphenated).
 * @returns {Object|null} Topic object with unit: { unit, topic, key, tier, requiredPractical } or null.
 */
function findEnglishLiteratureTopicByKey(key) {
  if (!key || typeof key !== "string") return null;
  const k = key.trim().toLowerCase();
  if (!k) return null;
  const taxonomy = loadEnglishLiteratureTaxonomy();
  if (!Array.isArray(taxonomy.units)) return null;
  for (const u of taxonomy.units) {
    const topics = Array.isArray(u.topics) ? u.topics : [];
    const found = topics.find((t) => t.key === k);
    if (found) return { unit: u.unit, ...found };
  }
  return null;
}

/**
 * Find an English Language topic by its canonical key (e.g. "paper-1-overview", "exams-2027-plus-check-updates").
 * @param {string} key - Topic key (lowercase, hyphenated).
 * @returns {Object|null} Topic object with unit: { unit, topic, key, tier, requiredPractical } or null.
 */
function findEnglishLanguageTopicByKey(key) {
  if (!key || typeof key !== "string") return null;
  const k = key.trim().toLowerCase();
  if (!k) return null;
  const taxonomy = loadEnglishLanguageTaxonomy();
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
 * @param {string} specKey - "aqa-gcse-biology" | "aqa-gcse-chemistry" | "aqa-gcse-physics" | "aqa-gcse-maths-foundation" | "aqa-gcse-maths-higher" | "aqa-l2-further-maths" | "aqa-gcse-english-literature"
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
  if (specKey === "aqa-gcse-maths-foundation") {
    return findMathsFoundationTopicByKey(k) !== null;
  }
  if (specKey === "aqa-gcse-maths-higher") {
    return findMathsHigherTopicByKey(k) !== null;
  }
  if (specKey === "aqa-l2-further-maths") {
    return findFurtherMathsTopicByKey(k) !== null;
  }
  if (specKey === "aqa-gcse-english-literature") {
    return findEnglishLiteratureTopicByKey(k) !== null;
  }
  if (specKey === "aqa-gcse-english-language") {
    return findEnglishLanguageTopicByKey(k) !== null;
  }
  return false;
}

/**
 * PR-CHEM-3: Find topic by spec and key (strip namespace from key first).
 * @param {string} specKey - "aqa-gcse-biology" | "aqa-gcse-chemistry" | "aqa-gcse-physics" | "aqa-gcse-maths-foundation" | "aqa-gcse-maths-higher" | "aqa-l2-further-maths" | "aqa-gcse-english-literature"
 * @param {string} topicKey - Possibly namespaced key
 * @returns {Object|null} Topic with unit for chemistry/physics/maths/english-literature/english-language; topic only for biology
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
  if (specKey === "aqa-gcse-maths-foundation") {
    return findMathsFoundationTopicByKey(k);
  }
  if (specKey === "aqa-gcse-maths-higher") {
    return findMathsHigherTopicByKey(k);
  }
  if (specKey === "aqa-l2-further-maths") {
    return findFurtherMathsTopicByKey(k);
  }
  if (specKey === "aqa-gcse-english-literature") {
    return findEnglishLiteratureTopicByKey(k);
  }
  if (specKey === "aqa-gcse-english-language") {
    return findEnglishLanguageTopicByKey(k);
  }
  return null;
}

/**
 * Normalize a free-text topic to a key (lowercase, hyphenated, no punctuation).
 * Note: For display names like "Animal and plant cells", this yields "animal-and-plant-cells"
 * which may NOT match the taxonomy key "animal-plant-cells". Use topicDisplayToCanonicalKey
 * when the input is a taxonomy display name.
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

/**
 * Resolve a taxonomy display name (e.g. "Animal and plant cells") to its canonical key
 * (e.g. "animal-plant-cells"). Use this when lesson.topic is from the topic picker.
 * Falls back to topicToKey if no exact match.
 * @param {string} displayName - Topic display name from taxonomy.
 * @param {string} [specKey] - Spec key e.g. "aqa-gcse-biology". Defaults to Biology.
 * @returns {string} Canonical topic key or empty string.
 */
function topicDisplayToCanonicalKey(displayName, specKey = "aqa-gcse-biology") {
  if (!displayName || typeof displayName !== "string") return "";
  const display = displayName.trim();
  if (!display) return "";
  const taxonomy = getTaxonomyBySpecKey(specKey);
  if (!taxonomy || !Array.isArray(taxonomy.units)) return "";
  const normalized = display.toLowerCase();
  for (const u of taxonomy.units) {
    const topics = Array.isArray(u.topics) ? u.topics : [];
    const found = topics.find((t) => t.topic && String(t.topic).toLowerCase() === normalized);
    if (found && found.key) return String(found.key).trim();
  }
  return "";
}

/**
 * Get sibling topic keys and keywords for the same unit (for drift validation).
 * Used to detect when generated content drifts into neighbouring sub-topics.
 * @param {string} topicKey - e.g. "cell-structure"
 * @param {string} specKey - e.g. "aqa-gcse-biology"
 * @returns {{ siblingKeys: string[], keywords: string[] }} Sibling topic keys and keyword signals for deny-list
 */
function getSiblingTopicKeysAndKeywords(topicKey, specKey) {
  if (!topicKey || !specKey) return { siblingKeys: [], keywords: [] };
  const k = topicKey.trim().toLowerCase();
  if (!k) return { siblingKeys: [], keywords: [] };

  const taxonomy = getTaxonomyBySpecKey(specKey);
  if (!taxonomy || !Array.isArray(taxonomy.units)) return { siblingKeys: [], keywords: [] };

  let unitContaining = null;
  const siblingKeys = [];
  const keywords = [];

  for (const u of taxonomy.units) {
    const topics = Array.isArray(u.topics) ? u.topics : [];
    const found = topics.find((t) => t.key === k);
    if (found) {
      unitContaining = u;
      break;
    }
  }

  if (!unitContaining) return { siblingKeys: [], keywords: [] };

  const topics = Array.isArray(unitContaining.topics) ? unitContaining.topics : [];
  for (const t of topics) {
    if (t.key === k) continue; // exclude selected topic
    siblingKeys.push(t.key);
    if (t.topic) {
      const words = String(t.topic).split(/\s+/).filter(Boolean);
      keywords.push(...words.map((w) => w.toLowerCase()));
    }
    if (t.key) {
      keywords.push(t.key.replace(/-/g, " "));
      keywords.push(t.key);
    }
  }

  const seen = new Set();
  const deduped = keywords.filter((kw) => {
    const n = kw.toLowerCase();
    if (seen.has(n)) return false;
    seen.add(n);
    return n.length >= 3;
  });

  return { siblingKeys, keywords: deduped };
}

/**
 * Taxonomy topic that only groups children (no leaf content / generation target).
 * Optional flag on topic objects in config JSON or merged admin taxonomy.
 * @param {Object|null|undefined} topic
 * @returns {boolean}
 */
function isTopicGroup(topic) {
  return !!(topic && topic.isGroup === true);
}

/**
 * Get taxonomy by spec key (for routes / generic dispatch).
 * @param {string} specKey
 * @returns {Object|null} Full taxonomy or null
 */
function getTaxonomyBySpecKey(specKey) {
  switch (specKey) {
    case "aqa-gcse-biology":
      return getBiologyTopics();
    case "aqa-gcse-chemistry":
      return getChemistryTopics();
    case "aqa-gcse-physics":
      return getPhysicsTopics();
    case "aqa-gcse-maths-foundation":
      return getMathsFoundationTopics();
    case "aqa-gcse-maths-higher":
      return getMathsHigherTopics();
    case "aqa-l2-further-maths":
      return getFurtherMathsTopics();
    case "aqa-gcse-english-literature":
      return getEnglishLiteratureTopics();
    case "aqa-gcse-english-language":
      return getEnglishLanguageTopics();
    default:
      return null;
  }
}

module.exports = {
  getBiologyTopics,
  getChemistryTopics,
  getPhysicsTopics,
  getMathsFoundationTopics,
  getMathsHigherTopics,
  getFurtherMathsTopics,
  getEnglishLiteratureTopics,
  getEnglishLanguageTopics,
  getTaxonomyBySpecKey,
  isTopicGroup,
  findTopicByKey,
  findChemistryTopicByKey,
  findPhysicsTopicByKey,
  findMathsFoundationTopicByKey,
  findMathsHigherTopicByKey,
  findFurtherMathsTopicByKey,
  findEnglishLiteratureTopicByKey,
  findEnglishLanguageTopicByKey,
  findTopicBySpecAndKey,
  isValidTopicForSpec,
  topicToKey,
  topicDisplayToCanonicalKey,
  getSiblingTopicKeysAndKeywords,
  loadBiologyTaxonomy,
  loadChemistryTaxonomy,
  loadPhysicsTaxonomy,
  loadMathsFoundationTaxonomy,
  loadMathsHigherTaxonomy,
  loadFurtherMathsTaxonomy,
  loadEnglishLiteratureTaxonomy,
  loadEnglishLanguageTaxonomy,
};
