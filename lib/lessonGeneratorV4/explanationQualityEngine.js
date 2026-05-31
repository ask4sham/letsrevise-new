/**
 * Explanation quality engine — WHAT / HOW / WHY for core concepts.
 */

const { flattenPagesToBlocks, blockHaystackNormalized, wordCount, inferConceptFromBlock } = require("./blockText");

const GENERIC_AI = [
  "it is important to note",
  "in conclusion",
  "various factors",
  "plays a crucial role",
  "delve into",
  "landscape of",
  "multifaceted",
  "utilize",
  "leverage",
];

const SHALLOW = [
  "is defined as",
  "simply put",
  "basically",
  "in other words",
];

/**
 * @param {object[]} pages
 */
function analyzeExplanationQuality(pages) {
  const blocks = flattenPagesToBlocks(pages);
  const evaluations = [];
  const flags = [];
  let total = 0;
  let passed = 0;

  blocks.forEach((block, index) => {
    const type = String(block.type || "").toLowerCase();
    const role = String(block.role || "").toLowerCase();
    const isTeach =
      role === "concept" ||
      role === "corerule" ||
      type === "text" ||
      type === "keyidea" ||
      type === "text-concept";
    if (!isTeach) return;

    const hay = blockHaystackNormalized(block);
    const wc = wordCount(hay);
    if (wc < 12) return;

    total++;
    const what =
      hay.includes(" is ") ||
      hay.includes("means") ||
      hay.includes("definition") ||
      hay.includes("key idea") ||
      hay.includes("central idea") ||
      hay.includes("catabolism") ||
      hay.includes("anabolism");
    const how =
      hay.includes("how") ||
      hay.includes("process") ||
      hay.includes("→") ||
      hay.includes("step") ||
      hay.includes("involves") ||
      hay.includes("breaks down");
    const why =
      hay.includes("why") ||
      hay.includes("exam") ||
      hay.includes("matter") ||
      hay.includes("mark") ||
      hay.includes("powers") ||
      hay.includes("earns");
    const misconception = hay.includes("mistake") || hay.includes("confus") || hay.includes("not ");
    const generic = GENERIC_AI.some((g) => hay.includes(g));
    const shallow = SHALLOW.some((s) => hay.includes(s)) && wc < 80;

    let clarity = wc >= 40 && wc <= 350 ? 85 : wc < 40 ? 55 : 70;
    let depth = (what && how && why ? 90 : what && how ? 70 : 50) - (shallow ? 15 : 0);
    let gcse = hay.includes("gcse") || hay.includes("mark") || hay.includes("aqa") ? 80 : 65;
    let examUse = why ? 85 : 50;

    if (generic) {
      flags.push({ blockIndex: index, kind: "generic_ai_wording", concept: inferConceptFromBlock(block) });
      clarity -= 20;
    }
    if (shallow) {
      flags.push({ blockIndex: index, kind: "shallow_explanation", concept: inferConceptFromBlock(block) });
      depth -= 25;
    }
    if (!what || !how || !why) {
      flags.push({
        blockIndex: index,
        kind: "missing_what_how_why",
        missing: [!what && "WHAT", !how && "HOW", !why && "WHY"].filter(Boolean),
        concept: inferConceptFromBlock(block),
      });
    }

    const blockScore = Math.round((clarity + depth + gcse + examUse) / 4);
    if (blockScore >= 70) passed++;

    evaluations.push({
      blockIndex: index,
      concept: inferConceptFromBlock(block),
      clarity,
      depth,
      gcseAppropriateness: gcse,
      examUsefulness: examUse,
      misconceptionAddressed: misconception,
      score: blockScore,
    });
  });

  const explanationScore =
    total === 0 ? 40 : Math.round((passed / total) * 100 * 0.7 + (evaluations.reduce((s, e) => s + e.score, 0) / total) * 0.3);

  return {
    evaluations,
    flags,
    explanationScore,
    blocksAnalysed: total,
    blocksPassing: passed,
  };
}

module.exports = {
  analyzeExplanationQuality,
};
