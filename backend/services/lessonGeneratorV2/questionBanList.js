/**
 * Hard-banned stems / fragments for V2 Question Brain.
 * These recreate the V1 generic-template / Option-filler failure mode.
 */

const BANNED_STEM_PATTERNS = [
  /which statement best explains a key idea about/i,
  /which statement best matches this topic/i,
  /a correct statement about this topic is/i,
  /\boption\s*1\b/i,
  /\boption\s*2\b/i,
  /\boption\s*3\b/i,
  /identify the role of .+ in .+/i,
  /which option correctly defines .+ for .+/i,
  /\balone completes\b/i,
  /might be tested in an exam/i,
  /cause\s*(→|->|to)\s*effect chain best explains/i,
  /key factor in this process is missing/i,
  /later step in this process/i,
  /which statement best (explains|matches)/i,
  /best explains a key idea about/i,
  /best matches this topic/i,
  /^a correct statement about/i,
  /^explain one key idea about/i,
  /which option is most accurate/i,
  /\(bank\s+\d+\)\s*$/i,
];

/**
 * Detect generic topic-name substitution: stem is mostly "topic + filler verb"
 * with almost no biology mechanism language.
 * @param {string} stem
 * @param {string} topic
 */
function looksLikeTopicNameSubstitution(stem, topic) {
  const raw = String(stem || "").trim();
  const t = String(topic || "").trim();
  if (!raw || !t || t.length < 4) return false;
  const lower = raw.toLowerCase();
  const topicLower = t.toLowerCase();
  if (!lower.includes(topicLower)) return false;
  // Stems that only wrap the topic label in a vague wrapper.
  const wrappers = [
    new RegExp(`^which statement best .+ ${escapeRegExp(topicLower)}`, "i"),
    new RegExp(`^a correct statement about ${escapeRegExp(topicLower)}`, "i"),
    new RegExp(`^explain one key idea about ${escapeRegExp(topicLower)}`, "i"),
    new RegExp(`^what is the main idea of ${escapeRegExp(topicLower)}\\??$`, "i"),
    new RegExp(`^which option correctly defines .+ for ${escapeRegExp(topicLower)}`, "i"),
  ];
  return wrappers.some((re) => re.test(raw));
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} stem
 * @param {{ topic?: string }} [ctx]
 * @returns {string[]} matching ban reasons
 */
function findBannedStemHits(stem, ctx = {}) {
  const raw = String(stem || "").trim();
  const hits = [];
  if (!raw) {
    hits.push("empty_stem");
    return hits;
  }
  for (const re of BANNED_STEM_PATTERNS) {
    if (re.test(raw)) hits.push(`banned:${re.source.slice(0, 48)}`);
  }
  if (looksLikeTopicNameSubstitution(raw, ctx.topic)) {
    hits.push("banned:topic_name_substitution");
  }
  return hits;
}

function isBannedStem(stem, ctx = {}) {
  return findBannedStemHits(stem, ctx).length > 0;
}

module.exports = {
  BANNED_STEM_PATTERNS,
  findBannedStemHits,
  isBannedStem,
  looksLikeTopicNameSubstitution,
};
