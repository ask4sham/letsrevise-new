/**
 * Teaching journey engine — narrative arc (hook → bridge → progression → recap).
 */

const { blockHaystackNormalized, wordCount } = require("./blockText");

const LINKING_PHRASES = [
  "this links",
  "connects to",
  "builds on",
  "keep hold",
  "big picture",
  "in the exam",
  "why this matters",
  "why we",
  "how this",
  "leads to",
];

const WHY_PHRASES = ["why", "matters", "important", "need to know", "examiners"];

/**
 * Planned teaching journey (for prompts / metadata).
 * @param {object} blueprint
 */
function buildTeachingJourneyPlan(blueprint = {}) {
  const concepts = (blueprint.concepts || []).map((c) => c.name);
  return {
    hook: {
      purpose: "WHY are we learning this?",
      prompt: "Open with a concrete scenario that makes the topic feel urgent and exam-relevant.",
    },
    priorKnowledgeBridge: {
      purpose: "Bridge from what students already know",
      prompt: "Activate prior knowledge and name one misconception to fix early.",
    },
    coreProgression: concepts.map((name, i) => ({
      order: i + 1,
      concept: name,
      mustAnswer: ["WHAT it is", "HOW it works", "WHY it matters for GCSE"],
      linkForward: i < concepts.length - 1 ? `Connect ${name} to ${concepts[i + 1]}` : null,
    })),
    conceptLinking: {
      purpose: "Explicit links between ideas",
      phrases: ["This links directly to…", "Keep hold of that idea because…"],
    },
    bigPicture: {
      purpose: "HOW does this connect to the wider topic?",
      prompt: "One short paragraph tying all concepts to the unit big picture.",
    },
    lessonRecap: {
      purpose: "Consolidate without repeating blocks verbatim",
      prompt: "Recap as a teacher would end the lesson — chains, not bullet lists only.",
    },
  };
}

/**
 * @param {object[]} pages
 */
function analyzeTeachingJourney(pages) {
  const blocks = require("./blockText").flattenPagesToBlocks(pages);
  const sections = {
    hook: false,
    priorBridge: false,
    coreProgression: 0,
    linkingPhrases: 0,
    bigPicture: false,
    recap: false,
    whyAnswers: 0,
  };
  const gaps = [];

  blocks.forEach((block, index) => {
    const hay = blockHaystackNormalized(block);
    const role = String(block.role || "").toLowerCase();

    if (role === "hook" || hay.includes("right, let") || hay.includes("scenario") || hay.includes("runner eats")) {
      sections.hook = true;
    }
    if (
      role === "priorknowledge" ||
      role === "lessonobjectives" ||
      hay.includes("prior knowledge") ||
      hay.includes("before we")
    ) {
      sections.priorBridge = true;
    }
    if (role === "concept" || hay.includes("core learning") || hay.includes("central idea")) {
      sections.coreProgression++;
      if (hasWhyHowWhat(hay)) sections.whyAnswers++;
    }
    if (role === "summary" || hay.includes("in short") || hay.includes("recap") || hay.includes("<h2><strong>summary")) {
      sections.recap = true;
    }
    if (hay.includes("big picture") || hay.includes("overall") && hay.includes("metabolism")) {
      sections.bigPicture = true;
    }
    for (const p of LINKING_PHRASES) {
      if (hay.includes(p)) sections.linkingPhrases++;
    }
    for (const p of WHY_PHRASES) {
      if (hay.includes(p) && wordCount(hay) > 40) sections.whyAnswers++;
    }
  });

  if (!sections.hook) gaps.push("Missing strong hook (WHY learn this?)");
  if (!sections.priorBridge) gaps.push("Missing prior knowledge bridge");
  if (sections.coreProgression < 2) gaps.push("Thin core learning progression");
  if (sections.linkingPhrases < 2) gaps.push("Few explicit concept links between sections");
  if (!sections.recap) gaps.push("Missing lesson recap / summary");
  if (!sections.bigPicture) gaps.push("Missing big-picture connection");

  const score = Math.min(
    100,
    Math.round(
      (sections.hook ? 18 : 0) +
        (sections.priorBridge ? 15 : 0) +
        Math.min(sections.coreProgression * 8, 24) +
        Math.min(sections.linkingPhrases * 5, 20) +
        (sections.recap ? 12 : 0) +
        (sections.bigPicture ? 11 : 0)
    )
  );

  return {
    sections,
    gaps,
    teachingFlowScore: score,
    coherent: gaps.length <= 2,
  };
}

function hasWhyHowWhat(hay) {
  const hasWhat = hay.includes(" is ") || hay.includes(" means ") || hay.includes("definition");
  const hasHow = hay.includes("how") || hay.includes("process") || hay.includes("→");
  const hasWhy = hay.includes("why") || hay.includes("matter") || hay.includes("exam");
  return [hasWhat, hasHow, hasWhy].filter(Boolean).length >= 2;
}

module.exports = {
  buildTeachingJourneyPlan,
  analyzeTeachingJourney,
};
