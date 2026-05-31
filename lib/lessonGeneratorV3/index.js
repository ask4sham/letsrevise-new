/**
 * Lesson Generator V3 — structural enforcement (blueprint is law).
 */

const { buildLessonArchitecture } = require("../lessonArchitectureEngine");
const { validateLessonArchitecture } = require("../lessonArchitectureValidator");
const { validateTeachTestRhythm } = require("../teachTestRhythmValidator");
const { computeLessonFlowScore, runLessonQualityGate } = require("../lessonFlowScore");
const { analyzeActivitySpacing } = require("../activitySpacingEngine");
const { auditDuplication } = require("../duplicationAuditor");
const { assessExamReadiness } = require("../examReadinessEngine");
const { runLessonArchitectureDiagnostics } = require("../lessonArchitectureDiagnostics");
const { enforceLessonStructure } = require("../lessonStructuralEnforcer");
const { buildLessonBlueprint } = require("../lessonGeneratorV2/lessonBlueprintEngine");

function isLessonGeneratorV3Enabled(env = process.env) {
  const v = env?.LESSON_GENERATOR_V3;
  return v === "true" || v === "1" || v === true;
}

/**
 * Full V3 pipeline on generated pages (post-AI, pre-export).
 */
function runLessonGeneratorV3Pipeline(pages, input = {}, opts = {}) {
  const blueprint = input.blueprint || buildLessonBlueprint(input);
  const architecture = buildLessonArchitecture(blueprint);

  let workingPages = pages;
  let enforcement = null;
  if (opts.enforce !== false) {
    enforcement = enforceLessonStructure(workingPages, blueprint);
    workingPages = enforcement.pages;
  }

  const validation = validateLessonArchitecture(workingPages, blueprint);
  const flowScore = computeLessonFlowScore(workingPages, {
    blueprint,
    lessonArchetype: blueprint.lessonArchetype,
    subject: input.subject,
  });
  const qualityGate = runLessonQualityGate(workingPages, {
    blueprint,
    strict: opts.strict !== false,
    thresholds: opts.thresholds,
  });
  const diagnostics =
    opts.diagnostics !== false
      ? runLessonArchitectureDiagnostics(workingPages, blueprint)
      : null;

  return {
    version: 3,
    blueprint,
    architecture,
    enforcement,
    validation,
    flowScore,
    qualityGate,
    diagnostics,
    pages: workingPages,
  };
}

module.exports = {
  isLessonGeneratorV3Enabled,
  buildLessonArchitecture,
  validateLessonArchitecture,
  validateTeachTestRhythm,
  computeLessonFlowScore,
  runLessonQualityGate,
  analyzeActivitySpacing,
  auditDuplication,
  assessExamReadiness,
  runLessonArchitectureDiagnostics,
  enforceLessonStructure,
  runLessonGeneratorV3Pipeline,
};
