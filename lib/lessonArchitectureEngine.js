/**
 * Lesson Architecture Engine — blueprint → mandatory lesson structure (V3 law).
 */

const { buildLessonBlueprint } = require("./lessonGeneratorV2/lessonBlueprintEngine");

/** Canonical mandatory sequence (source of truth for export). */
const MANDATORY_ARCHITECTURE_SEQUENCE = [
  "objectives",
  "priorKnowledge",
  "scenario",
  "coreRule",
  "teachChunk1",
  "checkpoint1",
  "teachChunk2",
  "visualActivity",
  "teachChunk3",
  "interactiveActivity",
  "teachChunk4",
  "applicationActivity",
  "examTechnique",
  "examPractice",
  "summary",
  "keywords",
  "revisionPractice",
];

const SLOT_META = {
  objectives: { phase: "foundation", category: "foundation", expectedTypes: ["keyIdea", "text"] },
  priorKnowledge: { phase: "foundation", category: "foundation", expectedTypes: ["text"] },
  scenario: { phase: "foundation", category: "foundation", expectedTypes: ["text", "hook"] },
  coreRule: { phase: "foundation", category: "foundation", expectedTypes: ["keyIdea", "text-concept"] },
  teachChunk1: { phase: "teach", category: "learning", expectedTypes: ["text", "text-concept", "keyIdea"] },
  checkpoint1: { phase: "retrieval", category: "learning", expectedTypes: ["checkpoint", "self-check-question"] },
  teachChunk2: { phase: "teach", category: "learning", expectedTypes: ["text", "text-concept", "keyIdea"] },
  visualActivity: { phase: "application", category: "learning", expectedTypes: ["diagram", "graph"] },
  teachChunk3: { phase: "teach", category: "learning", expectedTypes: ["text", "text-concept", "keyIdea"] },
  interactiveActivity: {
    phase: "application",
    category: "learning",
    expectedTypes: ["dragDropMatch", "interactiveSequence", "hotspot"],
  },
  teachChunk4: { phase: "teach", category: "learning", expectedTypes: ["text", "text-concept", "keyIdea"] },
  applicationActivity: {
    phase: "application",
    category: "learning",
    expectedTypes: ["dragDropMatch", "checkpoint", "commonMistake"],
  },
  examTechnique: { phase: "exam", category: "endgame", expectedTypes: ["examTip", "text"] },
  examPractice: { phase: "exam", category: "endgame", expectedTypes: ["text", "exam-practice"] },
  summary: { phase: "summary", category: "endgame", expectedTypes: ["keyIdea", "text", "summary"] },
  keywords: { phase: "summary", category: "endgame", expectedTypes: ["keyWords", "text"] },
  revisionPractice: {
    phase: "mastery",
    category: "endgame",
    expectedTypes: ["checkpoint", "self-check-question"],
  },
};

/**
 * Map blueprint journey step to nearest architecture slot.
 * @param {object} blueprint
 */
function buildLessonArchitectureFromBlueprint(blueprint) {
  const journey = blueprint?.learningJourney || [];
  const teachChunks = journey.filter((s) => s.role === "teach");
  const checks = journey.filter((s) => s.role === "check");
  const activities = journey.filter((s) => s.role === "activity");

  const architecture = MANDATORY_ARCHITECTURE_SEQUENCE.map((slot, order) => {
    const meta = SLOT_META[slot] || {};
    let conceptId = null;
    let conceptName = null;
    let journeyRef = null;

    if (slot === "teachChunk1") journeyRef = teachChunks[0];
    if (slot === "teachChunk2") journeyRef = teachChunks[1];
    if (slot === "teachChunk3") journeyRef = teachChunks[2];
    if (slot === "teachChunk4") journeyRef = teachChunks[3];
    if (slot === "checkpoint1") journeyRef = checks[0];
    if (slot === "visualActivity") {
      journeyRef = activities.find((a) => ["diagram", "graph"].includes(a.blockType)) || activities[0];
    }
    if (slot === "interactiveActivity") {
      journeyRef =
        activities.find((a) =>
          ["dragDropMatch", "interactiveSequence", "hotspot"].includes(a.blockType)
        ) || activities[1];
    }
    if (slot === "applicationActivity") {
      journeyRef = activities.find((a) => a.blockType === "exam-practice") || checks[checks.length - 1];
    }

    if (journeyRef) {
      conceptId = journeyRef.conceptId;
      conceptName = journeyRef.conceptName;
    }

    return {
      slot,
      order,
      required: true,
      phase: meta.phase,
      category: meta.category,
      expectedBlockTypes: meta.expectedTypes || [],
      conceptId,
      conceptName,
      blueprintStep: journeyRef?.order ?? null,
    };
  });

  return {
    version: 3,
    topic: blueprint?.topic,
    lessonArchetype: blueprint?.lessonArchetype,
    lessonArchitecture: architecture,
    mandatorySequence: MANDATORY_ARCHITECTURE_SEQUENCE.slice(),
    blueprintVersion: blueprint?.version || 2,
  };
}

/**
 * @param {object} input — blueprint fields or pre-built blueprint
 */
function buildLessonArchitecture(input = {}) {
  const blueprint = input.lessonArchitecture
    ? null
    : input.learningJourney
      ? input
      : buildLessonBlueprint(input);
  return buildLessonArchitectureFromBlueprint(blueprint || input);
}

module.exports = {
  MANDATORY_ARCHITECTURE_SEQUENCE,
  SLOT_META,
  buildLessonArchitecture,
  buildLessonArchitectureFromBlueprint,
};
