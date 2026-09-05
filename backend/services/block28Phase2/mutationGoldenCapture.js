/**
 * Block 28 Phase 2 — Mutation lesson golden-state capture (read-only).
 * Captures positions 1–10 supported short /practice state for P2 safeguards.
 */
const { MUTATION_LESSON_ID } = require("./constants");
const { simulateLessonPractice } = require("./practiceSimulator");

/**
 * @param {object} lesson - Mutation lesson document
 * @param {Map<string, object>} mastersById
 * @param {number} [limit=10]
 */
function captureMutationGoldenState(lesson, mastersById, limit = 10) {
  const lessonId = String(lesson?._id || "");
  const simulation = simulateLessonPractice(lesson, mastersById, limit);

  const supportedShortPositions = simulation.rows
    .filter((r) => r.effectiveMarks != null)
    .slice(0, limit);

  return {
    lessonId: lessonId || MUTATION_LESSON_ID,
    capturedAt: new Date().toISOString(),
    practiceLimit: limit,
    practiceIds: simulation.practiceIds,
    practiceCount: simulation.practiceCount,
    positions: supportedShortPositions.map((row) => ({
      position: row.position,
      questionId: row.questionId,
      effectiveStem: row.effectiveQuestion,
      effectiveMarks: row.effectiveMarks,
      effectiveMarkScheme: row.effectiveMarkScheme,
      effectiveSchemePointCount: row.effectiveSchemePointCount,
      effectiveAligned: row.effectiveAligned,
      effectiveFingerprint: row.effectiveFingerprint,
    })),
    attachmentOrder: simulation.attachmentOrder,
    totalAttachments: (lesson.examQuestions || []).length,
  };
}

module.exports = {
  MUTATION_LESSON_ID,
  captureMutationGoldenState,
};
