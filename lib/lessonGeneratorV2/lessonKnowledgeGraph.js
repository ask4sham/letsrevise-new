/**
 * Knowledge graph stage — 4–7 key concepts per lesson archetype.
 */

const {
  classifyLessonArchetype,
  getConceptsForArchetype,
  getArchetypeLabel,
} = require("./archetypes");

/**
 * @param {{ topic?: string, topicKey?: string, subject?: string, examBoard?: string, tier?: string }} input
 * @returns {{ archetype: string, archetypeLabel: string, concepts: import('./archetypes').ConceptNode[] }}
 */
function buildLessonKnowledgeGraph(input = {}) {
  const archetype = classifyLessonArchetype(input);
  let concepts = getConceptsForArchetype(archetype);

  if (concepts.length > 7) {
    concepts = concepts
      .slice()
      .sort((a, b) => importanceRank(b.importance) - importanceRank(a.importance))
      .slice(0, 7);
  }
  if (concepts.length < 4 && archetype !== "general_gcse_biology") {
    concepts = getConceptsForArchetype("general_gcse_biology").slice(0, 4);
  }

  return {
    archetype,
    archetypeLabel: getArchetypeLabel(archetype),
    concepts,
  };
}

function importanceRank(importance) {
  if (importance === "critical") return 3;
  if (importance === "high") return 2;
  return 1;
}

module.exports = {
  buildLessonKnowledgeGraph,
};
