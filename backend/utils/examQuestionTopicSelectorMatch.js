const { queryCandidates, parseTopicKey, DEFAULT_SPEC_LEGACY } = require("./topicKey");
const { findTopicBySpecAndKey } = require("./topicTaxonomy");

/**
 * Normalise topic display text for tolerant comparison.
 * Lowercase, "&" → "and", non-alphanumerics collapsed to single spaces.
 * "Human Male & Female Reproductive Systems" → "human male and female reproductive systems".
 */
function normaliseTopicText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/**
 * Build an anchored, case-insensitive regex that matches a topic display title
 * tolerant of "&"/"and" and punctuation/whitespace differences, but not partial
 * matches (so "…Systems and Hormones" will NOT match "…Systems").
 */
function buildTopicTitleRegex(title) {
  const norm = normaliseTopicText(title);
  if (!norm) return null;
  const tokens = norm
    .split(" ")
    .filter(Boolean)
    .map((w) => (w === "and" ? "(?:and|&)" : w.replace(REGEX_SPECIALS, "\\$&")));
  if (!tokens.length) return null;
  return new RegExp(`^[^a-z0-9]*${tokens.join("[^a-z0-9]+")}[^a-z0-9]*$`, "i");
}

/**
 * Resolve selector matching for a lesson topicKey.
 * Returns canonical topicKey candidates plus (when the topic resolves in the
 * taxonomy) title regexes + normalised titles used as a safe fallback for
 * legacy questions that have correct topic text but a missing/mismatched topicKey.
 *
 * @param {{ specKey?: string, topicKey?: string }} input
 * @returns {{ candidates: string[], titleRegexes: RegExp[], normalisedTitles: string[] }}
 */
function resolveSelectorTopicMatch(input = {}) {
  const spec = (input.specKey && String(input.specKey).trim()) || DEFAULT_SPEC_LEGACY;
  const parsed = parseTopicKey(String(input.topicKey || "").trim());
  const slug = parsed.topicKey || String(input.topicKey || "").trim();
  const candidates = queryCandidates(spec, slug);

  const titles = new Set();
  const leaf = slug ? findTopicBySpecAndKey(spec, slug) : null;
  if (leaf) {
    if (leaf.topic) titles.add(String(leaf.topic));
    if (leaf.topicTitle) titles.add(String(leaf.topicTitle));
  }
  const titleRegexes = [...titles].map(buildTopicTitleRegex).filter(Boolean);
  const normalisedTitles = [...titles].map(normaliseTopicText).filter(Boolean);
  return { candidates, titleRegexes, normalisedTitles };
}

/**
 * Build the Mongo filter clause for `GET /api/exam-questions?topicKey=…`.
 * - Always matches canonical topicKey candidates.
 * - Additionally matches questions with a missing/mismatched topicKey whose
 *   topic text equals the selected topic's canonical title (safe fallback).
 * Returns a clause to merge into the query, or a plain topicKey value.
 *
 * @returns {{ clause: object }} object to spread/assign into the query
 */
function buildTopicSelectorQueryClause(input = {}) {
  const { candidates, titleRegexes } = resolveSelectorTopicMatch(input);
  if (!candidates.length) {
    const fallbackSlug = String(input.topicKey || "").trim().toLowerCase();
    return { clause: fallbackSlug ? { topicKey: fallbackSlug } : {} };
  }
  if (!titleRegexes.length) {
    return { clause: { topicKey: { $in: candidates } } };
  }
  return {
    clause: {
      $or: [
        { topicKey: { $in: candidates } },
        {
          $and: [
            { topicKey: { $nin: candidates } },
            { $or: titleRegexes.map((rx) => ({ topic: rx })) },
          ],
        },
      ],
    },
  };
}

module.exports = {
  normaliseTopicText,
  buildTopicTitleRegex,
  resolveSelectorTopicMatch,
  buildTopicSelectorQueryClause,
};
