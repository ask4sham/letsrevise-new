/**
 * Concept linking — chains and bridge sentences between major ideas.
 */

const { flattenPagesToBlocks, blockHaystackNormalized, normalizeHaystack } = require("./blockText");

const LINK_MARKERS = [
  /this links back to/i,
  /this links directly/i,
  /keep hold of/i,
  /builds on/i,
  /leads to/i,
  /→/,
  /glucose.*respiration|respiration.*atp|atp.*anabol/i,
];

const ARCHETYPE_CHAINS = {
  metabolism:
    "Glucose → respiration → ATP → anabolic reactions → protein synthesis → growth",
  respiration: "Glucose → glycolysis → aerobic/anaerobic pathways → ATP → cell processes",
  default: "Name the chain explicitly after each major concept.",
};

/**
 * @param {object} blueprint
 */
function buildConceptLinkingPlan(blueprint = {}) {
  const chain =
    ARCHETYPE_CHAINS[blueprint.lessonArchetype] || ARCHETYPE_CHAINS.default;
  return {
    lessonChain: chain,
    bridgePhrases: [
      "This links back to…",
      "Keep hold of that idea because…",
      "Now we have seen X, let's look at Y…",
    ],
    concepts: (blueprint.concepts || []).map((c) => c.name),
  };
}

function buildConceptLinkingPromptSection(blueprint = {}) {
  const plan = buildConceptLinkingPlan(blueprint);
  return [
    "CONCEPT LINKING (repeat chains — do not teach isolated definitions):",
    `Lesson chain: ${plan.lessonChain}`,
    "After each major concept add a short bridge: 'This links back to…'",
    "Use → arrows in teaching where helpful.",
    plan.bridgePhrases.map((p) => `- ${p}`).join("\n"),
  ].join("\n");
}

/**
 * @param {object[]} pages
 */
function analyzeConceptLinking(pages) {
  const blocks = flattenPagesToBlocks(pages);
  const fullText = normalizeHaystack(blocks.map((b) => blockHaystackNormalized(b)).join(" "));
  let linkHits = 0;
  for (const re of LINK_MARKERS) {
    if (re.test(fullText)) linkHits++;
  }
  const gaps = [];
  if (linkHits < 2) gaps.push("Few explicit concept links — add chains and bridge sentences");
  if (!/→|->/.test(fullText) && linkHits < 3) {
    gaps.push("No visible concept chain (e.g. glucose → ATP → anabolism)");
  }

  const conceptLinkingScore = Math.min(100, linkHits * 22);

  return { linkHits, conceptLinkingScore, gaps };
}

module.exports = {
  buildConceptLinkingPlan,
  buildConceptLinkingPromptSection,
  analyzeConceptLinking,
};
