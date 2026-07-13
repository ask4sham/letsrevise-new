/**
 * Lesson Generator V2 — feature flags.
 * Independent of lib/lessonGeneratorV2 (blueprint planner used by V1).
 */

function isLessonGeneratorV2PipelineEnabled(env = process.env) {
  const raw = String(env.LESSON_GENERATOR_V2_ENABLED || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

module.exports = {
  isLessonGeneratorV2PipelineEnabled,
};
