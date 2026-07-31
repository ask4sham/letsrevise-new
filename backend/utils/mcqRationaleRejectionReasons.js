/**
 * V2.3B2b1 — fixed rejection reason codes for rationale candidates.
 */

const REJECTION_REASON_CODES = Object.freeze([
  "inaccurate",
  "unclear",
  "too_generic",
  "repeats_answer",
  "unsupported_detail",
  "unsuitable_exam_language",
  "other",
]);

const REJECTION_REASON_CODE_SET = new Set(REJECTION_REASON_CODES);

const MAX_REJECTION_NOTE_LENGTH = 300;

function isValidRejectionReasonCode(code) {
  return typeof code === "string" && REJECTION_REASON_CODE_SET.has(code);
}

module.exports = {
  REJECTION_REASON_CODES,
  REJECTION_REASON_CODE_SET,
  MAX_REJECTION_NOTE_LENGTH,
  isValidRejectionReasonCode,
};
