/**
 * Exam readiness — application, exam-style, misconception, and science-specific checks.
 */

const { flattenPagesToBlocks, blockHaystack } = require("./lessonBlockAnalysis");

const SCIENCE_ARCHETYPES = new Set([
  "metabolism",
  "uses_of_glucose",
  "limiting_factors",
  "respiration",
  "plant_defences",
  "general_gcse_biology",
]);

/**
 * @param {object[]} pages
 * @param {{ lessonArchetype?: string, subject?: string }} [ctx]
 */
function assessExamReadiness(pages, ctx = {}) {
  const blocks = flattenPagesToBlocks(pages);
  const archetype = ctx.lessonArchetype || "general_gcse_biology";
  const subject = String(ctx.subject || "Biology").toLowerCase();
  const isScience = subject.includes("biology") || subject.includes("chemistry") || subject.includes("physics");

  let hasApplication = false;
  let hasExamStyle = false;
  let hasMisconception = false;
  let hasDataOrGraph = false;
  let hasPractical = false;

  blocks.forEach((block) => {
    const type = String(block.type || "").toLowerCase();
    const role = String(block.role || "").toLowerCase();
    const hay = blockHaystack(block);

    if (role === "exampractice" || hay.includes("exam practice") || hay.includes("mark scheme")) {
      hasExamStyle = true;
    }
    if (type === "checkpoint" || role === "quickcheck" || hay.includes("apply")) {
      hasApplication = true;
    }
    if (role === "commonmistake" || type === "commonmistake" || hay.includes("common mistake")) {
      hasMisconception = true;
    }
    if (type === "graph" || hay.includes("graph") || hay.includes("data interpretation")) {
      hasDataOrGraph = true;
    }
    if (hay.includes("practical") || hay.includes("required practical") || hay.includes("method")) {
      hasPractical = true;
    }
    if (type === "dragdropmatch" || type === "interactivesequence") {
      hasApplication = true;
    }
  });

  const needsScienceExtra =
    isScience && SCIENCE_ARCHETYPES.has(archetype) && archetype === "limiting_factors";
  const scienceExtraOk = !needsScienceExtra || hasDataOrGraph || hasPractical;

  const missing = [];
  if (!hasApplication) missing.push("application_question");
  if (!hasExamStyle) missing.push("exam_style_question");
  if (!hasMisconception) missing.push("misconception_check");
  if (needsScienceExtra && !scienceExtraOk) {
    missing.push("data_or_graph_or_practical");
  }

  const requiredCount = needsScienceExtra ? 4 : 3;
  const metCount = requiredCount - missing.length;

  return {
    hasApplication,
    hasExamStyle,
    hasMisconception,
    hasDataOrGraph,
    hasPractical,
    scienceExtraOk,
    missing,
    valid: missing.length === 0,
    score: Math.round((metCount / requiredCount) * 100),
  };
}

module.exports = {
  assessExamReadiness,
};
