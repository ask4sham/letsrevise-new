/**
 * Activity placement by lesson archetype — activities after relevant teaching, not batched late.
 */

/** @type {Record<string, { activities: object[], placement: string }>} */
const ARCHETYPE_ACTIVITY_PLANS = {
  metabolism: {
    placement: "after_core_teaching",
    activities: [
      { id: "classify_metabolism", type: "dragDropMatch", matchMode: "text", afterConcept: "anabolism", label: "Classification: anabolic vs catabolic" },
      { id: "diagram_metabolism", type: "diagram", afterConcept: "metabolism", label: "Metabolism diagram task" },
      { id: "atp_application", type: "checkpoint", afterConcept: "atp", label: "ATP application question" },
      { id: "exam_anabolic_catabolic", type: "exam-practice", afterConcept: "deamination_urea", label: "Exam practice: anabolic/catabolic reactions" },
    ],
  },
  uses_of_glucose: {
    placement: "early_and_mid",
    activities: [
      { id: "glucose_fates_dnd", type: "dragDropMatch", matchMode: "text-to-image", afterConcept: "respiration", label: "Drag/drop glucose fates", early: true },
      { id: "flow_diagram", type: "diagram", afterConcept: "starch_storage", label: "Flow/diagram of glucose pathways" },
      { id: "starch_checkpoint", type: "checkpoint", afterConcept: "starch_storage", label: "Starch insolubility check" },
      { id: "nitrate_exam", type: "exam-practice", afterConcept: "nitrate_ions", label: "Exam question: nitrate ions/proteins" },
    ],
  },
  limiting_factors: {
    placement: "mid_with_graphs",
    activities: [
      { id: "graph_block", type: "graph", afterConcept: "light_intensity", label: "Graph block required", required: true },
      { id: "graph_interpret", type: "checkpoint", afterConcept: "graph_interpretation", label: "Graph interpretation question", required: true },
      { id: "practical_data", type: "checkpoint", afterConcept: "practical_data", label: "Practical/data interpretation", required: true },
    ],
  },
  respiration: {
    placement: "process_visual",
    activities: [
      { id: "process_sequence", type: "interactiveSequence", afterConcept: "aerobic_respiration", label: "Process sequence" },
      { id: "tti_visual", type: "dragDropMatch", matchMode: "text-to-image", afterConcept: "atp_release", label: "Text-to-image visual retrieval" },
      { id: "aerobic_anaerobic_check", type: "checkpoint", afterConcept: "anaerobic_respiration", label: "Aerobic vs anaerobic checkpoint" },
      { id: "oxygen_debt_apply", type: "checkpoint", afterConcept: "oxygen_debt", label: "Oxygen debt application", cognitiveDemand: "apply" },
    ],
  },
  plant_defences: {
    placement: "visual_classification",
    activities: [
      { id: "hotspot_diagram", type: "hotspot", afterConcept: "defence_types", label: "Hotspot diagram" },
      { id: "classify_defences", type: "dragDropMatch", afterConcept: "mechanical_defence", label: "Physical/chemical/mechanical classification" },
      { id: "misconception_check", type: "checkpoint", afterConcept: "misconception_check", label: "Misconception check" },
    ],
  },
  general_gcse_biology: {
    placement: "balanced",
    activities: [
      { id: "core_activity", type: "dragDropMatch", afterConcept: "application", label: "Application activity" },
      { id: "core_diagram", type: "diagram", afterConcept: "core_idea_1", label: "Supporting diagram" },
    ],
  },
};

/**
 * Merge archetype-specific activities into learning journey (insert after teach+check for concept).
 * @param {object[]} journey
 * @param {string} archetype
 * @returns {{ journey: object[], activityPlan: object[] }}
 */
function planActivityPlacement(journey, archetype) {
  const plan = ARCHETYPE_ACTIVITY_PLANS[archetype] || ARCHETYPE_ACTIVITY_PLANS.general_gcse_biology;
  const activityPlan = plan.activities.map((a) => ({
    ...a,
    archetype,
    placementStrategy: plan.placement,
    scheduled: false,
  }));

  const result = journey.slice();
  let order = result.length;

  for (const activity of activityPlan) {
    const afterIdx = result.findIndex(
      (s) => s.conceptId === activity.afterConcept && (s.role === "check" || s.role === "teach")
    );
    const insertAt = afterIdx >= 0 ? afterIdx + 1 : result.length - 2;
    const step = {
      order: insertAt,
      phase: "application",
      role: "activity",
      conceptId: activity.afterConcept,
      conceptName: activity.label,
      blockType: activity.type,
      matchMode: activity.matchMode,
      cognitiveDemand: activity.cognitiveDemand || "apply",
      rationale: `Archetype activity: ${activity.label}`,
      activityId: activity.id,
      required: activity.required === true,
    };
    result.splice(Math.max(0, insertAt), 0, step);
    activity.scheduled = true;
    order++;
  }

  result.forEach((s, i) => {
    s.order = i;
  });

  return { journey: result, activityPlan };
}

function getArchetypeActivityPlan(archetype) {
  return ARCHETYPE_ACTIVITY_PLANS[archetype] || ARCHETYPE_ACTIVITY_PLANS.general_gcse_biology;
}

module.exports = {
  ARCHETYPE_ACTIVITY_PLANS,
  planActivityPlacement,
  getArchetypeActivityPlan,
};
