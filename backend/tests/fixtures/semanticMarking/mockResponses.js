/**
 * Build mock LLM response from expected score for plumbing tests.
 * @param {number} expectedScore
 * @param {string[]} markScheme
 * @param {string} studentAnswer
 */
function buildMockLlmPoints(expectedScore, markScheme, studentAnswer) {
  const answer = String(studentAnswer || "").trim();
  const words = answer.split(/\s+/).filter(Boolean);
  const evidenceChunk = words.slice(0, Math.min(6, words.length)).join(" ") || answer.slice(0, 40);

  return markScheme.map((_, i) => {
    const index = i + 1;
    if (index <= expectedScore) {
      return {
        index,
        judgement: "SATISFIED",
        studentEvidence: evidenceChunk,
        reason: `Point ${index} expressed.`,
      };
    }
    return {
      index,
      judgement: "NOT_EVIDENCED",
      studentEvidence: "",
      reason: `Point ${index} not evidenced.`,
    };
  });
}

module.exports = {
  buildMockLlmPoints,
};
