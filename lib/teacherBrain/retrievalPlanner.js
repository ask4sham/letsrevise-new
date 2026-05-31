/**
 * Retrieval planner — when and what to retrieve across the lesson.
 */

/**
 * @param {{ topic: string, tier?: string }} input
 * @param {object[]} coreConcepts
 */
function planRetrieval(input = {}, coreConcepts = []) {
  const topic = String(input.topic || "").toLowerCase();
  const isMetabolism = /metabolism|catabolism|anabolism/i.test(topic);
  const conceptNames = coreConcepts.map((c) => c.name);

  if (!isMetabolism) {
    return [
      {
        phase: "immediate",
        timing: "After core rule / first teaching block",
        concepts: conceptNames.slice(0, 1),
        format: "Quick MCQ or single-word recall",
        purpose: "Secure the headline definition before moving on.",
      },
      {
        phase: "mid lesson",
        timing: "After diagram + first activity",
        concepts: conceptNames.slice(0, 2),
        format: "Explain in one sentence",
        purpose: "Spiral prior concept with new link.",
      },
      {
        phase: "end lesson",
        timing: "Before summary and exam practice",
        concepts: conceptNames,
        format: "Mixed checkpoint + exam-style stem",
        purpose: "Interleaved retrieval across all objectives.",
      },
    ];
  }

  return [
    {
      phase: "immediate",
      timing: "After Core Rule block — before long teaching",
      concepts: ["Metabolism"],
      format: "Multiple Choice",
      stemHint: "Metabolism is best defined as… (not digestion)",
      purpose: "Fix digestion misconception immediately.",
    },
    {
      phase: "immediate",
      timing: "After ATP introduced",
      concepts: ["ATP"],
      format: "Quick check — explain",
      stemHint: "Why do cells use ATP instead of glucose directly for every reaction?",
      purpose: "Establish energy currency idea early.",
    },
    {
      phase: "mid lesson",
      timing: "After catabolism + anabolism taught; before compare diagram",
      concepts: ["Catabolism", "Anabolism"],
      format: "Classification / drag-drop",
      stemHint: "Sort examples into catabolic or anabolic",
      purpose: "Discriminate pathways before exam compare.",
    },
    {
      phase: "mid lesson",
      timing: "After respiration link + diagram flow",
      concepts: ["ATP", "Respiration (energy transfer)"],
      format: "Sequencing",
      stemHint: "Order: glucose → respiration → ATP → protein synthesis",
      purpose: "Spiral chain retrieval (glucose → ATP → anabolism).",
    },
    {
      phase: "mid lesson",
      timing: "After deamination (HT)",
      concepts: ["Deamination and urea"],
      format: "Multiple Choice",
      stemHint: "Urea is produced because…",
      purpose: "Secure HT pathway without waiting until end.",
    },
    {
      phase: "end lesson",
      timing: "After synthesis; before keywords",
      concepts: ["Metabolism", "ATP", "Catabolism", "Anabolism", "Respiration (energy transfer)"],
      format: "Exam Practice + self-check",
      stemHint: "1/2/4 mark mixed + one compare question",
      purpose: "Full spiral — interleave all major concepts.",
    },
    {
      phase: "end lesson",
      timing: "Final memory rule block",
      concepts: ["Metabolism"],
      format: "Recall chain aloud",
      stemHint: "Say the chain: glucose → respiration → ATP → anabolic reactions → growth",
      purpose: "Big-picture coherence — memorable lesson close.",
    },
  ];
}

module.exports = {
  planRetrieval,
};
