/**
 * Activity planner — recommend activity types only (no block generation).
 */

const ACTIVITY_TYPES = {
  DIAGRAM_DRAG_DROP: "Diagram Drag & Drop",
  LABEL_DIAGRAM: "Label Diagram",
  SEQUENCING: "Sequencing",
  MULTIPLE_CHOICE: "Multiple Choice",
  EXAM_PRACTICE: "Exam Practice",
  WORKED_EXAMPLE: "Worked Example",
  CLASSIFICATION: "Classification / Sorting",
  HOTSPOT: "Interactive Hotspot",
};

/**
 * @param {{ topic: string, tier?: string }} input
 * @param {object[]} coreConcepts
 */
function planActivityRecommendations(input = {}, coreConcepts = []) {
  const topic = String(input.topic || "").toLowerCase();
  const isMetabolism = /metabolism|catabolism|anabolism/i.test(topic);

  if (!isMetabolism) {
    return [
      {
        activityType: ACTIVITY_TYPES.MULTIPLE_CHOICE,
        afterConcept: coreConcepts[0]?.id || "core",
        cognitiveLevel: "recall",
        rationale: "Check core definition before deeper teaching.",
      },
      {
        activityType: ACTIVITY_TYPES.EXAM_PRACTICE,
        afterConcept: "end",
        cognitiveLevel: "application",
        rationale: "Apply ideas in exam-style stems.",
      },
    ];
  }

  return [
    {
      activityType: ACTIVITY_TYPES.MULTIPLE_CHOICE,
      afterConcept: "metabolism",
      cognitiveLevel: "recall",
      rationale: "Establish metabolism ≠ digestion before diagrams.",
    },
    {
      activityType: ACTIVITY_TYPES.CLASSIFICATION,
      afterConcept: "catabolism",
      cognitiveLevel: "understanding",
      rationale: "Sort processes/examples into catabolic vs anabolic.",
    },
    {
      activityType: ACTIVITY_TYPES.LABEL_DIAGRAM,
      afterConcept: "atp",
      cognitiveLevel: "understanding",
      rationale: "Label ATP pathway on 'Cell's Economy' diagram.",
    },
    {
      activityType: ACTIVITY_TYPES.DIAGRAM_DRAG_DROP,
      afterConcept: "respiration_link",
      cognitiveLevel: "application",
      rationale: "Match glucose / respiration / ATP / cell process labels.",
    },
    {
      activityType: ACTIVITY_TYPES.SEQUENCING,
      afterConcept: "deamination_urea",
      cognitiveLevel: "application",
      rationale: "Order deamination → urea → excretion steps (HT).",
    },
    {
      activityType: ACTIVITY_TYPES.HOTSPOT,
      afterConcept: "anabolism",
      cognitiveLevel: "understanding",
      rationale: "Hotspot compare panel — catabolism vs anabolism.",
    },
    {
      activityType: ACTIVITY_TYPES.WORKED_EXAMPLE,
      afterConcept: "respiration_link",
      cognitiveLevel: "exam thinking",
      rationale: "Stepped 3-mark explain: respiration in metabolism.",
    },
    {
      activityType: ACTIVITY_TYPES.EXAM_PRACTICE,
      afterConcept: "end",
      cognitiveLevel: "exam thinking",
      rationale: "Tiered 1–6 mark questions across lesson objectives.",
    },
  ];
}

module.exports = {
  ACTIVITY_TYPES,
  planActivityRecommendations,
};
