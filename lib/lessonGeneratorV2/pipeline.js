/**
 * Lesson Generator V2 pipeline — planning stages before block generation.
 *
 * Order:
 * 1. Topic classification (knowledge graph)
 * 2. Lesson blueprint
 * 3. Learning journey + activity placement + retrieval + mastery
 * 4. (External) Block generation — must follow blueprint.learningJourney order
 * 5. Duplication guard on draft
 * 6. Diagnostics
 */

const { buildLessonBlueprint } = require("./lessonBlueprintEngine");
const { runBlueprintDiagnostics } = require("./blueprintDiagnostics");
const { scanLessonDuplication } = require("./lessonDuplicationGuard");
const { refactorExistingLesson } = require("./lessonRefactorEngine");

const PIPELINE_STAGES = [
  "topic_classification",
  "knowledge_graph",
  "lesson_blueprint",
  "learning_journey_planning",
  "activity_placement",
  "retrieval_planning",
  "block_generation",
  "pedagogical_activity_validation",
  "gcse_calibration",
  "export_polish",
  "golden_snapshot_validation",
];

/**
 * @param {object} input
 * @param {{ pages?: object[], skipDuplicationScan?: boolean }} opts
 */
function runLessonGeneratorV2Pipeline(input = {}, opts = {}) {
  const blueprint = buildLessonBlueprint(input);
  const diagnostics = runBlueprintDiagnostics(blueprint, opts.pages || null);

  let duplication = { clean: true, issues: [] };
  if (opts.pages && !opts.skipDuplicationScan) {
    const blocks = [];
    for (const p of opts.pages) {
      for (const b of p.blocks || []) blocks.push(b);
    }
    duplication = scanLessonDuplication(blocks);
  }

  return {
    enabled: true,
    version: 2,
    pipelineStages: PIPELINE_STAGES,
    blueprint,
    diagnostics,
    duplication,
    /** Instruction for LLM / template fill — blueprint order is authoritative */
    generationDirectives: {
      blockOrderSource: "blueprint.learningJourney",
      maxConsecutiveTeachBlocks: 2,
      exportPolishMustNotReorder: true,
      embedBlueprintInPrompt: true,
    },
  };
}

/**
 * Build prompt appendix so AI generation respects blueprint sequencing.
 * @param {object} blueprint
 */
function buildBlueprintPromptAppendix(blueprint) {
  const lines = [
    "## Lesson Generator V2 — Learning journey (MANDATORY ORDER)",
    "Plan the lesson as a learning experience, not a linear essay.",
    `Archetype: ${blueprint.lessonArchetypeLabel} (${blueprint.lessonArchetype})`,
    `Target duration: ~${blueprint.estimatedDuration?.minutes} minutes (${blueprint.estimatedDuration?.tier})`,
    "",
    "Rules:",
    "- Never more than 2 teaching/content blocks in a row without a checkpoint or activity.",
    "- Place activities immediately after the concepts they assess (not all after core learning).",
    "- Do not duplicate the same MCQ wording in checkpoint and end quiz.",
    "- Split dense teaching into chunks under 350 words.",
    "",
    "Required journey steps (block types in this order):",
  ];

  for (const step of blueprint.learningJourney || []) {
    lines.push(
      `${step.order + 1}. [${step.role}] ${step.blockType}${step.conceptName ? ` — ${step.conceptName}` : ""} (${step.cognitiveDemand})`
    );
  }

  lines.push("");
  lines.push("Key concepts to cover:");
  for (const c of blueprint.concepts || []) {
    lines.push(`- ${c.name} (${c.importance}): test at least ${c.retrievalFrequency >= 2 ? 2 : 1} time(s)`);
  }

  return lines.join("\n");
}

module.exports = {
  PIPELINE_STAGES,
  runLessonGeneratorV2Pipeline,
  buildBlueprintPromptAppendix,
  refactorExistingLesson,
};
