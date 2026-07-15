/**
 * Lesson Generator V2 — feature flags.
 * Independent of lib/lessonGeneratorV2 (blueprint planner used by V1).
 */

function isTruthyFlag(raw) {
  const v = String(raw || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function isLessonGeneratorV2PipelineEnabled(env = process.env) {
  return isTruthyFlag(env.LESSON_GENERATOR_V2_ENABLED);
}

/**
 * Second gate for Mongo draft persistence.
 * Pipeline can run without this; saves require both flags + persist:true + critic ok.
 */
function isLessonGeneratorV2PersistEnabled(env = process.env) {
  return isTruthyFlag(env.LESSON_GENERATOR_V2_PERSIST);
}

module.exports = {
  isLessonGeneratorV2PipelineEnabled,
  isLessonGeneratorV2PersistEnabled,
};
