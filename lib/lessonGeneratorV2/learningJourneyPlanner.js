/**
 * Learning journey planner — teach→test rhythm (max 2 teaching blocks before interaction).
 */

const TEACH_TYPES = new Set([
  "text",
  "text-concept",
  "keyIdea",
  "commonMistake",
  "examTip",
  "worked-example",
  "hook",
  "objectives",
  "prior-knowledge",
]);

const CHECK_TYPES = new Set(["checkpoint", "self-check-question"]);

const ACTIVITY_TYPES = new Set([
  "diagram",
  "interactive-diagram",
  "interactiveSequence",
  "dragDropMatch",
  "graph",
  "hotspot",
]);

/**
 * @param {import('./archetypes').ConceptNode} concept
 * @param {'teach'|'check'|'activity'} role
 * @param {number} order
 */
function journeyStep(concept, role, order, extra = {}) {
  const blockType =
    role === "teach"
      ? concept.bestTeachingMode || "text-concept"
      : role === "check"
        ? "checkpoint"
        : concept.bestActivityType || "drag-drop-match";
  return {
    order,
    phase: extra.phase || role,
    role,
    conceptId: concept.id,
    conceptName: concept.name,
    blockType,
    cognitiveDemand: extra.cognitiveDemand || defaultDemand(role),
    rationale: extra.rationale || `${role} for ${concept.name}`,
  };
}

function defaultDemand(role) {
  if (role === "teach") return "explain";
  if (role === "check") return "identify";
  return "apply";
}

/**
 * @param {import('./archetypes').ConceptNode[]} concepts
 * @param {ReturnType<import('./lessonLengthBudget').getLessonLengthBudget>} budget
 * @returns {object[]}
 */
function buildLearningJourney(concepts, budget) {
  const steps = [];
  let order = 0;

  steps.push({
    order: order++,
    phase: "foundation",
    role: "foundation",
    conceptId: null,
    conceptName: "Lesson setup",
    blockType: "objectives",
    cognitiveDemand: "define",
    rationale: "Objectives and prior knowledge before core teaching",
  });
  steps.push({
    order: order++,
    phase: "foundation",
    role: "foundation",
    conceptId: null,
    conceptName: "Prior knowledge",
    blockType: "prior-knowledge",
    cognitiveDemand: "identify",
    rationale: "Activate prior knowledge",
  });

  const teachSlots = Math.min(budget.slots.teach, concepts.length);
  const conceptsToTeach =
    budget.tier === "quick" ? concepts.slice(0, teachSlots) : concepts;

  conceptsToTeach.forEach((concept, i) => {
    steps.push(journeyStep(concept, "teach", order++, { phase: "teach" }));
    steps.push(
      journeyStep(concept, "check", order++, {
        phase: "retrieval",
        cognitiveDemand: i === 0 ? "identify" : "explain",
      })
    );
    if ((i + 1) % 2 === 0 && budget.slots.activity > 0) {
      steps.push(
        journeyStep(concept, "activity", order++, {
          phase: "application",
          rationale: `Visual/application after ${concept.name}`,
        })
      );
    }
  });

  if (budget.slots.examPractice > 0) {
    steps.push({
      order: order++,
      phase: "exam",
      role: "exam",
      conceptId: null,
      conceptName: "Exam technique",
      blockType: "examTip",
      cognitiveDemand: "evaluate",
      rationale: "Exam technique before practice",
    });
    steps.push({
      order: order++,
      phase: "exam",
      role: "exam",
      conceptId: concepts[0]?.id || null,
      conceptName: "Exam practice",
      blockType: "exam-practice",
      cognitiveDemand: "apply",
      rationale: "Exam-style application",
    });
  }

  steps.push({
    order: order++,
    phase: "summary",
    role: "summary",
    conceptId: null,
    conceptName: "Summary",
    blockType: "summary",
    cognitiveDemand: "define",
    rationale: "Consolidate learning",
  });

  if (budget.slots.finalMastery > 0) {
    steps.push({
      order: order++,
      phase: "mastery",
      role: "mastery",
      conceptId: concepts.find((c) => c.importance === "critical")?.id || concepts[0]?.id,
      conceptName: "Final mastery check",
      blockType: "checkpoint",
      cognitiveDemand: "evaluate",
      rationale: "Final mastery across critical concepts",
    });
  }

  return steps;
}

/**
 * @param {object[]} journey
 * @returns {{ valid: boolean, violations: string[] }}
 */
function validateTeachTestRhythm(journey) {
  const violations = [];
  let consecutiveTeach = 0;
  for (const step of journey) {
    const isTeach = TEACH_TYPES.has(step.blockType) || step.role === "teach" || step.role === "foundation";
    const isInteraction =
      CHECK_TYPES.has(step.blockType) ||
      ACTIVITY_TYPES.has(step.blockType) ||
      step.role === "check" ||
      step.role === "activity" ||
      step.role === "mastery";

    if (step.role === "teach" || (isTeach && !isInteraction && step.blockType !== "objectives" && step.blockType !== "prior-knowledge")) {
      consecutiveTeach++;
      if (consecutiveTeach > 2) {
        violations.push(`More than 2 consecutive teaching steps before interaction near order ${step.order}`);
      }
    } else if (isInteraction || step.role === "check" || step.role === "activity") {
      consecutiveTeach = 0;
    }
  }
  return { valid: violations.length === 0, violations };
}

module.exports = {
  TEACH_TYPES,
  CHECK_TYPES,
  ACTIVITY_TYPES,
  buildLearningJourney,
  validateTeachTestRhythm,
};
