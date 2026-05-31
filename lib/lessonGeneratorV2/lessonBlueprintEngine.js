/**
 * Lesson Blueprint Engine — orchestrates V2 planning before block generation.
 */

const { buildLessonKnowledgeGraph } = require("./lessonKnowledgeGraph");
const { getLessonLengthBudget, estimateLessonMinutes } = require("./lessonLengthBudget");
const { buildLearningJourney, validateTeachTestRhythm } = require("./learningJourneyPlanner");
const { buildConceptChunks, validateChunkingRules } = require("./lessonChunkingRules");
const { planActivityPlacement } = require("./activityPlacementEngine");
const { buildRetrievalPlan } = require("./retrievalPlanner");
const { buildMasteryProgressPlan } = require("./masteryProgressPlan");

/**
 * @param {{
 *   topic: string,
 *   subject?: string,
 *   examBoard?: string,
 *   tier?: string,
 *   topicKey?: string,
 *   durationTier?: string,
 * }} input
 */
function buildLessonBlueprint(input = {}) {
  const topic = String(input.topic || "").trim();
  const examBoard = String(input.examBoard || input.board || "AQA").trim();
  const tier = String(input.tier || "higher").trim();
  const durationTier = input.durationTier || "standard";

  const graph = buildLessonKnowledgeGraph({
    topic,
    topicKey: input.topicKey,
    subject: input.subject,
  });

  const budget = getLessonLengthBudget(durationTier);
  let learningJourney = buildLearningJourney(graph.concepts, budget);
  const rhythm = validateTeachTestRhythm(learningJourney);

  const placed = planActivityPlacement(learningJourney, graph.archetype);
  learningJourney = placed.journey;

  const conceptChunks = buildConceptChunks(graph.concepts, budget);
  const retrievalPlan = buildRetrievalPlan(graph.concepts, learningJourney);
  const masteryPlan = buildMasteryProgressPlan(graph.concepts, learningJourney);
  const chunkValidation = validateChunkingRules(learningJourney, graph.concepts);

  const blueprint = {
    version: 2,
    topic,
    examBoard,
    tier,
    lessonArchetype: graph.archetype,
    lessonArchetypeLabel: graph.archetypeLabel,
    estimatedDuration: {
      tier: durationTier,
      label: budget.label,
      minutes: estimateLessonMinutes(budget),
      range: budget.minutes,
    },
    concepts: graph.concepts,
    conceptChunks,
    learningJourney,
    retrievalPlan,
    activityPlan: placed.activityPlan,
    examPracticePlan: learningJourney.filter((s) => s.phase === "exam" || s.blockType === "exam-practice"),
    masteryPlan,
    validation: {
      teachTestRhythm: rhythm,
      chunking: chunkValidation,
    },
    blueprintSourceOfTruth: true,
    generatedAt: new Date().toISOString(),
  };

  return blueprint;
}

module.exports = {
  buildLessonBlueprint,
};
