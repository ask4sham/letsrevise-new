/**
 * PR-017: Compute answer confidence from retrieval and source signals.
 * Deterministic. Works when vector DB is down (topScore null).
 *
 * Rules:
 * - weak: warnings include "Insufficient trusted sources" OR usedSources.length === 0 OR topScore < 0.35
 * - strong: topScore >= 0.60 AND specSources >= 1 AND lessonSources >= 1 AND no weak warnings
 * - moderate: otherwise
 *
 * @param {{ usedSources: Array<{ sourceType: string, score?: number }>, retrievalScores?: number[], warnings?: string[] }} opts
 * @returns {{ confidenceLevel: "strong"|"moderate"|"weak", confidenceReason: string, confidenceSignals: object }}
 */
function computeConfidence(opts = {}) {
  const usedSources = opts?.usedSources || [];
  const retrievalScores = opts?.retrievalScores || [];
  const warnings = opts?.warnings || [];

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

  let confidenceLevel = "moderate";
  let confidenceReason = "Some curriculum sources support this answer.";

  // PR-021: Only external sources (no spec/lesson) → confidence stays weak
  if (externalSources >= 1 && !hasSpecOrLesson) {
    confidenceLevel = "weak";
    confidenceReason = "External references found (exploratory). Course content is still thin.";
  } else if (
    hasWeakWarning ||
    totalSources === 0 ||
    (topScore != null && topScore < 0.35)
  ) {
    confidenceLevel = "weak";
    confidenceReason = "Not enough trusted curriculum sources were found.";
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
