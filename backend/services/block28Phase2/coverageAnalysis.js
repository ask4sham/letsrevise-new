/**
 * Block 28 Phase 2 — coverage gap analysis vs lesson content boundary.
 */
const { normalizeForCompare } = require("./qualityGates");
const { curriculumOverlapScore } = require("./selectionEngine");
const { isMeaningfulObjective, isNoiseToken } = require("./coverageGapFilter");

const COVERAGE = Object.freeze({
  COVERED: "COVERED",
  PARTLY_COVERED: "PARTLY_COVERED",
  NOT_COVERED: "NOT_COVERED",
});

function objectiveCoverage(objective, finalQuestions) {
  const objNorm = normalizeForCompare(objective);
  const objTokens = objNorm.split(" ").filter((w) => w.length > 4 && !isNoiseToken(w));
  if (objTokens.length < 2) return COVERAGE.NOT_COVERED;
  let best = 0;
  for (const q of finalQuestions) {
    const qNorm = normalizeForCompare(q.proposedQuestion || q.question || "");
    let hit = 0;
    for (const t of objTokens) if (qNorm.includes(t)) hit++;
    best = Math.max(best, hit / objTokens.length);
  }
  if (best >= 0.45) return COVERAGE.COVERED;
  if (best >= 0.2) return COVERAGE.PARTLY_COVERED;
  return COVERAGE.NOT_COVERED;
}

/**
 * @param {object} boundary
 * @param {object[]} finalRepairs
 * @param {object[]} excessAttachments
 */
function analyzeCoverageGaps(boundary, finalRepairs, excessAttachments) {
  const finalQuestions = finalRepairs;
  const meaningfulObjectives = (boundary.meaningfulObjectives || boundary.coreConcepts || []).filter(
    isMeaningfulObjective
  );

  const conceptMap = meaningfulObjectives.map((concept) => ({
    concept,
    status: objectiveCoverage(concept, finalQuestions),
  }));

  const meaningfulTerms = (boundary.meaningfulKeyTerms || boundary.keyTerms || []).filter(
    (t) => !isNoiseToken(t)
  );

  const termMap = meaningfulTerms.slice(0, 15).map((term) => {
    const covered = finalQuestions.some((q) =>
      normalizeForCompare(q.proposedQuestion || "").includes(term.toLowerCase())
    );
    return { term, status: covered ? COVERAGE.COVERED : COVERAGE.NOT_COVERED };
  });

  const notCovered = [
    ...conceptMap.filter((c) => c.status === COVERAGE.NOT_COVERED),
    ...termMap.filter((t) => t.status === COVERAGE.NOT_COVERED),
  ];

  const gapProposals = [];
  for (const gap of notCovered) {
    const label = gap.concept || gap.term;
    if (!label || isNoiseToken(label)) continue;
    if (gap.concept && !isMeaningfulObjective(label)) continue;

    const reuse = excessAttachments
      .filter((a) => a.supported)
      .map((a) => ({
        questionId: a.questionId,
        question: a.question,
        score: curriculumOverlapScore(a.question, { keyTerms: [String(label).toLowerCase()] }),
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (gap.concept) {
      gapProposals.push({
        gap: label,
        status: COVERAGE.NOT_COVERED,
        recommendation:
          reuse && reuse.score >= 0.35
            ? {
                type: "REVISED_EXISTING_MASTER",
                questionId: reuse.questionId,
                note: "Excess attachment may fill gap with revision",
              }
            : {
                type: "NEW_MASTER_REQUIRED",
                note: "Genuine lesson objective not covered by proposed final set",
              },
      });
    }
  }

  return {
    conceptMap,
    termMap,
    notCoveredCount: notCovered.length,
    gapProposals: gapProposals.slice(0, 5),
    noiseGapsFiltered: true,
  };
}

module.exports = {
  COVERAGE,
  analyzeCoverageGaps,
  objectiveCoverage,
};
