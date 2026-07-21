"use strict";

/**
 * Slice 2 — Grounded Ask AI trust gate.
 * Students: fail closed when retrieval is weak (no general-knowledge inventing).
 * Teachers/admins: keep existing GK fallback unless STRICT_CURRICULUM_ONLY.
 */

const INSUFFICIENT_TRUSTED_SOURCES_WARNING = "Insufficient trusted sources";

const WEAK_SCORE_THRESHOLD = 0.35;
/** Lesson-local scores use a different scale than embedding similarity. */
const LESSON_LOCAL_STRONG_THRESHOLD = 0.18;

/**
 * Cache segment so student strict answers never share keys with teacher GK answers.
 * @returns {"s2-student"|"strict"|"gk"}
 */
function groundingCacheSegment({ isStudentUser, strictCurriculumOnly }) {
  if (isStudentUser) return "s2-student";
  if (strictCurriculumOnly) return "strict";
  return "gk";
}

function isWeakEvidence({
  retrievalResults = [],
  lessonLocalStrong = false,
  weakScoreThreshold = WEAK_SCORE_THRESHOLD,
} = {}) {
  const list = Array.isArray(retrievalResults) ? retrievalResults : [];
  const mergedTopScore = list.length > 0 ? Number(list[0].score) || 0 : 0;
  return list.length === 0 || (mergedTopScore < weakScoreThreshold && !lessonLocalStrong);
}

/**
 * Whether to answer from general knowledge (empty citations).
 * Students never — Slice 2 fail-closed.
 */
function shouldUseGeneralKnowledgeFallback({
  isStudentUser,
  strictCurriculumOnly,
  weakEvidence,
}) {
  if (isStudentUser) return false;
  if (strictCurriculumOnly) return false;
  return Boolean(weakEvidence);
}

/**
 * Skip LLM when a student has thin retrieval — return a fixed safe reply.
 */
function shouldShortCircuitUngroundedStudentAnswer({
  isStudentUser,
  weakEvidence,
}) {
  return Boolean(isStudentUser && weakEvidence);
}

function buildUngroundedStudentAnswer({ nearestTopicKey } = {}) {
  const keyPoints = [];
  const topic = nearestTopicKey != null ? String(nearestTopicKey).trim() : "";
  if (topic) {
    keyPoints.push(`Nearest topic in your materials: ${topic}`);
  }
  return {
    explanation:
      "I could not find enough trusted curriculum content in this lesson to answer that confidently. Try asking about something covered on this Learn or Practise page, or rephrase using the topic’s key terms.",
    keyPoints,
    memoryHook: "",
    citations: [],
    practice: [],
    warnings: [INSUFFICIENT_TRUSTED_SOURCES_WARNING],
  };
}

function isFallbackAiCachedResponse(response) {
  const used = (response && response.usedSources) || [];
  return used.some(
    (s) =>
      s &&
      (s.sourceType === "fallback_ai" || s.knowledgeDocumentId === "__fallback_ai__")
  );
}

module.exports = {
  INSUFFICIENT_TRUSTED_SOURCES_WARNING,
  WEAK_SCORE_THRESHOLD,
  LESSON_LOCAL_STRONG_THRESHOLD,
  groundingCacheSegment,
  isWeakEvidence,
  shouldUseGeneralKnowledgeFallback,
  shouldShortCircuitUngroundedStudentAnswer,
  buildUngroundedStudentAnswer,
  isFallbackAiCachedResponse,
};
