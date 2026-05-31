/**
 * Exam planner — mark-band targets an outstanding teacher would set.
 */

/**
 * @param {{ topic: string, examBoard?: string, tier?: string }} input
 * @param {object[]} coreConcepts
 */
function planExamTargets(input = {}, coreConcepts = []) {
  const topic = String(input.topic || "").toLowerCase();
  const board = String(input.examBoard || "AQA").toUpperCase();
  const isMetabolism = /metabolism|catabolism|anabolism/i.test(topic);
  const isHigher = String(input.tier || "").toLowerCase().includes("higher");

  if (!isMetabolism) {
    return buildGenericExamTargets(input.topic, board, isHigher);
  }

  return [
    {
      markFocus: "1 mark",
      commandWord: "state / give / name",
      focus: "Define metabolism or name ATP as energy transfer molecule.",
      aqaWording: "enzyme-controlled reactions; ATP stores/releases energy for reactions",
      exampleStem: "What is meant by metabolism?",
    },
    {
      markFocus: "2 mark",
      commandWord: "describe",
      focus: "Describe catabolism OR anabolism with one linked consequence.",
      aqaWording: "breaks down / builds up + enzyme-controlled",
      exampleStem: "Describe what happens in catabolic reactions in cells.",
    },
    {
      markFocus: "4 mark",
      commandWord: "explain",
      focus: "Explain respiration's role in metabolism — glucose to ATP to cell use.",
      aqaWording: "transfers energy from glucose to ATP; ATP used for metabolic reactions",
      exampleStem: "Explain why respiration is important in metabolism.",
    },
    {
      markFocus: "6 mark",
      commandWord: "compare / explain (extended)",
      focus: "Compare catabolism and anabolism with ATP linking both pathways.",
      aqaWording: "both are metabolism; opposite direction; ATP links",
      exampleStem: "Compare catabolism and anabolism in terms of molecules and energy.",
    },
    {
      markFocus: "Grade 9 challenge",
      commandWord: isHigher ? "evaluate / suggest" : "explain (stretch)",
      focus: isHigher
        ? "Deamination pathway: why urea excretion is essential; link to protein metabolism."
        : "Apply metabolism to a growing cell needing protein and energy.",
      aqaWording: isHigher
        ? "deamination; toxic ammonia; urea excretion"
        : "anabolism needs ATP from respiration",
      exampleStem: isHigher
        ? "Evaluate why the liver converts ammonia to urea after deamination."
        : "Suggest why a growing plant cell needs both respiration and anabolic reactions.",
    },
  ];
}

function buildGenericExamTargets(topic, board, isHigher) {
  return [
    {
      markFocus: "1 mark",
      commandWord: "state",
      focus: `Key definition for ${topic}`,
      aqaWording: `${board} precise term`,
      exampleStem: `State one fact about ${topic}.`,
    },
    {
      markFocus: "2 mark",
      commandWord: "describe",
      focus: "Process or structure description",
      aqaWording: "cause → effect",
      exampleStem: `Describe ${topic}.`,
    },
    {
      markFocus: "4 mark",
      commandWord: "explain",
      focus: "Linked mechanism and outcome",
      aqaWording: "because / therefore",
      exampleStem: `Explain ${topic}.`,
    },
    {
      markFocus: "6 mark",
      commandWord: "compare / explain",
      focus: "Multiple ideas synthesised",
      aqaWording: "compare with named differences",
      exampleStem: `Explain two aspects of ${topic}.`,
    },
    {
      markFocus: "Grade 9 challenge",
      commandWord: isHigher ? "evaluate" : "apply",
      focus: "Stretch application or data judgement",
      aqaWording: "balanced conclusion",
      exampleStem: `Evaluate an application of ${topic}.`,
    },
  ];
}

module.exports = {
  planExamTargets,
};
