/**
 * Higher tier challenge — predict, explain, compare, apply stems.
 */

const { flattenPagesToBlocks, blockHaystack } = require("./blockText");

const HT_STEMS = {
  predict: [/predict what/i, /predict how/i, /what would happen if/i, /if .* limited/i],
  explain: [/explain why/i, /explain how/i, /give a reason/i],
  compare: [/compare /i, /difference between/i, /catabolism and anabolism/i, /define.*describe.*explain/i],
  apply: [/apply /i, /suggest how/i, /growing (plant )?cell/i, /to a .* cell/i],
};

/**
 * @param {object} blueprint
 * @param {object} [ctx]
 */
function buildHigherTierChallengePlan(blueprint = {}, ctx = {}) {
  const tier = (ctx.tier || blueprint.tier || "higher").toLowerCase();
  if (!tier.includes("higher") && tier !== "ht") {
    return { required: false, stems: [] };
  }
  return {
    required: true,
    stems: [
      { type: "predict", example: "Predict what happens to protein synthesis if nitrate ions are limited." },
      { type: "explain", example: "Explain why ATP is needed for anabolic reactions." },
      { type: "compare", example: "Compare catabolism and anabolism." },
      { type: "apply", example: "Apply metabolism to a growing plant cell." },
    ],
  };
}

function buildHigherTierChallengePromptSection(blueprint = {}, ctx = {}) {
  const plan = buildHigherTierChallengePlan(blueprint, ctx);
  if (!plan.required) {
    return "HIGHER TIER: Include stretch where appropriate for Foundation/Mixed.";
  }
  return [
    "HIGHER TIER CHALLENGE (include all four stem types in checkpoints or exam practice):",
    ...plan.stems.map((s) => `- ${s.type.toUpperCase()}: ${s.example}`),
  ].join("\n");
}

/**
 * @param {object[]} pages
 * @param {object} [ctx]
 */
function analyzeHigherTierChallenge(pages, ctx = {}) {
  const tier = String(ctx.tier || "higher").toLowerCase();
  if (tier.includes("foundation") && !tier.includes("higher")) {
    return { required: false, higherTierScore: 70, coverage: {}, gaps: [] };
  }

  const { normalizeHaystack, blockHaystackNormalized } = require("./blockText");
  const blocks = flattenPagesToBlocks(pages);
  const fullText = normalizeHaystack(blocks.map((b) => blockHaystackNormalized(b)).join(" "));
  const coverage = {};
  for (const [type, patterns] of Object.entries(HT_STEMS)) {
    coverage[type] = patterns.some((re) => re.test(fullText));
  }
  const gaps = [];
  for (const [type, found] of Object.entries(coverage)) {
    if (!found) gaps.push(`Missing Higher Tier ${type} question stem`);
  }
  const count = Object.values(coverage).filter(Boolean).length;
  const higherTierScore = Math.min(100, count * 25);

  return { required: true, coverage, gaps, higherTierScore };
}

module.exports = {
  buildHigherTierChallengePlan,
  buildHigherTierChallengePromptSection,
  analyzeHigherTierChallenge,
};
