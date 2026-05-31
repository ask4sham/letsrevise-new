/**
 * Lesson Generator V2 service — planning layer for AI generation and optional refactor.
 */

const {
  isLessonGeneratorV2Enabled,
  runLessonGeneratorV2Pipeline,
  buildBlueprintPromptAppendix,
  refactorExistingLesson,
  runBlueprintDiagnostics,
} = require("../../lib/lessonGeneratorV2");

/**
 * @param {object} input
 * @param {{ requestFlag?: boolean, pages?: object[] }} opts
 */
function resolveV2Enabled(opts = {}) {
  if (opts.requestFlag === true) return true;
  if (opts.requestFlag === false) return false;
  return isLessonGeneratorV2Enabled();
}

/**
 * Plan lesson before block generation.
 */
function planLessonV2(input = {}, opts = {}) {
  if (!resolveV2Enabled(opts)) {
    return { enabled: false };
  }
  const durationTier = input.durationTier || "standard";
  const pipeline = runLessonGeneratorV2Pipeline(
    {
      topic: input.topic,
      subject: input.subject,
      examBoard: input.board || input.examBoard,
      tier: input.tier,
      topicKey: input.topicKey,
      durationTier,
    },
    { pages: opts.pages }
  );
  const promptAppendix = buildBlueprintPromptAppendix(pipeline.blueprint);
  return {
    ...pipeline,
    promptAppendix,
    durationTier,
  };
}

/**
 * Merge V2 blueprint appendix into teacher additional instructions (non-destructive).
 */
function mergeV2IntoAdditionalInstructions(additionalInstructions, promptAppendix) {
  const base = String(additionalInstructions || "").trim();
  const marker = "--- Lesson Generator V2 blueprint";
  if (base.includes(marker)) return base;
  const appendix = String(promptAppendix || "").trim();
  if (!appendix) return base;
  return base ? `${base}\n\n${appendix}` : appendix;
}

module.exports = {
  resolveV2Enabled,
  planLessonV2,
  mergeV2IntoAdditionalInstructions,
  refactorExistingLesson,
  runBlueprintDiagnostics,
  isLessonGeneratorV2Enabled,
};
