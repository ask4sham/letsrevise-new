/**
 * Blueprint diagnostics for dev mode — explains V2 planning decisions.
 */

const { getArchetypeActivityPlan } = require("./activityPlacementEngine");

/**
 * @param {object} blueprint
 * @param {object[]} [pages]
 */
function runBlueprintDiagnostics(blueprint, pages = null) {
  const blocks = pages ? flattenBlocks(pages) : [];
  const dup = pages ? require("./lessonDuplicationGuard").scanLessonDuplication(blocks) : { issues: [] };

  const underTested = blueprint.validation?.chunking?.underTested || [];
  const activityPlan = blueprint.activityPlan || getArchetypeActivityPlan(blueprint.lessonArchetype);

  const blockPlacement = (blueprint.learningJourney || []).map((step) => ({
    order: step.order,
    role: step.role,
    blockType: step.blockType,
    concept: step.conceptName || step.conceptId,
    why: step.rationale,
  }));

  return {
    topic: blueprint.topic,
    lessonArchetype: blueprint.lessonArchetype,
    lessonArchetypeLabel: blueprint.lessonArchetypeLabel,
    estimatedMinutes: blueprint.estimatedDuration?.minutes,
    durationTier: blueprint.estimatedDuration?.tier,
    detectedConcepts: (blueprint.concepts || []).map((c) => ({
      id: c.id,
      name: c.name,
      importance: c.importance,
      bestActivityType: c.bestActivityType,
      retrievalFrequency: c.retrievalFrequency,
    })),
    activityPlacementLogic: {
      strategy: activityPlan.placement,
      plannedActivities: activityPlan.activities,
    },
    retrievalSpacing: blueprint.retrievalPlan,
    duplicateConceptsDetected: dup.issues.map((i) => ({
      kind: i.kind,
      suggestion: i.suggestion,
      blockIndex: i.blockIndex,
    })),
    underTestedConcepts: underTested,
    teachTestRhythmValid: blueprint.validation?.teachTestRhythm?.valid,
    chunkingValid: blueprint.validation?.chunking?.valid,
    violations: [
      ...(blueprint.validation?.teachTestRhythm?.violations || []),
      ...(blueprint.validation?.chunking?.violations || []),
    ],
    blockPlacement,
    masteryPlan: blueprint.masteryPlan,
    lessonLengthBudget: blueprint.estimatedDuration,
  };
}

function flattenBlocks(pages) {
  const out = [];
  if (!Array.isArray(pages)) return out;
  for (const p of pages) {
    for (const b of p.blocks || []) out.push(b);
  }
  return out;
}

module.exports = {
  runBlueprintDiagnostics,
};
