/**
 * Examiner brain — Students often write / AQA wants / Better answer / Full-mark phrase per concept.
 */

const { flattenPagesToBlocks, blockHaystackNormalized } = require("./blockText");

const BRAIN_MARKERS = {
  studentsOften: [/students often write/i, /pupils often write/i, /many students write/i, /writing.*digestion/i],
  aqaWants: [/aqa wants/i, /aqa expects/i, /examiners? want/i, /think like an examiner/i, /write what earns marks/i],
  betterAnswer: [/better answer/i, /better:/i, /stronger answer/i, /✅/i],
  fullMarkPhrase: [/full[- ]?mark phrase/i, /full[- ]?mark:/i, /use the phrase/i, /transfers energy/i, /glucose.*respiration/i, /key chains/i],
};

/**
 * @param {object} blueprint
 */
function buildExaminerBrainPlan(blueprint = {}) {
  const archetype = blueprint.lessonArchetype;
  const examples = {
    metabolism: {
      concept: "Respiration / energy transfer",
      studentsOften: '"Respiration produces energy."',
      aqaWants: '"Respiration transfers energy from glucose."',
      betterAnswer:
        '"Respiration transfers energy from glucose to ATP, which cells use for metabolic reactions."',
      fullMarkPhrase: '"transfers energy from glucose"',
    },
  };
  const sample = examples[archetype] || examples.metabolism;

  return (blueprint.concepts || []).map((c) => ({
    conceptId: c.id,
    conceptName: c.name,
    template: sample,
    requiredLines: [
      "Students often write:",
      "AQA wants:",
      "Better answer:",
      "Full-mark phrase:",
    ],
  }));
}

function buildExaminerBrainPromptSection(blueprint = {}) {
  const plan = buildExaminerBrainPlan(blueprint);
  const sample = plan[0]?.template || buildExaminerBrainPlan({ lessonArchetype: "metabolism" })[0]?.template;
  return [
    "EXAMINER BRAIN (weave into core teaching for EACH major concept):",
    "Students often write:",
    "AQA wants:",
    "Better answer:",
    "Full-mark phrase:",
    "",
    "Example:",
    `Students often write: ${sample?.studentsOften || "…"}`,
    `AQA wants: ${sample?.aqaWants || "…"}`,
    `Better answer: ${sample?.betterAnswer || "…"}`,
    `Full-mark phrase: ${sample?.fullMarkPhrase || "…"}`,
    "",
    `Concepts: ${(blueprint.concepts || []).map((c) => c.name).join(", ") || "all core ideas"}`,
  ].join("\n");
}

/**
 * @param {object[]} pages
 */
function analyzeExaminerBrain(pages) {
  const blocks = flattenPagesToBlocks(pages);
  const coverage = Object.fromEntries(Object.keys(BRAIN_MARKERS).map((k) => [k, 0]));
  const gaps = [];

  blocks.forEach((block) => {
    const hay = blockHaystackNormalized(block);
    for (const [key, patterns] of Object.entries(BRAIN_MARKERS)) {
      if (patterns.some((re) => re.test(hay))) coverage[key]++;
    }
  });

  for (const [key, count] of Object.entries(coverage)) {
    if (!count) gaps.push(`Missing examiner brain line: ${key}`);
  }

  const examinerBrainScore = Math.min(
    100,
    Object.values(coverage).filter((n) => n > 0).length * 25
  );

  return { coverage, gaps, examinerBrainScore };
}

module.exports = {
  buildExaminerBrainPlan,
  buildExaminerBrainPromptSection,
  analyzeExaminerBrain,
};
