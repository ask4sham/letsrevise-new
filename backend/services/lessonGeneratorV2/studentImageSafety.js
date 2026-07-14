/**
 * Phase 2 student-safety patterns for retrieval/activity images.
 * Teaching diagrams may label; retrieval images must not reveal answers.
 */

/** Phrases / styles that give away the answer on a student-facing image. */
const STUDENT_IMAGE_REVEAL_PATTERNS = [
  /\bcorrect\s+answer\b/i,
  /\bthe\s+answer\s+is\b/i,
  /\banswer\s*[:\-]\s*\w+/i,
  /\btarget\s+cell\b/i,
  /\bcorrect\s+structure\b/i,
  /\bthis\s+is\s+the\s+(correct|right|answer)\b/i,
  /\blabel(?:led)?\s+as\s+correct\b/i,
  /\bgreen\s+tick\b/i,
  /\bcheckmark\b/i,
  /\bcircled\s+correct\b/i,
  /\bhighlight(?:ed)?\s+correct\b/i,
  /\bANSWER\b/,
  /\bCORRECT\b/,
  /\bTARGET\s+CELL\b/,
];

/**
 * Remove negative instructions ("do not…", "must not…") so safety checks
 * are not tripped by explicit anti-reveal guidance in prompts.
 * @param {string} text
 */
function stripNegativeInstructions(text) {
  return String(text || "")
    .replace(/\b(do not|don't|must not|never|avoid)\b[^.!\n]*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} text
 * @returns {string[]} matching pattern sources
 */
function findRevealLeaks(text) {
  const raw = stripNegativeInstructions(text);
  if (!raw.trim()) return [];
  return STUDENT_IMAGE_REVEAL_PATTERNS.filter((re) => re.test(raw)).map((re) => String(re));
}

/**
 * True if student-facing visual text looks like it reveals the learning outcome.
 * @param {string} text
 * @param {string[]} [extraBannedTerms] structure/answer names that must not appear as labels
 */
function studentImageRevealsAnswer(text, extraBannedTerms = []) {
  if (findRevealLeaks(text).length > 0) return true;
  const lower = stripNegativeInstructions(text).toLowerCase();
  for (const term of extraBannedTerms || []) {
    const t = String(term || "").trim().toLowerCase();
    if (t.length < 4) continue;
    // Flag only when the banned term is presented as an on-image label/name.
    const labelCue = new RegExp(
      `\\b(label(?:led)?|named|marked|captioned)\\b[^.\\n]{0,40}\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b|\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[^.\\n]{0,20}\\b(label|named|marked)\\b`,
      "i"
    );
    if (labelCue.test(lower)) return true;
  }
  return false;
}

module.exports = {
  STUDENT_IMAGE_REVEAL_PATTERNS,
  stripNegativeInstructions,
  findRevealLeaks,
  studentImageRevealsAnswer,
};
