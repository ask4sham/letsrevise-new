/**
 * Golden blueprint tests — Lesson Generator V2 planning (no OpenAI).
 */

const { buildLessonBlueprint } = require("../lessonGeneratorV2/lessonBlueprintEngine");
const { validateTeachTestRhythm } = require("../lessonGeneratorV2/learningJourneyPlanner");
const { scanLessonDuplication } = require("../lessonGeneratorV2/lessonDuplicationGuard");

function blueprintFor(topic) {
  return buildLessonBlueprint({ topic, subject: "Biology", examBoard: "AQA", tier: "higher", durationTier: "standard" });
}

function conceptIds(blueprint) {
  return (blueprint.concepts || []).map((c) => c.id);
}

function journeyBlockTypes(blueprint) {
  return (blueprint.learningJourney || []).map((s) => s.blockType);
}

function maxConsecutiveTextTeach(journey) {
  const textTypes = new Set(["text", "text-concept", "keyIdea", "commonMistake", "examTip", "worked-example"]);
  let max = 0;
  let run = 0;
  for (const step of journey) {
    if (textTypes.has(step.blockType) && step.role === "teach") {
      run++;
      max = Math.max(max, run);
    } else if (step.role === "check" || step.role === "activity") {
      run = 0;
    }
  }
  return max;
}

describe("Lesson Generator V2 golden blueprints", () => {
  test("Metabolism: concepts, diagram after teaching, retrieval rhythm", () => {
    const bp = blueprintFor("Metabolism");
    expect(bp.lessonArchetype).toBe("metabolism");
    const ids = conceptIds(bp);
    expect(ids).toEqual(
      expect.arrayContaining([
        "metabolism",
        "catabolism",
        "anabolism",
        "atp",
        "respiration_link",
        "proteins_lipids",
        "deamination_urea",
      ])
    );
    const journey = bp.learningJourney;
    const metabolismTeach = journey.findIndex((s) => s.conceptId === "metabolism" && s.role === "teach");
    const diagramAfter = journey.findIndex(
      (s) => s.blockType === "diagram" && s.conceptId === "metabolism"
    );
    expect(metabolismTeach).toBeGreaterThanOrEqual(0);
    expect(diagramAfter).toBeGreaterThan(metabolismTeach);
    const rhythm = validateTeachTestRhythm(journey);
    expect(rhythm.valid).toBe(true);
    expect(maxConsecutiveTextTeach(journey)).toBeLessThanOrEqual(2);
    expect(bp.retrievalPlan.length).toBeGreaterThanOrEqual(7);
  });

  test("Uses of glucose: early glucose fates, starch and nitrate tested, no limiting-factor graphs", () => {
    const bp = blueprintFor("Uses of glucose");
    expect(bp.lessonArchetype).toBe("uses_of_glucose");
    const types = journeyBlockTypes(bp);
    expect(types).not.toContain("graph");
    const activities = bp.activityPlan || [];
    const earlyFates = activities.find((a) => a.id === "glucose_fates_dnd");
    expect(earlyFates).toBeTruthy();
    expect(earlyFates.early).toBe(true);
    const starchCheck = activities.find((a) => a.id === "starch_checkpoint");
    expect(starchCheck).toBeTruthy();
    const nitrateExam = activities.find((a) => a.id === "nitrate_exam");
    expect(nitrateExam).toBeTruthy();
    expect(conceptIds(bp)).toEqual(
      expect.arrayContaining(["starch_storage", "nitrate_ions", "amino_acids_proteins"])
    );
  });

  test("Limiting factors: graphs and practical interpretation required", () => {
    const bp = blueprintFor("Limiting factors in photosynthesis");
    expect(bp.lessonArchetype).toBe("limiting_factors");
    const types = journeyBlockTypes(bp);
    expect(types).toContain("graph");
    const activities = bp.activityPlan || [];
    expect(activities.some((a) => a.type === "graph" && a.required)).toBe(true);
    expect(activities.some((a) => a.id === "graph_interpret")).toBe(true);
    expect(activities.some((a) => a.id === "practical_data")).toBe(true);
  });

  test("Respiration: aerobic/anaerobic, oxygen debt, visual retrieval, no duplicate oxygen debt MCQs in sample blocks", () => {
    const bp = blueprintFor("Respiration");
    expect(bp.lessonArchetype).toBe("respiration");
    expect(conceptIds(bp)).toEqual(
      expect.arrayContaining(["aerobic_respiration", "anaerobic_respiration", "oxygen_debt"])
    );
    const activities = bp.activityPlan || [];
    expect(activities.some((a) => a.id === "tti_visual")).toBe(true);
    expect(activities.some((a) => a.id === "aerobic_anaerobic_check")).toBe(true);
    expect(activities.some((a) => a.id === "oxygen_debt_apply")).toBe(true);

    const dupBlocks = [
      { type: "checkpoint", question: "What is oxygen debt?" },
      { type: "checkpoint", question: "What is oxygen debt?" },
    ];
    const dup = scanLessonDuplication(dupBlocks);
    expect(dup.clean).toBe(false);
    expect(dup.issues[0].kind).toBe("duplicate_question");
  });

  test("Plant defences: hotspot and classification activities", () => {
    const bp = blueprintFor("Plant defences");
    expect(bp.lessonArchetype).toBe("plant_defences");
    const activities = bp.activityPlan || [];
    expect(activities.some((a) => a.type === "hotspot")).toBe(true);
    expect(activities.some((a) => a.id === "classify_defences")).toBe(true);
    expect(conceptIds(bp)).toEqual(
      expect.arrayContaining(["physical_defence", "chemical_defence", "mechanical_defence"])
    );
  });
});
