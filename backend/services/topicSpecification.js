/**
 * Topic specification records — SSOT for generation, assessment journey, and validation.
 * Loads rich per-topic records from backend/config/spec_points/{specKey}.json
 */
const path = require("path");
const fs = require("fs");
const { getSpecPointsForTopic } = require("./syllabusAlignment");

const SPEC_POINTS_DIR = path.join(__dirname, "..", "config", "spec_points");

let _cache = {};

function clearTopicSpecCache() {
  _cache = {};
}

function loadSpecFile(specKey) {
  if (_cache[specKey]) return _cache[specKey];
  const bases = [specKey, specKey.replace(/-/g, "_")];
  for (const base of bases) {
    const filePath = path.join(SPEC_POINTS_DIR, `${base}.json`);
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      _cache[specKey] = JSON.parse(raw);
      return _cache[specKey];
    } catch {
      continue;
    }
  }
  _cache[specKey] = null;
  return null;
}

function normalizeTopicSlug(topicKey) {
  if (!topicKey) return "";
  const t = String(topicKey).trim();
  if (t.includes(":")) return t.split(":").pop().trim();
  return t;
}

function asStringArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter(Boolean);
  return [];
}

function enrichFromBasicPoints(record, specKey, topicSlug) {
  const points = getSpecPointsForTopic(specKey, topicSlug);
  if (!points.length) return record;
  const out = { ...record };
  if (!out.learningOutcomes?.length) out.learningOutcomes = [...points];
  if (!out.requiredVocabulary?.length) {
    out.requiredVocabulary = points
      .flatMap((p) => (p.match(/\b[A-Z][a-z]+(?:\s+[a-z]+){0,2}\b/g) || []))
      .slice(0, 8);
  }
  return out;
}

/**
 * @returns {object|null} Rich topic record or null
 */
function getTopicSpecRecord(specKey, topicKeyOrSlug) {
  if (!specKey || !topicKeyOrSlug) return null;
  const topicSlug = normalizeTopicSlug(topicKeyOrSlug);
  const file = loadSpecFile(specKey);
  if (!file) return null;

  const topics = file.topics || {};
  const raw =
    topics[topicSlug] ||
    topics[topicSlug.replace(/-/g, "_")] ||
    null;

  if (!raw) return null;

  const record = {
    specKey,
    topicKey: topicSlug,
    topicTitle: raw.topicTitle || raw.title || topicSlug.replace(/-/g, " "),
    specReference: asStringArray(raw.specReference),
    learningOutcomes: asStringArray(raw.learningOutcomes),
    requiredVocabulary: asStringArray(raw.requiredVocabulary || raw.requiredKeywords),
    requiredStructures: asStringArray(raw.requiredStructures),
    requiredProcesses: asStringArray(raw.requiredProcesses),
    requiredComparisons: asStringArray(raw.requiredComparisons),
    requiredGraphs: asStringArray(raw.requiredGraphs),
    requiredCalculations: asStringArray(raw.requiredCalculations),
    commonMisconceptions: asStringArray(
      raw.commonMisconceptions || raw.requiredMisconceptions
    ),
    examFocus: asStringArray(raw.examFocus),
    commandWords: asStringArray(raw.commandWords),
    likelyExamQuestions: asStringArray(raw.likelyExamQuestions),
    structureRoles: raw.structureRoles && typeof raw.structureRoles === "object" ? raw.structureRoles : {},
    assessmentJourney: raw.assessmentJourney || null,
  };

  return enrichFromBasicPoints(record, specKey, topicSlug);
}

/**
 * Resolved shape for generation hooks (aliases for legacy field names).
 */
function resolveTopicSpecForGeneration(specKey, topicKeyOrSlug, opts = {}) {
  const topicSlug = normalizeTopicSlug(topicKeyOrSlug);
  let record = getTopicSpecRecord(specKey, topicSlug);

  if (!record) {
    const points = getSpecPointsForTopic(specKey, topicSlug);
    const title = topicSlug.replace(/-/g, " ");
    record = {
      specKey,
      topicKey: topicSlug,
      topicTitle: title,
      specReference: [],
      learningOutcomes: points,
      requiredVocabulary: [],
      requiredStructures: [],
      requiredProcesses: [],
      requiredComparisons: [],
      requiredGraphs: [],
      requiredCalculations: [],
      commonMisconceptions: [],
      examFocus: [],
      commandWords: ["describe", "explain", "compare"],
      likelyExamQuestions: points.length
        ? [`Explain ${title} (3 marks)`, `Describe ${title} (2 marks)`]
        : [],
      structureRoles: {},
      assessmentJourney: null,
      thinCoverage: points.length === 0,
    };
  } else {
    record = { ...record, thinCoverage: false };
  }

  if (opts.examCode && !record.examCode) record.examCode = opts.examCode;

  return {
    ...record,
    requiredKeywords: record.requiredVocabulary,
    requiredMisconceptions: record.commonMisconceptions,
  };
}

function hasRichSpecForAssessment(record) {
  if (!record) return false;
  if (record.assessmentJourney) return true;
  return (
    (record.learningOutcomes || []).length > 0 ||
    (record.requiredVocabulary || []).length > 0 ||
    (record.requiredStructures || []).length > 0 ||
    (record.requiredProcesses || []).length > 0 ||
    (record.commonMisconceptions || []).length > 0 ||
    (record.likelyExamQuestions || []).length > 0
  );
}

module.exports = {
  getTopicSpecRecord,
  resolveTopicSpecForGeneration,
  clearTopicSpecCache,
  hasRichSpecForAssessment,
  normalizeTopicSlug,
};
