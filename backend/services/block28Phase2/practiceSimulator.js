/**
 * Block 28 Phase 2 — in-memory /practice effective-state simulator (read-only).
 */
const {
  filterBlock28SupportedPracticeQuestions,
  validateShortMarksMarkSchemeInvariant,
  normalizeMarkSchemeLines,
} = require("../../../lib/block28PracticePolicy");
const { mergeExamQuestionForPractice } = require("../../utils/mergeExamQuestionLessonEdit");
const { filterDistinctPracticeExamQuestions } = require("../../../lib/teacherBrain/examAwarePractice");
const { lessonEditFingerprint, effectivePracticeFingerprint } = require("./fingerprints");

function cloneMaster(master) {
  return JSON.parse(JSON.stringify(master));
}

function applyInMemoryMarkScheme(master, proposedMarkScheme) {
  const clone = cloneMaster(master);
  clone.markScheme = [...proposedMarkScheme];
  return clone;
}

/**
 * Simulate GET /practice pipeline for a lesson (in-memory only).
 */
function simulateLessonPractice(lesson, mastersById, limit = 10) {
  const refs = Array.isArray(lesson.examQuestions) ? lesson.examQuestions : [];
  const merged = refs
    .map((ref, index) => {
      const master = mastersById.get(String(ref.questionId)) || null;
      try {
        const effective = mergeExamQuestionForPractice(master, ref);
        return effective ? { ref, index, effective, master } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const supported = filterBlock28SupportedPracticeQuestions(merged.map((m) => m.effective));
  const supportedIds = new Set(supported.map((q) => q.id));
  const supportedRows = merged.filter((m) => supportedIds.has(m.effective.id));

  const deduped = filterDistinctPracticeExamQuestions(
    supported.map((q) => ({ ...q, _id: q.id })),
    { embeddedIds: new Set(), fingerprints: new Set(), limit, semanticFingerprintDedup: false }
  );

  const practiceIds = deduped.map((q) => String(q.id || q._id));

  return {
    attachmentOrder: refs.map((r) => String(r.questionId)),
    practiceIds,
    practiceCount: practiceIds.length,
    rows: supportedRows.map(({ ref, index, effective, master }) => {
      const scheme = normalizeMarkSchemeLines(effective.markScheme);
      const inv = validateShortMarksMarkSchemeInvariant(effective.marks, effective.markScheme || []);
      return {
        position: index + 1,
        questionId: String(ref.questionId),
        masterType: master?.type || null,
        effectiveQuestion: effective.question,
        effectiveMarks: effective.marks,
        effectiveMarkScheme: scheme,
        effectiveSchemePointCount: scheme.length,
        effectiveAligned: inv.ok === true,
        lessonEditFingerprint: lessonEditFingerprint(ref.lessonEdit),
        effectiveFingerprint: effectivePracticeFingerprint(effective),
      };
    }),
  };
}

/**
 * Simulate repair impact for one master across all referencing lessons.
 */
function simulateRepairImpact({
  master,
  proposedMarkScheme,
  lessonsById,
  mastersById,
  limit = 10,
}) {
  const questionId = String(master._id || master.questionId);
  const repairedMaster = applyInMemoryMarkScheme(
    {
      _id: questionId,
      ...master,
      questionId,
    },
    proposedMarkScheme
  );

  const mastersAfter = new Map(mastersById);
  mastersAfter.set(questionId, repairedMaster);

  const lessonImpacts = [];

  for (const [lessonId, lesson] of lessonsById.entries()) {
    const refs = lesson.examQuestions || [];
    const usesMaster = refs.some((r) => String(r.questionId) === questionId);
    if (!usesMaster) continue;

    const before = simulateLessonPractice(lesson, mastersById, limit);
    const after = simulateLessonPractice(lesson, mastersAfter, limit);

    const beforeRow = before.rows.find((r) => r.questionId === questionId);
    const afterRow = after.rows.find((r) => r.questionId === questionId);

    lessonImpacts.push({
      lessonId,
      lessonTitle: lesson.title || null,
      attachmentOrderUnchanged:
        JSON.stringify(before.attachmentOrder) === JSON.stringify(after.attachmentOrder),
      practiceIdsBefore: before.practiceIds,
      practiceIdsAfter: after.practiceIds,
      practiceCountBefore: before.practiceCount,
      practiceCountAfter: after.practiceCount,
      effectiveContentChanged:
        beforeRow?.effectiveFingerprint !== afterRow?.effectiveFingerprint,
      mismatchResolved:
        beforeRow?.effectiveAligned === false && afterRow?.effectiveAligned === true,
      before: beforeRow || null,
      after: afterRow || null,
      lessonEditFingerprintsUnchanged: before.rows.every((row, i) => {
        const afterRowAt = after.rows.find((r) => r.position === row.position);
        return row.lessonEditFingerprint === afterRowAt?.lessonEditFingerprint;
      }),
    });
  }

  return {
    questionId,
    lessonImpacts,
    anyEffectiveContentChanged: lessonImpacts.some((l) => l.effectiveContentChanged),
    allMismatchesResolved: lessonImpacts.every(
      (l) => !l.before || l.mismatchResolved || l.before.effectiveAligned
    ),
    multiLessonApprovalRequired: lessonImpacts.length > 1,
  };
}

module.exports = {
  cloneMaster,
  applyInMemoryMarkScheme,
  simulateLessonPractice,
  simulateRepairImpact,
};
