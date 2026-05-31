/**
 * Mastery / progress metadata — planned checkpoints for future UI badges.
 */

/**
 * @param {import('./archetypes').ConceptNode[]} concepts
 * @param {object[]} journey
 */
function buildMasteryProgressPlan(concepts, journey) {
  const masteryPlan = [];

  for (const concept of concepts) {
    const introducedAt = journey.find((s) => s.conceptId === concept.id && s.role === "teach");
    const checkedAt = journey.find((s) => s.conceptId === concept.id && s.role === "check");
    const appliedAt = journey.find((s) => s.conceptId === concept.id && s.role === "activity");
    const masteryAt = journey.find(
      (s) => s.role === "mastery" && (s.conceptId === concept.id || s.conceptId == null)
    );

    masteryPlan.push({
      concept: concept.name,
      conceptId: concept.id,
      introducedAt: introducedAt != null ? introducedAt.order : null,
      checkedAt: checkedAt != null ? checkedAt.order : null,
      appliedAt: appliedAt != null ? appliedAt.order : null,
      masteredAt: masteryAt != null ? masteryAt.order : null,
      masteryStatus: checkedAt && appliedAt ? "planned" : checkedAt ? "partially_planned" : "introduced_only",
    });
  }

  return masteryPlan;
}

module.exports = {
  buildMasteryProgressPlan,
};
