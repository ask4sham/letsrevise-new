/**
 * Shared generic examiner-credit / rubric-fragment detection (Policy E + semantic marking safety).
 */

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "to", "for", "is", "are", "was", "were", "be", "by",
  "with", "from", "as", "at", "on", "it", "its", "this", "that", "which", "where", "when", "body",
  "through", "along", "into", "during", "after", "before", "each", "one", "two", "three", "four",
  "five", "six", "seven", "eight", "nine", "ten", "not", "may", "can", "more", "less", "than",
]);

function normalizeForCompare(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulContentWords(text) {
  return normalizeForCompare(text)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Mark-scheme rubric credit lines ("Mentions the chromosome.") — not awardable claims.
 */
function isRubricCreditInstructionPoint(point) {
  const text = String(point || "").trim();
  if (!text) return false;

  const contentWords = meaningfulContentWords(text);
  const rubricVerbTheSingleNoun =
    /^(mentions?|names?|considers?|uses?|describes?|states?|identifies?)\s+the\s+[a-z]+\.?\s*$/i.test(text);
  if (rubricVerbTheSingleNoun && contentWords.length <= 3) return true;

  const rubricVerbAQualifiedNoun =
    /^(names?|gives?)\s+(a|an)\s+(valid\s+|linked\s+|correct\s+|suitable\s+)?[a-z]+\.?\s*$/i.test(text);
  if (rubricVerbAQualifiedNoun && contentWords.length <= 4) return true;

  return false;
}

/** Additional short meta fragments students may echo without a biological proposition. */
const STUDENT_META_FRAGMENT_PATTERNS = [
  /^talks? about [a-z]+\.?\s*$/i,
  /^describes? nutrition\.?\s*$/i,
  /^gives? a valid example\.?\s*$/i,
  /^uses? complementary bases\.?\s*$/i,
  /^mentions? a factor\.?\s*$/i,
];

/**
 * Student evidence that is only an examiner-style credit fragment, not a substantive proposition.
 * Used to downgrade unsafe LLM SATISFIED judgements (never to upgrade).
 */
function isGenericStudentCreditFragment(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return false;
  if (isRubricCreditInstructionPoint(trimmed)) return true;
  if (STUDENT_META_FRAGMENT_PATTERNS.some((re) => re.test(trimmed))) return true;
  return false;
}

module.exports = {
  isRubricCreditInstructionPoint,
  isGenericStudentCreditFragment,
  meaningfulContentWords,
  normalizeForCompare,
};
