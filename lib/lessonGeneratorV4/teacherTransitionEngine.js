/**
 * Teacher transitions — short bridges between major sections (not extra long blocks).
 */

const { flattenPagesToBlocks, blockHaystack } = require("./blockText");

const TRANSITION_PATTERNS = [
  /keep hold of/i,
  /now we have seen/i,
  /now we have looked/i,
  /let's look at/i,
  /this is where many students lose marks/i,
  /before we go on/i,
  /we are going to use it again/i,
  /next, we/i,
];

const TRANSITION_EXAMPLES = [
  "Keep hold of the idea of ATP — we are going to use it again when we look at protein synthesis.",
  "Now we have seen how energy is released, let's look at how cells spend that energy.",
  "This is where many students lose marks: they describe the process but forget to explain why it matters.",
];

/**
 * @param {object} blueprint
 */
function buildTeacherTransitionPromptSection(blueprint = {}) {
  return [
    "TEACHER TRANSITIONS (short — 1–2 sentences between major concepts, inside existing blocks):",
    ...TRANSITION_EXAMPLES.map((e) => `- "${e}"`),
    `Use ${Math.min(4, (blueprint.concepts || []).length || 3)} transitions across the lesson.`,
    "Do NOT add separate long transition-only blocks.",
  ].join("\n");
}

/**
 * @param {object[]} pages
 */
function analyzeTeacherTransitions(pages) {
  const blocks = flattenPagesToBlocks(pages);
  let count = 0;
  blocks.forEach((block) => {
    const hay = blockHaystack(block);
    if (TRANSITION_PATTERNS.some((re) => re.test(hay))) count++;
  });
  const gaps = [];
  if (count < 2) gaps.push("Few teacher transitions between sections");
  const transitionScore = Math.min(100, count * 28);

  return { transitionCount: count, transitionScore, gaps };
}

module.exports = {
  buildTeacherTransitionPromptSection,
  analyzeTeacherTransitions,
  TRANSITION_EXAMPLES,
};
