/**
 * Retrieval planner — immediate, delayed, and final mastery per concept.
 */

/**
 * @param {import('./archetypes').ConceptNode[]} concepts
 * @param {object[]} journey
 */
function buildRetrievalPlan(concepts, journey) {
  const plan = [];

  for (const concept of concepts) {
    const teachStep = journey.find((s) => s.conceptId === concept.id && s.role === "teach");
    const firstCheck = journey.find((s) => s.conceptId === concept.id && s.role === "check");
    const activityReuse = journey.find(
      (s) => s.conceptId === concept.id && s.role === "activity"
    );
    const delayedCheck = journey.filter((s) => s.conceptId === concept.id && s.role === "check").pop();
    const finalMastery = journey.find((s) => s.role === "mastery");

    const entries = [];

    if (firstCheck) {
      entries.push({
        type: "immediate",
        afterBlockRole: "teach",
        journeyOrder: firstCheck.order,
        cognitiveDemand: "identify",
      });
    }

    if (activityReuse) {
      entries.push({
        type: "applied_retrieval",
        afterBlockRole: "activity",
        journeyOrder: activityReuse.order,
        cognitiveDemand: "apply",
      });
    }

    if (delayedCheck && delayedCheck !== firstCheck) {
      entries.push({
        type: "delayed",
        journeyOrder: delayedCheck.order,
        cognitiveDemand: "explain",
      });
    } else if (concept.retrievalFrequency >= 2 && firstCheck) {
      entries.push({
        type: "delayed_planned",
        journeyOrder: null,
        cognitiveDemand: "compare",
        note: "Schedule second check in exam practice or final mastery",
      });
    }

    if (concept.importance === "critical" && finalMastery) {
      entries.push({
        type: "final_mastery",
        journeyOrder: finalMastery.order,
        cognitiveDemand: "evaluate",
      });
    }

    plan.push({
      conceptId: concept.id,
      conceptName: concept.name,
      retrievalFrequency: concept.retrievalFrequency,
      entries,
    });
  }

  return plan;
}

module.exports = {
  buildRetrievalPlan,
};
