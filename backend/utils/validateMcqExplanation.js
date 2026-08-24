/**
 * Deterministic quality checks for AI-generated MCQ rationales (V2.1).
 * Do NOT apply these minimum-quality rules to manually authored teacher rationales
 * (those keep the PR #82 length-only contract via normalizeMcqPartData).
 */

const MCQ_EXPLANATION_MAX_LENGTH = 1000;
/** Conservative floor that still accepts short genuine rationales (e.g. "Water activates enzymes."). */
const MCQ_EXPLANATION_MIN_LENGTH = 20;
const MCQ_EXPLANATION_MIN_WORDS = 3;

const NEUTRAL_WHY_CORRECT = "The selected response matches the correct answer.";

const HTML_TAG_RE = /<\/?[a-z][\s\S]*?>/i;
const MARKDOWN_HEADING_RE = /^\s{0,3}#{1,6}\s+\S/m;

const GENERIC_NON_EXPLANATION_RE =
  /^(this\s+is\s+correct\.?|it\s+is\s+(the\s+)?(right|correct)\s+answer\.?|that\s+is\s+correct\.?|correct\.?|yes\.?)$/i;

function normalizeText(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text) {
  const t = normalizeText(text);
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function isAdministrativeMarkingLine(text) {
  const t = normalizeText(text);
  if (!t) return true;
  return (
    /^award\s+\d+\s+marks?\b/i.test(t) ||
    /^\d+\s+marks?\s+for\b/i.test(t) ||
    /^accept\b/i.test(t) ||
    /^do\s+not\s+accept\b/i.test(t) ||
    /^correct\s+answer\s*:/i.test(t) ||
    /^select(?:ing|ed)?\s+(?:option\s+)?[a-d]\b/i.test(t) ||
    /^award\s+1\s+mark\s+for\s+selecting\b/i.test(t)
  );
}

function isBareCorrectOptionText(text, correctOption) {
  const t = normalizeText(text);
  if (!t) return true;
  const opt = normalizeText(correctOption || "");

  if (opt && t.toLowerCase() === opt.toLowerCase()) return true;
  if (/^option\s*[a-d]$/i.test(t) || /^[a-d]$/i.test(t)) return true;

  const labeled = t.match(/^(?:option\s*)?([a-d])\s*[—\-–:]\s*(.+)$/i);
  if (labeled) {
    const rest = normalizeText(labeled[2] || "");
    if (!rest) return true;
    if (opt && rest.toLowerCase() === opt.toLowerCase()) return true;
  }

  const declared = t.match(/^correct\s+answer\s*:\s*(?:[a-d]\s*[—\-–:]\s*)?(.+)$/i);
  if (declared) {
    const rest = normalizeText(declared[1] || "");
    if (!rest) return true;
    if (opt && rest.toLowerCase() === opt.toLowerCase()) return true;
    if (/^[a-d]$/i.test(rest) || /^option\s*[a-d]$/i.test(rest)) return true;
  }

  // "This is correct because it is Light."
  if (opt && new RegExp(`^this\\s+is\\s+correct\\s+because\\s+it\\s+is\\s+${escapeRegExp(opt)}\\.?$`, "i").test(t)) {
    return true;
  }
  if (/^the\s+answer\s+is\s+(?:option\s*)?[a-d]\.?$/i.test(t)) return true;

  return false;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {unknown} value
 * @param {{ correctOption?: string }} [opts]
 * @returns {{ ok: true, explanation: string } | { ok: false, issues: string[] }}
 */
function validateMcqExplanation(value, opts = {}) {
  const issues = [];
  const correctOption = opts.correctOption != null ? String(opts.correctOption) : "";

  if (value == null) {
    return { ok: false, issues: ["explanation_missing"] };
  }
  if (typeof value !== "string") {
    return { ok: false, issues: ["explanation_not_string"] };
  }

  const explanation = value.trim();
  if (!explanation) {
    return { ok: false, issues: ["explanation_empty"] };
  }
  if (explanation.length > MCQ_EXPLANATION_MAX_LENGTH) {
    issues.push("explanation_too_long");
  }
  if (explanation.length < MCQ_EXPLANATION_MIN_LENGTH) {
    issues.push("explanation_too_short");
  }
  if (wordCount(explanation) < MCQ_EXPLANATION_MIN_WORDS) {
    issues.push("explanation_too_few_words");
  }
  if (HTML_TAG_RE.test(explanation)) {
    issues.push("explanation_html");
  }
  if (MARKDOWN_HEADING_RE.test(explanation)) {
    issues.push("explanation_markdown_heading");
  }
  if (normalizeText(explanation).toLowerCase() === NEUTRAL_WHY_CORRECT.toLowerCase()) {
    issues.push("explanation_neutral_fallback");
  }
  if (GENERIC_NON_EXPLANATION_RE.test(explanation) || /^this\s+is\s+correct\.?$/i.test(explanation)) {
    issues.push("explanation_generic");
  }
  if (isAdministrativeMarkingLine(explanation)) {
    issues.push("explanation_administrative");
  }
  if (isBareCorrectOptionText(explanation, correctOption)) {
    if (/^correct\s+answer\s*:/i.test(normalizeText(explanation)) || /^the\s+answer\s+is\b/i.test(normalizeText(explanation))) {
      issues.push("explanation_answer_declaration");
    } else if (/^option\s*[a-d]$/i.test(normalizeText(explanation)) || /^[a-d]$/i.test(normalizeText(explanation))) {
      issues.push("explanation_option_letter");
    } else {
      issues.push("explanation_bare_option");
    }
  }

  if (issues.length) {
    return { ok: false, issues };
  }
  return { ok: true, explanation };
}

module.exports = {
  MCQ_EXPLANATION_MAX_LENGTH,
  MCQ_EXPLANATION_MIN_LENGTH,
  MCQ_EXPLANATION_MIN_WORDS,
  NEUTRAL_WHY_CORRECT,
  validateMcqExplanation,
};
