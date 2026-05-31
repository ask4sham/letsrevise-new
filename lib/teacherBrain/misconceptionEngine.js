/**
 * Misconception engine — what pupils get wrong before teaching starts.
 */

const MISCONCEPTION_LIBRARY = {
  metabolism: [
    {
      conceptId: "metabolism",
      misconception: "Metabolism is the same as digestion.",
      correction: "Metabolism is all enzyme-controlled reactions in cells; digestion is only the first breakdown in the gut.",
      examImpact: "Loses definition marks — must say 'all reactions in cells'.",
    },
    {
      conceptId: "atp",
      misconception: "ATP is energy itself / cells make energy.",
      correction: "Energy is transferred to ATP; ATP is a store/carrier used in reactions.",
      examImpact: "Say 'transfers energy to ATP' not 'produces energy'.",
    },
    {
      conceptId: "catabolism",
      misconception: "Catabolism builds molecules.",
      correction: "Catabolism breaks molecules down; anabolism builds up.",
      examImpact: "Common 2-mark compare error.",
    },
    {
      conceptId: "anabolism",
      misconception: "Anabolism releases energy like respiration.",
      correction: "Anabolism uses ATP; catabolism (e.g. respiration) replenishes ATP.",
      examImpact: "Must link anabolism to energy input.",
    },
    {
      conceptId: "respiration_link",
      misconception: "Respiration is breathing.",
      correction: "Cellular respiration is chemical energy transfer in cells.",
      examImpact: "Zero marks if only breathing described.",
    },
    {
      conceptId: "deamination_urea",
      misconception: "Urea is a useful nutrient stored in the body.",
      correction: "Urea is a toxic waste product excreted in urine.",
      examImpact: "HT: must link deamination → ammonia → urea → excretion.",
    },
  ],
};

/**
 * @param {{ topic: string }} input
 * @param {object[]} coreConcepts
 */
function planMisconceptions(input = {}, coreConcepts = []) {
  const topic = String(input.topic || "").toLowerCase();
  let items = [];

  if (/metabolism|catabolism|anabolism|deamination/i.test(topic)) {
    items = [...MISCONCEPTION_LIBRARY.metabolism];
  } else {
    items = coreConcepts.slice(0, 3).map((c) => ({
      conceptId: c.id,
      misconception: `Students confuse the definition of ${c.name}.`,
      correction: `Use precise AQA wording: ${c.aqaExamPhrase || c.summary}.`,
      examImpact: "Vague definitions lose AO1 marks.",
    }));
  }

  return items.map((m) => ({
    ...m,
    whenToAddress: m.conceptId === "metabolism" ? "hook or prior knowledge" : "during core teaching",
    priority: m.conceptId === "atp" || m.conceptId === "metabolism" ? "high" : "medium",
  }));
}

module.exports = {
  planMisconceptions,
};
