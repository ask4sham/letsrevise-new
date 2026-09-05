/**
 * Block 28 Phase 2 — shared-master impact reporting (read-only).
 */

function buildSharedMasterImpactReport(masters, simulationsByQuestionId = {}) {
  const shared = masters.filter((m) => (m.lessonReferenceCount || 0) > 1);

  return shared.map((master) => {
    const simulation = simulationsByQuestionId[master.questionId] || null;
    const lessonImpacts = simulation?.lessonImpacts || master.publishedLessonRefs || [];

    return {
      questionId: master.questionId,
      totalRefs: master.lessonReferenceCount,
      affectedLessonTitles: (master.publishedLessonRefs || []).map((r) => r.lessonTitle),
      beforeAfterByLesson: lessonImpacts.map((impact) => ({
        lessonId: impact.lessonId,
        lessonTitle: impact.lessonTitle,
        before: impact.before || {
          effectiveMarks: impact.effectiveMarks,
          effectiveSchemePointCount: impact.effectiveSchemePointCount,
          effectiveAligned: impact.effectiveAligned,
        },
        after: impact.after || null,
        effectiveContentChanged: impact.effectiveContentChanged ?? null,
        maskingDifference: impact.before?.effectiveAligned === true && master.masterAligned === false,
      })),
      multiLessonApprovalRequired: true,
    };
  });
}

module.exports = { buildSharedMasterImpactReport };
