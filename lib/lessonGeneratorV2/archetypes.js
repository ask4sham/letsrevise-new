/**
 * Lesson archetypes and canonical concept graphs for V2 planning.
 * Topic classification is deterministic (topic string / topicKey heuristics).
 */

/** @typedef {'quick'|'standard'|'deep'|'exam'} LessonDurationTier */

/**
 * @typedef {object} ConceptNode
 * @property {string} id
 * @property {string} name
 * @property {'critical'|'high'|'medium'} importance
 * @property {string[]} prerequisiteKnowledge
 * @property {string[]} misconceptions
 * @property {string[]} examLinks
 * @property {string} bestTeachingMode
 * @property {string} bestActivityType
 * @property {number} retrievalFrequency
 */

const ARCHETYPE_IDS = [
  "metabolism",
  "uses_of_glucose",
  "limiting_factors",
  "respiration",
  "plant_defences",
  "general_gcse_biology",
];

/** @type {Record<string, { label: string, concepts: ConceptNode[] }>} */
const ARCHETYPE_GRAPHS = {
  metabolism: {
    label: "Metabolism",
    concepts: [
      concept("metabolism", "Metabolism", "critical", [], ["metabolism is only respiration"], ["B1"], "text-concept", "drag-drop-match", 2),
      concept("catabolism", "Catabolism", "high", ["metabolism"], ["catabolism builds molecules"], ["B1"], "text-concept", "classification", 2),
      concept("anabolism", "Anabolism", "high", ["metabolism"], ["anabolism always releases energy"], ["B1"], "text-concept", "classification", 2),
      concept("atp", "ATP", "critical", ["metabolism", "respiration"], ["ATP is energy itself not a carrier"], ["B1"], "keyIdea", "checkpoint", 3),
      concept("respiration_link", "Respiration link", "high", ["atp"], ["respiration only in mitochondria always"], ["B1"], "text-concept", "checkpoint", 2),
      concept("proteins_lipids", "Proteins and lipids", "medium", ["anabolism"], [], ["B1"], "text-concept", "drag-drop-match", 1),
      concept("deamination_urea", "Deamination and urea", "high", ["proteins_lipids"], ["urea is useful nutrient"], ["B1"], "text-concept", "exam-practice", 2),
    ],
  },
  uses_of_glucose: {
    label: "Uses of glucose",
    concepts: [
      concept("respiration", "Respiration", "critical", [], [], ["B1"], "text-concept", "checkpoint", 2),
      concept("starch_storage", "Starch storage", "high", ["respiration"], ["starch is soluble"], ["B1"], "text-concept", "drag-drop-match", 2),
      concept("cellulose", "Cellulose", "medium", ["starch_storage"], [], ["B1"], "text-concept", "checkpoint", 1),
      concept("lipids", "Lipids", "medium", [], [], ["B1"], "text-concept", "checkpoint", 1),
      concept("amino_acids_proteins", "Amino acids and proteins", "high", [], ["proteins store glucose"], ["B1"], "text-concept", "checkpoint", 2),
      concept("nitrate_ions", "Nitrate ions", "high", ["amino_acids_proteins"], ["plants absorb protein from soil"], ["B1"], "text-concept", "exam-practice", 2),
    ],
  },
  limiting_factors: {
    label: "Limiting factors",
    concepts: [
      concept("light_intensity", "Light intensity", "critical", [], ["more light always unlimited growth"], ["B2"], "text-concept", "graph", 2),
      concept("co2_concentration", "Carbon dioxide concentration", "high", [], [], ["B2"], "text-concept", "graph", 2),
      concept("temperature", "Temperature", "high", [], ["high temp always increases rate forever"], ["B2"], "text-concept", "checkpoint", 2),
      concept("limiting_factor", "Limiting factor", "critical", ["light_intensity", "co2_concentration", "temperature"], ["all factors limit at once"], ["B2"], "keyIdea", "checkpoint", 3),
      concept("plateau", "Plateau on graph", "high", ["limiting_factor"], ["line always linear"], ["B2"], "examTip", "graph", 2),
      concept("graph_interpretation", "Graph interpretation", "critical", ["plateau"], [], ["B2"], "worked-example", "exam-practice", 2),
      concept("practical_data", "Practical data", "medium", ["graph_interpretation"], [], ["B2"], "text-concept", "checkpoint", 1),
    ],
  },
  respiration: {
    label: "Respiration",
    concepts: [
      concept("aerobic_respiration", "Aerobic respiration", "critical", [], ["respiration is breathing"], ["B1"], "text-concept", "interactive-sequence", 2),
      concept("anaerobic_respiration", "Anaerobic respiration", "critical", ["aerobic_respiration"], ["anaerobic uses oxygen"], ["B1"], "text-concept", "checkpoint", 3),
      concept("oxygen_debt", "Oxygen debt", "high", ["anaerobic_respiration"], ["lactic acid never removed"], ["B1"], "text-concept", "checkpoint", 2),
      concept("atp_release", "ATP release", "critical", ["aerobic_respiration"], [], ["B1"], "keyIdea", "text-to-image", 2),
      concept("fermentation", "Fermentation", "medium", ["anaerobic_respiration"], [], ["B1"], "text-concept", "checkpoint", 1),
      concept("visual_retrieval", "Process sequence", "high", ["aerobic_respiration", "anaerobic_respiration"], [], ["B1"], "interactive-sequence", "drag-drop-match", 1),
    ],
  },
  plant_defences: {
    label: "Plant defences",
    concepts: [
      concept("physical_defence", "Physical defences", "high", [], [], ["B1"], "text-concept", "hotspot", 2),
      concept("chemical_defence", "Chemical defences", "high", [], [], ["B1"], "text-concept", "checkpoint", 2),
      concept("mechanical_defence", "Mechanical defences", "high", [], [], ["B1"], "text-concept", "classification", 2),
      concept("defence_types", "Types of plant defence", "critical", ["physical_defence", "chemical_defence", "mechanical_defence"], ["all plants use same defence"], ["B1"], "keyIdea", "drag-drop-match", 2),
      concept("misconception_check", "Defence misconceptions", "medium", ["defence_types"], ["thorns are chemical"], ["B1"], "commonMistake", "checkpoint", 2),
    ],
  },
  general_gcse_biology: {
    label: "General GCSE Biology",
    concepts: [
      concept("core_idea_1", "Core idea 1", "high", [], [], [], "text-concept", "checkpoint", 2),
      concept("core_idea_2", "Core idea 2", "high", [], [], [], "text-concept", "checkpoint", 2),
      concept("application", "Application", "medium", ["core_idea_1"], [], [], "text-concept", "drag-drop-match", 1),
      concept("exam_technique", "Exam technique", "medium", [], [], [], "examTip", "exam-practice", 1),
    ],
  },
};

