/**
 * Evidence presence validation — does NOT judge semantic sufficiency.
 */

function normalizeForEvidenceMatch(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} evidence
 * @param {string} studentAnswer
 * @returns {boolean}
 */
function evidencePresentInAnswer(evidence, studentAnswer) {
  const e = normalizeForEvidenceMatch(evidence);
  if (!e) return false;
  const a = normalizeForEvidenceMatch(studentAnswer);
  return a.includes(e);
}

module.exports = {
  normalizeForEvidenceMatch,
  evidencePresentInAnswer,
};
