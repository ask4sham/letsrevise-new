/**
 * Examiner intelligence — students write / AQA expects / better answer / full marks.
 */

const { flattenPagesToBlocks, blockHaystack } = require("./blockText");

const EXAMINER_MARKERS = {
  studentsOften: [/students often/, /pupils often/, /many students/, /common mistake/],
  aqaExpects: [/aqa expects/, /examiners? expect/, /mark scheme/, /in the exam/],
  betterAnswer: [/better answer/, /better:/, /instead say/, /do not just say/],
  fullMark: [/full[- ]?mark/, /full marks/, /grade 9/, /model answer/],
  misconception: [/misconception/, /confus/, /incorrect/],
};

/**
 * @param {object} blueprint
 */
function buildExaminerIntelligencePlan(blueprint = {}) {
  return (blueprint.concepts || []).map((c) => ({
    conceptId: c.id,
    conceptName: c.name,
    templates: {
      studentsOften: `Students often write… (${c.name})`,
      aqaExpects: `AQA expects… (${c.name})`,
      betterAnswer: `A better answer would be…`,
      fullMark: `Full-mark answer example…`,
      misconception: c.misconceptions?.[0] || "Common misconception…",
    },
    placement: "Weave into core teaching, not only exam practice blocks.",
  }));
}

/**
 * @param {object[]} pages
 */
function analyzeExaminerIntelligence(pages) {
  const blocks = flattenPagesToBlocks(pages);
  const coverage = {
    studentsOften: 0,
    aqaExpects: 0,
    betterAnswer: 0,
    fullMark: 0,
    misconception: 0,
  };
  const inCoreTeaching = Object.create(null);
  const gaps = [];

  blocks.forEach((block) => {
    const hay = blockHaystack(block);
    const role = String(block.role || "").toLowerCase();
    const inExamOnly = role === "exampractice" || role === "examtechnique";

    for (const [key, patterns] of Object.entries(EXAMINER_MARKERS)) {
      if (patterns.some((re) => re.test(hay))) {
        coverage[key]++;
        if (!inExamOnly) inCoreTeaching[key] = (inCoreTeaching[key] || 0) + 1;
      }
    }
  });

  if (!coverage.studentsOften) gaps.push("No 'students often write' modelling");
  if (!coverage.aqaExpects) gaps.push("No explicit AQA / examiner expectation language");
  if (!coverage.betterAnswer) gaps.push("No 'better answer would be' contrast");
  if (!coverage.fullMark) gaps.push("No full-mark / model answer example");
  if (!inCoreTeaching.studentsOften && !inCoreTeaching.aqaExpects) {
    gaps.push("Examiner intelligence only in exam sections — weave into teaching");
  }

  const examReadinessScore = Math.min(
    100,
    Math.round(
      (coverage.studentsOften ? 20 : 0) +
        (coverage.aqaExpects ? 25 : 0) +
        (coverage.betterAnswer ? 20 : 0) +
        (coverage.fullMark ? 25 : 0) +
        (coverage.misconception ? 10 : 0)
    )
  );

  return {
    coverage,
    inCoreTeaching,
    gaps,
    examReadinessScore,
  };
}

module.exports = {
  buildExaminerIntelligencePlan,
  analyzeExaminerIntelligence,
};