function concept(id, name, importance, prerequisiteKnowledge, misconceptions, examLinks, bestTeachingMode, bestActivityType, retrievalFrequency) {
  return {
    id,
    name,
    importance,
    prerequisiteKnowledge,
    misconceptions,
    examLinks,
    bestTeachingMode,
    bestActivityType,
    retrievalFrequency,
  };
}

const TOPIC_PATTERNS = [
  { archetype: "metabolism", patterns: [/metabolism/i, /catabolism/i, /anabolism/i, /deamination/i] },
  { archetype: "uses_of_glucose", patterns: [/uses of glucose/i, /glucose uses/i, /fate of glucose/i, /starch.*insolub/i] },
  { archetype: "limiting_factors", patterns: [/limiting factor/i, /photosynthesis.*rate/i, /light intensity/i] },
  { archetype: "respiration", patterns: [/respiration/i, /aerobic/i, /anaerobic/i, /oxygen debt/i, /lactic acid/i] },
  { archetype: "plant_defences", patterns: [/plant defen/i, /defences in plants/i, /physical.*chemical.*defen/i] },
];

/**
 * @param {{ topic?: string, topicKey?: string, subject?: string }} input
 * @returns {string}
 */
function classifyLessonArchetype(input = {}) {
  const topic = String(input.topic || input.topicKey || "").trim();
  const hay = topic.toLowerCase();
  for (const row of TOPIC_PATTERNS) {
    if (row.patterns.some((re) => re.test(topic))) return row.archetype;
  }
  if (/biology/i.test(String(input.subject || ""))) return "general_gcse_biology";
  return "general_gcse_biology";
}

/**
 * @param {string} archetype
 * @returns {ConceptNode[]}
 */
function getConceptsForArchetype(archetype) {
  const graph = ARCHETYPE_GRAPHS[archetype] || ARCHETYPE_GRAPHS.general_gcse_biology;
  return graph.concepts.slice();
}

function getArchetypeLabel(archetype) {
  return (ARCHETYPE_GRAPHS[archetype] || ARCHETYPE_GRAPHS.general_gcse_biology).label;
}

module.exports = {
  ARCHETYPE_IDS,
  ARCHETYPE_GRAPHS,
  classifyLessonArchetype,
  getConceptsForArchetype,
  getArchetypeLabel,
};
