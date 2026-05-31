/**
 * Concept storytelling — hook question, analogy, explanation, worked example, misconception, exam link, mini retrieval.
 */

const { flattenPagesToBlocks, blockHaystackNormalized, normalizeHaystack } = require("./blockText");

const STORY_MARKERS = {
  hookQuestion: [/\?/, /think about/i, /why do/i, /what if/i, /right, let/i, /runner eats/i],
  analogy: [/think of/i, /like a/i, /economy/i, /imagine/i, /picture/i, /cell.*economy/i],
  misconception: [/mistake/i, /confus/i, /trap/i, /do not/i, /not just/i, /better:/i, /writing.*digestion/i],
  examLink: [/aqa/i, /in the exam/i, /mark/i, /full[- ]?mark/i, /think like an examiner/i, /earns marks/i],
  miniRetrieval: [/quick check/i, /explain why/i, /check:/i, /self-check/i, /q1 \(/i],
  linkForward: [/links to/i, /leads to/i, /builds on/i, /keep hold/i, /glucose.*atp/i, /→/],
};

const ARCHETYPE_ANALOGIES = {
  metabolism: "Think of metabolism as the cell's economy — some reactions release energy (catabolism), others spend it to build molecules (anabolism).",
  respiration: "Think of respiration as the cell's energy transfer system — not breathing, but breaking down glucose to reload ATP.",
  default: "Open with a memorable image or question before the definition — never start with 'X is defined as…' only.",
};

/**
 * @param {object} blueprint
 */
function buildConceptStorytellingPlan(blueprint = {}) {
  const archetype = blueprint.lessonArchetype || "default";
  const analogy =
    ARCHETYPE_ANALOGIES[archetype] || ARCHETYPE_ANALOGIES.default;

  return (blueprint.concepts || []).map((c, i) => ({
    conceptId: c.id,
    conceptName: c.name,
    storytellingBeat: {
      hookQuestion: `Hook question for ${c.name} (one line, pupil-facing)`,
      analogy: i === 0 ? analogy : `Short analogy linking ${c.name} to prior concept`,
      misconception: c.misconceptions?.[0] || "Name one common trap",
      examLink: "One AQA-credit phrase",
      miniRetrieval: "One explain-style check",
      linkForward:
        i < (blueprint.concepts || []).length - 1
          ? `Bridge to ${blueprint.concepts[i + 1]?.name}`
          : "Big-picture recap link",
    },
  }));
}

function buildConceptStorytellingPromptSection(blueprint = {}) {
  const plan = buildConceptStorytellingPlan(blueprint);
  const lines = [
    "CONCEPT STORYTELLING (every major concept — not isolated textbook facts):",
    "Teach each concept using: hook question → simple analogy → clear explanation → misconception warning → AQA exam link → mini retrieval.",
    "Avoid opening with 'X is defined as…' alone. Start with a memorable idea.",
    "Link concepts: 'This connects to…' / 'Keep hold of…' between ideas.",
    "",
    ARCHETYPE_ANALOGIES[blueprint.lessonArchetype] || ARCHETYPE_ANALOGIES.default,
  ];
  for (const row of plan.slice(0, 6)) {
    lines.push(`- ${row.conceptName}: ${row.storytellingBeat.hookQuestion}`);
  }
  return lines.join("\n");
}

/**
 * @param {object[]} pages
 */
function analyzeConceptStorytelling(pages) {
  const blocks = flattenPagesToBlocks(pages);
  let hits = 0;
  const fullText = normalizeHaystack(blocks.map((b) => blockHaystackNormalized(b)).join(" "));
  const gaps = [];

  for (const patterns of Object.values(STORY_MARKERS)) {
    if (patterns.some((re) => re.test(fullText))) hits++;
  }

  const textbookOnly =
    /is defined as/i.test(fullText) &&
    !STORY_MARKERS.analogy.some((re) => re.test(fullText));
  if (textbookOnly) gaps.push("Reads like textbook definitions — add analogies and hook questions");

  const storytellingScore = Math.min(
    100,
    Math.round((hits / Object.keys(STORY_MARKERS).length) * 100) - (textbookOnly ? 20 : 0)
  );

  if (storytellingScore < 60) gaps.push("Thin concept storytelling — add analogies and links between concepts");

  return {
    storytellingScore: Math.max(0, storytellingScore),
    beatsFound: hits,
    gaps,
  };
}

module.exports = {
  buildConceptStorytellingPlan,
  buildConceptStorytellingPromptSection,
  analyzeConceptStorytelling,
};
