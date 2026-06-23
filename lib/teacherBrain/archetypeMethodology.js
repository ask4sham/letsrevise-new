/**
 * Phase 4.2 — Archetype teaching methodology helpers.
 * Maths: method → working → checking → examiner marks (NOT cause → effect).
 * History: structured consequence/significance frameworks.
 */

/** @typedef {object} TeachingMethodology
 * @property {string[]} chain
 * @property {string} learningModel
 * @property {Record<string, string>} steps
 * @property {string} blockPlacement
 */

function mathsMethodology(steps) {
  return {
    chain: [
      "Formula",
      "Method",
      "Worked Example",
      "Common Error",
      "Examiner Method Marks",
      "Challenge Question",
    ],
    learningModel:
      "Method → show every step of working → check answer → earn method marks. Do NOT teach maths as science cause→effect chains.",
    steps,
    blockPlacement:
      "Core Teaching = Method; Common Mistake = Common Error; Worked Example = full worked solution with method marks labelled; Exam Practice ends with Challenge Question.",
  };
}

function historyFrameworkMethodology(chain, steps) {
  return {
    chain,
    learningModel: "Evidence-based historical reasoning with explicit framework stages — not generic narrative.",
    steps,
    blockPlacement:
      "Core Teaching walks through each framework stage; Exam Practice requires judgement using the full chain.",
  };
}

function formatMethodologyAppendix(archetype) {
  const m = archetype?.teachingMethodology;
  if (!m) return "";

  const lines = [
    "ARCHETYPE METHODOLOGY (4.2):",
    `Learning model: ${m.learningModel}`,
    "",
    "Mandatory teaching chain (use in Core Teaching → Worked Example → Exam Practice):",
    ...m.chain.map((label, i) => `${i + 1}. ${label}`),
    "",
    "Stage guidance:",
  ];

  for (const label of m.chain) {
    if (m.steps[label]) lines.push(`- ${label}: ${m.steps[label]}`);
  }

  if (m.blockPlacement) {
    lines.push("", "Block placement:", m.blockPlacement);
  }

  return lines.join("\n");
}

module.exports = {
  mathsMethodology,
  historyFrameworkMethodology,
  formatMethodologyAppendix,
};
