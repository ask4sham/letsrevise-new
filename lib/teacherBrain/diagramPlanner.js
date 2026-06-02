/**
 * Diagram planner — briefs only (no diagram generation).
 */

const { resolveInteractiveDiagramTopicKind } = require("./interactiveDiagramTopicKind");
const { getInteractiveDiagramPlansForTopicKind } = require("./interactiveDiagramTopicSpecs");

/**
 * @param {{ topic: string, tier?: string }} input
 * @param {object[]} coreConcepts
 */
function planRequiredDiagrams(input = {}, coreConcepts = []) {
  const topic = String(input.topic || "").toLowerCase();
  const isMetabolism = /metabolism|catabolism|anabolism/i.test(topic);

  const diagramTopicKind = resolveInteractiveDiagramTopicKind({
    topic: input.topic,
    topicKey: input.topicKey,
    subTopic: input.subTopic,
  });
  if (!isMetabolism && diagramTopicKind !== "generic" && diagramTopicKind !== "metabolism") {
    const plans = getInteractiveDiagramPlansForTopicKind(diagramTopicKind, input);
    if (plans.length) return plans;
  }

  if (!isMetabolism) {
    return [
      {
        title: `${input.topic || "Topic"}: Core idea visual`,
        type: "Core Learning Summary",
        purpose: "Give pupils a visual anchor for the central process.",
        mustShow: ["Main structure or flow", "3–5 labelled parts", "One exam-linked annotation"],
        hotspots: ["Label A: key part", "Label B: process step", "Label C: outcome"],
        assessmentFocus: ["Describe the diagram", "Link structure to function"],
      },
    ];
  }

  return [
    {
      title: "Metabolism: The Cell's Economy",
      type: "Core Learning Summary",
      purpose:
        "Show catabolism and anabolism as opposite directions of metabolism with ATP as the shared currency.",
      mustShow: [
        "Catabolism arrow breaking down large molecule → smaller + energy released",
        "Anabolism arrow building large molecule ← smaller + ATP used",
        "ATP icon between both pathways",
        "Caption: 'Metabolism = all enzyme-controlled reactions'",
      ],
      hotspots: [
        "Catabolism — breaks down",
        "Anabolism — builds up",
        "ATP — energy transfer molecule",
        "Glucose → respiration link",
      ],
      assessmentFocus: [
        "Compare catabolism and anabolism",
        "Explain why ATP is needed for anabolic reactions",
      ],
    },
    {
      title: "Glucose → Respiration → ATP",
      type: "Process Flow",
      purpose: "Trace energy transfer from food molecule to usable ATP for cell work.",
      mustShow: [
        "Glucose entering respiration",
        "ATP produced/ regenerated (worded as energy transfer)",
        "ATP powering active transport or protein synthesis example",
      ],
      hotspots: ["Glucose", "Respiration", "ATP", "Cell process powered"],
      assessmentFocus: [
        "Explain why respiration is important in metabolism",
        "Describe energy transfer (not 'making energy')",
      ],
    },
    {
      title: "Deamination and Urea Formation",
      type: "Step-by-step Process",
      purpose: "HT: show excess protein metabolism and safe nitrogen excretion.",
      mustShow: [
        "Amino acid → ammonia (toxic)",
        "Liver converts to urea",
        "Urea excreted in urine",
      ],
      hotspots: ["Deamination", "Ammonia", "Urea", "Kidney excretion"],
      assessmentFocus: [
        "Explain why urea is produced",
        "Link to protein metabolism",
      ],
    },
    {
      title: "Catabolism vs Anabolism Compare",
      type: "Compare Panel",
      purpose: "Support compare/evaluate command words in exam practice.",
      mustShow: [
        "Side A: breaks down, releases energy via catabolic pathways",
        "Side B: builds up, requires ATP",
        "One shared example molecule (e.g. glucose or amino acid)",
      ],
      hotspots: ["Catabolism column", "Anabolism column", "ATP requirement"],
      assessmentFocus: ["Compare catabolism and anabolism (3–4 marks)"],
    },
  ];
}

module.exports = {
  planRequiredDiagrams,
};
