/**
 * Lesson Generator V3 service — structural enforcement before export.
 */

const {
  isLessonGeneratorV3Enabled,
  runLessonGeneratorV3Pipeline,
  runLessonArchitectureDiagnostics,
} = require("../../lib/lessonGeneratorV3");

function resolveV3Enabled(opts = {}) {
  if (opts.requestFlag === true) return true;
  if (opts.requestFlag === false) return false;
  return isLessonGeneratorV3Enabled();
}

/**
 * @param {object[]} pages
 * @param {object} blueprint
 * @param {{ strict?: boolean }} opts
 */
function applyV3BeforeExport(pages, blueprint, opts = {}) {
  const strict =
    opts.strict !== undefined
      ? opts.strict
      : process.env.LESSON_GENERATOR_V3_STRICT !== "false";

  return runLessonGeneratorV3Pipeline(
    pages,
    { blueprint },
    { enforce: true, strict, diagnostics: process.env.NODE_ENV !== "production" }
  );
}

module.exports = {
  isLessonGeneratorV3Enabled,
  resolveV3Enabled,
  applyV3BeforeExport,
  runLessonArchitectureDiagnostics,
  runLessonGeneratorV3Pipeline,
};
