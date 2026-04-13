/**
 * PR-017: Compute answer confidence from retrieval and source signals.
 * Deterministic. Works when vector DB is down (topScore null).
 *
 * Rules:
 * - weak: warnings include "Insufficient trusted sources" OR usedSources.length === 0 OR low vector score
 *   (lesson-local retrieval uses a different score scale — see lessonLocalTrustedEvidence).
 * - strong: topScore >= 0.60 AND specSources >= 1 AND lessonSources >= 1 AND no weak warnings
 * - moderate: otherwise
 *
 * @param {{ usedSources: Array<{ sourceType: string, score?: number, knowledgeDocumentId?: string }>, retrievalScores?: number[], warnings?: string[], fallbackGeneralKnowledge?: boolean }} opts
 * @returns {{ confidenceLevel: "strong"|"moderate"|"weak", confidenceReason: string, confidenceSignals: object }}
 */

/** Aligned with enquiry.controller LESSON_LOCAL_STRONG_THRESHOLD — lesson-local segment scores sit below typical vector similarity. */
const LESSON_LOCAL_STRONG_SCORE = 0.18;
/** Vector / merged retrieval: below this is weak unless bypassed. */
const VECTOR_WEAK_THRESHOLD = 0.35;
/** Indexed lesson blocks (vector) with at least this max score count as sufficient curriculum evidence. */
const LESSON_VECTOR_OK_SCORE = 0.25;

function computeConfidence(opts = {}) {
  const usedSources = opts?.usedSources || [];
  const retrievalScores = opts?.retrievalScores || [];
  const warnings = opts?.warnings || [];
  const fallbackGeneralKnowledge = opts?.fallbackGeneralKnowledge === true;

  const topScore =
    retrievalScores.length > 0
      ? Math.max(...retrievalScores)
      : usedSources.length > 0
        ? Math.max(...usedSources.map((s) => s.score ?? 0))
        : null;

  const specSources = usedSources.filter((s) => s.sourceType === "specStatement").length;
  const lessonSources = usedSources.filter((s) => s.sourceType === "lessonBlock").length;
  const teacherNoteSources = usedSources.filter((s) => s.sourceType === "teacherNote").length;
  const externalSources = usedSources.filter((s) => s.sourceType === "externalTrusted").length;
  const hasSpecOrLesson = specSources >= 1 || lessonSources >= 1;
  const totalSources = usedSources.length;

  const hasWeakWarning = warnings.some(
    (w) => typeof w === "string" && w.toLowerCase().includes("insufficient trusted sources")
  );

  /** Lesson-local chunks (`lessonlocal:…`) use segment scores; strong lesson-local must not be treated as weak vector hits. */
  const lessonLocalTrustedEvidence = usedSources.some(
    (s) =>
      String(s.knowledgeDocumentId || "").startsWith("lessonlocal:") &&
      (s.score ?? 0) >= LESSON_LOCAL_STRONG_SCORE
  );

  const weakFromLowVectorScore =
    topScore != null &&
    topScore < VECTOR_WEAK_THRESHOLD &&
    !lessonLocalTrustedEvidence &&
    specSources === 0 &&
    !(lessonSources >= 1 && topScore >= LESSON_VECTOR_OK_SCORE);

  let confidenceLevel = "moderate";
  let confidenceReason = "Some curriculum sources support this answer.";
  if (lessonLocalTrustedEvidence && specSources === 0) {
    confidenceReason = "Lesson content supports this answer.";
  } else if (specSources >= 1 && lessonSources >= 1) {
    confidenceReason = "Curriculum sources support this answer.";
  }

  // PR-021: Only external sources (no spec/lesson) → confidence stays weak
  if (externalSources >= 1 && !hasSpecOrLesson) {
    confidenceLevel = "weak";
    confidenceReason = "External references found (exploratory). Course content is still thin.";
  } else if (
    hasWeakWarning ||
    totalSources === 0 ||
    weakFromLowVectorScore
  ) {
    confidenceLevel = "weak";
    confidenceReason = fallbackGeneralKnowledge
      ? "General knowledge was used because trusted curriculum coverage was limited."
      : "Not enough trusted curriculum sources were found.";
  } else if (
    (topScore == null || topScore >= 0.6) &&
    specSources >= 1 &&
    lessonSources >= 1 &&
    !hasWeakWarning
  ) {
    confidenceLevel = "strong";
    confidenceReason = "Specification + lesson sources support this answer.";
  }

  const confidenceSignals = {
    topScore: topScore != null ? Math.round(topScore * 1000) / 1000 : null,
    lessonLocalTrustedEvidence,
    sources: {
      spec: specSources,
      lesson: lessonSources,
      teacherNote: teacherNoteSources,
      external: externalSources,
      total: totalSources,
    },
    warnings: [...warnings],
  };

  return {
    confidenceLevel,
    confidenceReason,
    confidenceSignals,
  };
}

module.exports = { computeConfidence };
