"use strict";

/**
 * Feature-gated Teacher Dashboard → Lesson Synthesiser (Phase P1).
 * Default OFF — legacy /api/ai/generate-and-save unchanged when disabled.
 */

function truthyEnv(value) {
  if (value === true) return true;
  if (value == null || value === false) return false;
  const s = String(value).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function getLessonSynthesiserV1Config(env = process.env) {
  const enabled = truthyEnv(env.LESSON_SYNTHESISER_V1_ENABLED);
  const serviceUrl = String(
    env.LESSON_SYNTHESISER_SERVICE_URL || "http://127.0.0.1:5050"
  )
    .trim()
    .replace(/\/$/, "");
  const timeoutMs = Math.max(
    5000,
    Number.parseInt(env.LESSON_SYNTHESISER_TIMEOUT_MS || "120000", 10) || 120000
  );
  return {
    enabled,
    serviceUrl,
    synthesiseUrl: `${serviceUrl}/synthesise`,
    timeoutMs,
  };
}

function isLessonSynthesiserV1Enabled(env = process.env) {
  return getLessonSynthesiserV1Config(env).enabled;
}

module.exports = {
  getLessonSynthesiserV1Config,
  isLessonSynthesiserV1Enabled,
};
