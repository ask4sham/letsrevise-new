/**
 * Lesson Generator V2 — Learning Experience Generator (planning layer).
 *
 * Enable via LESSON_GENERATOR_V2=true or request flag useLessonGeneratorV2.
 * Does not replace block renderers or student view systems.
 */

const { buildLessonBlueprint } = require("./lessonBlueprintEngine");
const { buildLessonKnowledgeGraph } = require("./lessonKnowledgeGraph");
const { runLessonGeneratorV2Pipeline, buildBlueprintPromptAppendix, refactorExistingLesson, PIPELINE_STAGES } = require("./pipeline");
const { runBlueprintDiagnostics } = require("./blueprintDiagnostics");
const { refactorLessonFromBlueprint } = require("./lessonRefactorEngine");
const { classifyLessonArchetype } = require("./archetypes");

function isLessonGeneratorV2Enabled(env = process.env) {
  const v = env?.LESSON_GENERATOR_V2;
  return v === "true" || v === "1" || v === true;
}

module.exports = {
  isLessonGeneratorV2Enabled,
  PIPELINE_STAGES,
  buildLessonBlueprint,
  buildLessonKnowledgeGraph,
  runLessonGeneratorV2Pipeline,
  buildBlueprintPromptAppendix,
  runBlueprintDiagnostics,
  refactorExistingLesson,
  refactorLessonFromBlueprint,
  classifyLessonArchetype,
};
