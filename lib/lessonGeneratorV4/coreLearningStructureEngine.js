/**
 * Core learning structure — Big idea → What happens → Why it matters → AQA link → Trap → Quick check.
 */

const { flattenPagesToBlocks, blockHaystackNormalized } = require("./blockText");

const CORE_SECTION_MARKERS = {
  bigIdea: [/big idea/i, /central idea/i, /key idea is/i, /the key idea/i, /core rule/i],
  whatHappens: [/what happens/i, /process/i, /catabolism/i, /anabolism/i, /→/, /involves brea/i],
  whyMatters: [/why it matters/i, /why this matters/i, /matters because/i, /powers synthesis/i],
  aqaLink: [/aqa/i, /in the exam/i, /examiners?/i, /mark scheme/i, /transfers energy/i, /think like an examiner/i, /earns marks/i],
  commonTrap: [/common trap/i, /common mistake/i, /do not just/i, /students often/i, /better:/i],
  quickCheck: [/quick check/i, /check your understanding/i, /explain why/i, /checkpoint/i, /q1 \(/i],
};

/**
 * @param {object} blueprint
 */
function buildCoreLearningStructurePlan(blueprint = {}) {
  return (blueprint.concepts || []).map((c) => ({
    conceptId: c.id,
    conceptName: c.name,
    structure: [
      "Big idea — one memorable sentence (not a textbook definition opener)",
      "What happens — cause → effect chain",
      "Why it matters — link to cell processes / growth / exam demand",
      "AQA exam link — precise wording examiners credit",
      "Common trap — what pupils write vs better phrasing",
      "Quick check — one explain-style retrieval sentence",
    ],
  }));
}

function buildCoreLearningPromptSection(blueprint = {}) {
  const lines = [
    "CORE LEARNING BLOCKS (every major concept — mandatory headings or equivalent):",
    "1. Big idea",
    "2. What happens",
    "3. Why it matters",
    "4. AQA exam link",
    "5. Common trap",
    "6. Quick check (mini retrieval in the same block)",
    "",
    "Example (ATP):",
    "- Big idea: ATP is the cell's immediate energy currency.",
    "- What happens: respiration transfers energy from glucose to ATP.",
    "- Why it matters: ATP powers active transport, protein synthesis, cell division.",
    '- AQA exam link: say "transfers energy", not "produces energy".',
    "- Common trap: pupils say energy is made.",
    "- Quick check: explain why cells need ATP instead of glucose directly.",
  ];
  const plan = buildCoreLearningStructurePlan(blueprint);
  if (plan.length) {
    lines.push("", "Apply this structure to:", plan.map((p) => p.conceptName).join(", "));
  }
  return lines.join("\n");
}

/**
 * @param {object[]} pages
 */
function analyzeCoreLearningStructure(pages) {
  const blocks = flattenPagesToBlocks(pages);
  const conceptBlocks = blocks.filter((b) => {
    const role = String(b.role || "").toLowerCase();
    return role === "concept" || role === "corerule" || String(b.type || "").toLowerCase() === "text";
  });
  let bestScore = 0;
  const gaps = [];

  conceptBlocks.forEach((block) => {
    const hay = blockHaystackNormalized(block);
    if (hay.length < 80) return;
    let hits = 0;
    for (const patterns of Object.values(CORE_SECTION_MARKERS)) {
      if (patterns.some((re) => re.test(hay))) hits++;
    }
    bestScore = Math.max(bestScore, Math.round((hits / 6) * 100));
  });

  if (bestScore < 50) gaps.push("Core learning missing Big idea / What happens / Why it matters structure");
  if (bestScore < 70) gaps.push("Weak AQA exam link or common trap in core teaching");

  return {
    coreLearningScore: bestScore || 40,
    sectionsFound: CORE_SECTION_MARKERS,
    gaps,
  };
}

module.exports = {
  buildCoreLearningStructurePlan,
  buildCoreLearningPromptSection,
  analyzeCoreLearningStructure,
};
