/**
 * Short-answer marking with negation-aware contradiction detection.
 * PR-TRUST: Do NOT award marks when the student answer contradicts the expected concept.
 * Deterministic, rule-based, no AI at runtime.
 */

const STOP = new Set([
  "a", "an", "the", "and", "or", "but", "is", "are", "was", "were",
  "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "of", "to", "in", "on", "for", "with", "cells", "cell", "it", "its",
]);

/** Negation phrases that reverse meaning when applied to a key concept */
const NEGATION_PHRASES = [
  "no", "not", "dont", "don't", "doesnt", "doesn't", "didnt", "didn't",
  "cant", "can't", "cannot", "wont", "won't",
  "without", "lack", "lacks", "lacking", "lacks a", "has no", "hasnt",
  "missing", "absent", "neither", "nor",
];

/**
 * Normalise text for comparison: lowercase, trim, remove punctuation, collapse whitespace.
 * @param {string} s
 * @returns {string}
 */
function normalise(s = "") {
  return String(s)
    .toLowerCase()
    .replace(/'/g, "")   // collapse don't -> dont, hasn't -> hasnt
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract meaningful concept tokens from text (excluding stopwords).
 * @param {string} text
 * @returns {string[]}
 */
function extractConceptTokens(text) {
  return normalise(text)
    .split(" ")
    .filter(Boolean)
    .filter((t) => t.length > 1)
    .filter((t) => !STOP.has(t));
}

/**
 * Fuzzy token match (Levenshtein <= 1 for typo tolerance).
 */
function fuzzyHasToken(userTokens, target) {
  const t = target.toLowerCase();
  return userTokens.some((u) => u === t || levenshtein(u, t) <= 1);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/**
 * Check if the student answer contains a negation phrase near a key expected concept.
 * If so, the answer contradicts the marking point and should not receive credit.
 * @param {string} studentAnswer - raw student answer
 * @param {string[]} keyConceptTokens - tokens that must NOT be negated (e.g. nucleus, membrane)
 * @returns {{ contradiction: boolean; negatedConcept?: string }}
 */
function detectContradiction(studentAnswer, keyConceptTokens) {
  if (!keyConceptTokens || keyConceptTokens.length === 0) {
    return { contradiction: false };
  }

  const norm = normalise(studentAnswer);
  const words = norm.split(" ").filter(Boolean);
  if (words.length === 0) return { contradiction: false };

  const negSet = new Set(NEGATION_PHRASES);

  for (const concept of keyConceptTokens) {
    const conceptLower = concept.toLowerCase().trim();
    if (!conceptLower) continue;

    const idx = words.findIndex((w) => w === conceptLower || levenshtein(w, conceptLower) <= 1);
    if (idx === -1) continue;

    // Check for negation within a window around the concept (before or after)
    const window = 3;
    const start = Math.max(0, idx - window);
    const end = Math.min(words.length - 1, idx + window);

    for (let i = start; i <= end; i++) {
      const w = words[i];
      if (negSet.has(w)) {
        return { contradiction: true, negatedConcept: concept };
      }
      // Also check compound negation phrases
      if (i < words.length - 1) {
        const twoWord = `${w} ${words[i + 1]}`.toLowerCase();
        if (twoWord === "does not" || twoWord === "do not" || twoWord === "has no" || twoWord === "have no") {
          return { contradiction: true, negatedConcept: concept };
        }
      }
    }
  }

  return { contradiction: false };
}

/**
 * Extract key concept tokens from acceptable answer(s).
 * Uses tokens that are likely to be core marking points (longer, substantive words).
 * @param {string|string[]} acceptableAnswers
 * @returns {string[]}
 */
function getKeyConceptTokens(acceptableAnswers) {
  const sources = Array.isArray(acceptableAnswers)
    ? acceptableAnswers
    : [String(acceptableAnswers || "")];

  const allTokens = new Set();
  for (const s of sources) {
    const tokens = extractConceptTokens(s);
    for (const t of tokens) {
      if (t.length >= 3 && !STOP.has(t)) allTokens.add(t);
    }
  }
  return Array.from(allTokens);
}

/**
 * Check if the student answer should be marked as a contradiction (0 marks).
 * Call this BEFORE any similarity/overlap logic.
 * @param {string} studentAnswer
 * @param {string|string[]} acceptableAnswers
 * @returns {{ isContradiction: boolean; negatedConcept?: string }}
 */
function checkContradiction(studentAnswer, acceptableAnswers) {
  const keyConcepts = getKeyConceptTokens(acceptableAnswers);
  const result = detectContradiction(studentAnswer, keyConcepts);
  return { isContradiction: result.contradiction, negatedConcept: result.negatedConcept };
}

/**
 * Main marking function: returns { correct: boolean, reason?: string }.
 * - correct: false if contradiction, or if no core concept match, or overlap too low.
 * - reason: "contradiction" | "no_concept_match" | "low_overlap" | undefined (correct)
 *
 * @param {string} studentAnswer
 * @param {string|string[]} acceptableAnswers - single string or array of model answers
 * @param {Object} [opts]
 * @param {number} [opts.overlapThreshold=0.5] - minimum token overlap ratio
 * @param {boolean} [opts.requireConceptMatch=true] - require at least one key concept
 */
function markShortAnswer(studentAnswer, acceptableAnswers, opts = {}) {
  const { overlapThreshold = 0.5, requireConceptMatch = true } = opts;

  const sources = Array.isArray(acceptableAnswers)
    ? acceptableAnswers
    : [String(acceptableAnswers || "")].filter(Boolean);

  if (sources.length === 0) {
    return { correct: false, reason: "no_model_answer" };
  }

  const normStudent = normalise(studentAnswer);
  if (!normStudent) return { correct: false, reason: "empty" };

  const uTokens = extractConceptTokens(studentAnswer);
  const keyConcepts = getKeyConceptTokens(sources);

  // 1) Contradiction check — must run first
  const contradiction = checkContradiction(studentAnswer, sources);
  if (contradiction.isContradiction) {
    return { correct: false, reason: "contradiction", negatedConcept: contradiction.negatedConcept };
  }

  // 2) Require at least one key concept match
  if (requireConceptMatch && keyConcepts.length > 0) {
    const hasConcept = keyConcepts.some((c) => fuzzyHasToken(uTokens, c));
    if (!hasConcept) {
      return { correct: false, reason: "no_concept_match" };
    }
  }

  // 3) Token overlap (typo-tolerant) — use best match against any acceptable answer
  // so a student who gives one valid answer verbatim passes even if others add more tokens
  let bestOverlap = 0;
  for (const s of sources) {
    const ctokens = extractConceptTokens(s);
    const cSet = new Set(ctokens);
    if (cSet.size === 0) continue;
    let hit = 0;
    for (const ct of cSet) {
      if (fuzzyHasToken(uTokens, ct)) hit++;
    }
    const ov = hit / cSet.size;
    if (ov > bestOverlap) bestOverlap = ov;
  }

  if (bestOverlap < overlapThreshold) {
    return { correct: false, reason: "low_overlap", overlap: bestOverlap };
  }

  return { correct: true };
}

module.exports = {
  normalise,
  extractConceptTokens,
  getKeyConceptTokens,
  detectContradiction,
  checkContradiction,
  markShortAnswer,
  NEGATION_PHRASES,
};
