/**
 * Algorithm 1: Syllabus-aligned generation support.
 * - Load specification points per topic (exam board / subject / topicKey)
 * - Fetch past paper question snippets for prompt context
 * - Resolve (board, subject, topic) to specKey and topicKey
 */
const path = require("path");
const fs = require("fs");
const { getBiologyTopics } = require("../utils/topicTaxonomy");
const { buildTopicKey, queryCandidates } = require("../utils/topicKey");

const SPEC_POINTS_DIR = path.join(__dirname, "..", "config", "spec_points");
const COVERAGE_THRESHOLD = 0.9;

/** Map exam board + subject to specKey (lowercase, hyphenated). */
function boardSubjectToSpecKey(board, subject) {
  const b = (board || "").toString().trim().toLowerCase();
  const s = (subject || "").toString().trim().toLowerCase();
  if (!b || !s) return null;
  if (b === "aqa" && s === "biology") return "aqa-gcse-biology";
  if (b === "aqa" && s === "chemistry") return "aqa-gcse-chemistry";
  if (b === "aqa" && s === "physics") return "aqa-gcse-physics";
  return `${b}-gcse-${s}`.replace(/\s+/g, "-");
}

/** Resolve topic string (display or key) to topicKey using taxonomy. */
function resolveTopicKey(specKey, topicStr) {
  if (!topicStr || typeof topicStr !== "string") return null;
  const t = topicStr.trim();
  if (!t) return null;
  const keyLike = t.toLowerCase().replace(/\s+/g, "-");
  if (keyLike.includes("-") && !keyLike.includes(" ")) return keyLike;

  const taxonomy = getBiologyTopics();
  if (!taxonomy || !Array.isArray(taxonomy.units)) return keyLike;
  for (const unit of taxonomy.units) {
    const topics = unit.topics || [];
    for (const top of topics) {
      if ((top.key && top.key === keyLike) || (top.topic && top.topic.toLowerCase() === t.toLowerCase()))
        return top.key || keyLike;
    }
  }
  return keyLike;
}

let _specPointsCache = {};

/**
 * Get specification points for a topic. Returns array of strings or empty array.
 * @param {string} specKey - e.g. "aqa-gcse-biology"
 * @param {string} topicKey - e.g. "cell-structure"
 */
function getSpecPointsForTopic(specKey, topicKey) {
  if (!specKey || !topicKey) return [];
  const cacheKey = `${specKey}:${topicKey}`;
  if (_specPointsCache[cacheKey] !== undefined) return _specPointsCache[cacheKey];

  const baseNames = [specKey, specKey.replace(/-/g, "_")];
  let data;
  for (const base of baseNames) {
    const filePath = path.join(SPEC_POINTS_DIR, `${base}.json`);
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      data = JSON.parse(raw);
      break;
    } catch {
      continue;
    }
  }
  if (!data) {
    _specPointsCache[cacheKey] = [];
    return [];
  }

  const topics = data.topics || {};
  const points = topics[topicKey] || topics[topicKey.replace(/-/g, "_")] || [];
  const out = Array.isArray(points) ? points.map((p) => String(p).trim()).filter(Boolean) : [];
  _specPointsCache[cacheKey] = out;
  return out;
}

/**
 * Get past paper question snippets for a topic (for prompt context).
 * @param {string} specKey - e.g. "aqa-gcse-biology"
 * @param {string} topicKey - e.g. "cell-structure"
 * @param {number} limit - max number of questions (default 5)
 * @param {object} [PastPaperQuestion] - model (injected to avoid circular require)
 */
async function getPastPaperSnippetsForTopic(specKey, topicKey, limit = 5, PastPaperQuestion) {
  if (!specKey || !topicKey || !PastPaperQuestion) return [];
  const candidates = queryCandidates(specKey, topicKey);
  const docs = await PastPaperQuestion.find({
    specKey,
    topicKey: { $in: candidates },
    isArchived: { $ne: true },
  })
    .select("question markScheme")
    .limit(limit * 2)
    .lean();

  return docs.slice(0, limit).map((d) => ({
    question: (d.question || "").slice(0, 500),
    markScheme: Array.isArray(d.markScheme) ? d.markScheme.slice(0, 5) : [],
  }));
}

/**
 * Resolve (board, subject, topic) to { specKey, topicKey } for syllabus alignment.
 * Returns null if spec not supported or topic not resolved.
 */
function resolveSpecAndTopicKey(board, subject, topic) {
  const specKey = boardSubjectToSpecKey(board, subject);
  if (!specKey) return null;
  const topicKey = resolveTopicKey(specKey, topic);
  if (!topicKey) return null;
  return { specKey, topicKey };
}

module.exports = {
  getSpecPointsForTopic,
  getPastPaperSnippetsForTopic,
  resolveSpecAndTopicKey,
  boardSubjectToSpecKey,
  COVERAGE_THRESHOLD,
};
