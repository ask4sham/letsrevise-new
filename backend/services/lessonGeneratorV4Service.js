/**
 * Lesson Generator V4 service — teaching intelligence (prompt + post-generation analysis).
 */

const {
  isLessonGeneratorV4Enabled,
  runLessonGeneratorV4Pipeline,
  buildTeachingPromptAppendix,
  runLessonTeachingDiagnostics,
  runLessonQualityGateV2,
} = require("../../lib/lessonGeneratorV4");

function resolveV4Enabled(opts = {}) {
  if (opts.requestFlag === true) return true;
  if (opts.requestFlag === false) return false;
  return isLessonGeneratorV4Enabled();
}

function mergeV4IntoAdditionalInstructions(additionalInstructions, promptAppendix) {
  const base = String(additionalInstructions || "").trim();
  const marker = "--- Lesson Generator V4";
  if (base.includes(marker)) return base;
  const appendix = String(promptAppendix || "").trim();
  if (!appendix) return base;
  return base ? `${base}\n\n${appendix}` : appendix;
}

/**
 * @param {object[]} pages
 * @param {object} blueprint
 * @param {{ strict?: boolean }} opts
 */
function applyV4AfterGeneration(pages, blueprint, opts = {}) {
  const strict =
    opts.strict === true || process.env.LESSON_GENERATOR_V4_STRICT === "true";

  return runLessonGeneratorV4Pipeline(
    pages,
    { blueprint, tier: opts.tier, subject: opts.subject },
    { strict, diagnostics: process.env.NODE_ENV !== "production" }
  );
}

function buildV4PromptForBlueprint(blueprint, ctx = {}) {
  if (!blueprint) return "";
  const mergedCtx = {
    topic: blueprint.topic,
    subject: blueprint.subject,
    examBoard: blueprint.examBoard || blueprint.board,
    tier: blueprint.tier,
    ...ctx,
  };
  return buildTeachingPromptAppendix(blueprint, mergedCtx);
}

module.exports = {
  isLessonGeneratorV4Enabled,
  resolveV4Enabled,
  mergeV4IntoAdditionalInstructions,
  applyV4AfterGeneration,
  buildV4PromptForBlueprint,
  runLessonTeachingDiagnostics,
  runLessonQualityGateV2,
  runLessonGeneratorV4Pipeline,
};
