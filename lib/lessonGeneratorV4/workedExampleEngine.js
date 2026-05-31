/**
 * Worked example engine — stepped walkthrough, full-mark answer, why marks awarded.
 */

const { flattenPagesToBlocks, blockHaystackNormalized } = require("./blockText");

const WORKED_MARKERS = {
  workedExample: [/worked example/i, /role.*workedexample/i],
  stepped: [/step 1/i, /step 2/i, /identify the command word/i],
  fullMark: [/full[- ]?mark answer/i, /full marks/i],
  whyMarks: [/why this gets marks/i, /earns marks because/i, /mentions respiration/i],
  questionStem: [/question:/i, /\(\d+ marks?\)/i],
};

const WORKED_TEMPLATE = `Question:
Explain why respiration is important in metabolism. (3 marks)

Step 1 — Identify the command word (explain = give reasons).
Step 2 — Name the key process (respiration transfers energy from glucose).
Step 3 — Link process to ATP (ATP stores usable energy for cells).
Step 4 — Link ATP to anabolic reactions (building larger molecules).

Full-mark answer:
Respiration transfers energy from glucose to ATP. ATP then provides energy for metabolic reactions such as protein synthesis and the production of larger molecules.

Why this gets marks:
- Mentions respiration
- Mentions ATP
- Links ATP to metabolic / anabolic reactions`;

/**
 * @param {object} blueprint
 */
function buildWorkedExamplePlan(blueprint = {}) {
  const topic = blueprint.lessonArchetype || "lesson";
  return {
    required: true,
    format: WORKED_TEMPLATE,
    topic,
    minimum: 1,
  };
}

function buildWorkedExamplePromptSection(blueprint = {}) {
  return [
    "WORKED EXAMPLE (at least one — stepped examiner walkthrough):",
    WORKED_TEMPLATE,
    "",
    `Topic anchor: ${(blueprint.concepts || []).map((c) => c.name).join(" → ") || blueprint.lessonArchetype}`,
    "Include Question, Steps 1–4, Full-mark answer, Why this gets marks.",
  ].join("\n");
}

/**
 * @param {object[]} pages
 */
function analyzeWorkedExamples(pages) {
  const blocks = flattenPagesToBlocks(pages);
  const found = {
    workedExample: false,
    stepped: false,
    fullMark: false,
    whyMarks: false,
    questionStem: false,
  };
  const gaps = [];

  blocks.forEach((block) => {
    const hay = blockHaystackNormalized(block);
    const role = String(block.role || "").toLowerCase();
    if (
      role === "workedexample" ||
      WORKED_MARKERS.workedExample.some((re) => re.test(hay)) ||
      role === "examtechnique"
    ) {
      found.workedExample = true;
    }
    for (const [key, patterns] of Object.entries(WORKED_MARKERS)) {
      if (patterns.some((re) => re.test(hay))) found[key] = true;
    }
  });

  if (!found.workedExample) gaps.push("Missing worked example block");
  if (!found.stepped) gaps.push("Worked example missing stepped structure (Step 1, Step 2…)");
  if (!found.fullMark) gaps.push("Missing full-mark answer in worked example");
  if (!found.whyMarks) gaps.push("Missing 'Why this gets marks' in worked example");

  const count = [found.workedExample, found.stepped, found.fullMark, found.whyMarks].filter(
    Boolean
  ).length;
  const workedExampleScore = Math.min(100, count * 25);

  return {
    found,
    gaps,
    workedExampleScore,
    complete: count >= 3,
    strong: count >= 4 && found.stepped,
  };
}

module.exports = {
  buildWorkedExamplePlan,
  buildWorkedExamplePromptSection,
  analyzeWorkedExamples,
  WORKED_TEMPLATE,
};
