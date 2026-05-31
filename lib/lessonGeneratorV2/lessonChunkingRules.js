/**
 * Chunking rules for V2 lessons — word limits, retrieval spacing, panel fatigue.
 */

const { TEACH_TYPES, CHECK_TYPES } = require("./learningJourneyPlanner");

const RULES = {
  maxWordsPerTeachingChunk: { min: 250, max: 350 },
  maxConsecutiveTeachBlocks: 2,
  minTestsPerConcept: 1,
  minTestsForImportantConcept: 2,
  maxConsecutiveBorderedTextPanels: 2,
  avoidQuizAtEndOnly: true,
};

/**
 * Split dense teaching into concept chunks (metadata for generation prompts).
 * @param {import('./archetypes').ConceptNode[]} concepts
 * @param {ReturnType<import('./lessonLengthBudget').getLessonLengthBudget>} budget
 */
function buildConceptChunks(concepts, budget) {
  const maxWords = budget.slots.maxWordsPerTeachChunk || RULES.maxWordsPerTeachingChunk.max;
  return concepts.map((c) => ({
    conceptId: c.id,
    conceptName: c.name,
    targetWords: maxWords,
    maxBlocks: 2,
    mustEndWith: "checkpoint",
  }));
}

/**
 * @param {object[]} journey
 * @param {import('./archetypes').ConceptNode[]} concepts
 * @returns {{ valid: boolean, violations: string[], underTested: string[] }}
 */
function validateChunkingRules(journey, concepts) {
  const violations = [];
  const underTested = [];

  let consecutiveTeach = 0;
  let consecutiveTextPanels = 0;
  let checkCountByConcept = Object.create(null);
  let lastWasCheck = false;
  let checksInLastThird = 0;
  const checkTotal = journey.filter((s) => s.role === "check" || CHECK_TYPES.has(s.blockType)).length;
  const thirdStart = Math.floor((journey.length * 2) / 3);

  journey.forEach((step, idx) => {
    if (step.role === "teach") {
      consecutiveTeach++;
      if (consecutiveTeach > RULES.maxConsecutiveTeachBlocks) {
        violations.push(`Rule: max ${RULES.maxConsecutiveTeachBlocks} teach blocks before retrieval (order ${step.order})`);
      }
      if (TEACH_TYPES.has(step.blockType)) {
        consecutiveTextPanels++;
        if (consecutiveTextPanels > RULES.maxConsecutiveBorderedTextPanels) {
          violations.push(`Rule: avoid 3+ long text panels in a row (order ${step.order})`);
        }
      }
    } else {
      consecutiveTeach = 0;
      consecutiveTextPanels = 0;
    }

    const countsAsRetrieval =
      step.role === "check" ||
      CHECK_TYPES.has(step.blockType) ||
      (step.role === "activity" && (step.blockType === "checkpoint" || step.blockType === "exam-practice"));
    if (countsAsRetrieval) {
      if (step.conceptId) {
        checkCountByConcept[step.conceptId] = (checkCountByConcept[step.conceptId] || 0) + 1;
      }
      if (idx >= thirdStart) checksInLastThird++;
      lastWasCheck = true;
    } else {
      lastWasCheck = false;
    }
  });

  for (const c of concepts) {
    const count = checkCountByConcept[c.id] || 0;
    const required = c.importance === "critical" || c.importance === "high" ? RULES.minTestsForImportantConcept : RULES.minTestsPerConcept;
    if (count < required) {
      underTested.push(c.id);
      violations.push(`Concept "${c.name}" under-tested (${count}/${required} checks)`);
    }
  }

  if (RULES.avoidQuizAtEndOnly && checkTotal > 2 && checksInLastThird >= checkTotal - 1) {
    violations.push("Rule: do not place all quizzes/checkpoints at end of lesson");
  }

  return {
    valid: violations.length === 0,
    violations,
    underTested,
  };
}

module.exports = {
  RULES,
  buildConceptChunks,
  validateChunkingRules,
};
