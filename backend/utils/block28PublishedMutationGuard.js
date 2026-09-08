/**
 * Block 28 — anti-regression guard for already-published lessons with a clean served set.
 * Legacy-invalid published lessons remain editable for remediation.
 */
const { validateBlock28LessonPublishIntegrity } = require("./block28PublishIntegrity");

const REPAIR_PROPOSAL_STATUS = Object.freeze({
  GENERIC: "GENERIC",
  GOLDEN_ALIGNED: "GOLDEN_ALIGNED",
  GOLDEN_AUTHORITATIVE: "GOLDEN_AUTHORITATIVE",
  CANONICAL_READONLY: "CANONICAL_READONLY",
  BLOCKED: "BLOCKED",
});

function isPublishedLesson(lesson) {
  if (!lesson) return false;
  return lesson.isPublished === true || String(lesson.status || "").toLowerCase() === "published";
}

function cloneLessonExamQuestions(lesson) {
  return JSON.parse(JSON.stringify(lesson?.examQuestions || []));
}

function simulateLessonAfterAttach(lesson, questionIds) {
  const refs = cloneLessonExamQuestions(lesson);
  const existing = new Set(refs.map((r) => String(r.questionId)));
  for (const qid of questionIds) {
    const id = String(qid);
    if (!existing.has(id)) {
      refs.push({ questionId: id });
      existing.add(id);
    }
  }
  return { ...lesson, examQuestions: refs };
}

function simulateLessonAfterDetach(lesson, questionId) {
  const refs = (lesson.examQuestions || []).filter((r) => String(r.questionId) !== String(questionId));
  return { ...lesson, examQuestions: refs };
}

/**
 * @param {object} lesson
 * @param {Array<{ questionId: string, lessonEdit: object|null }>} appliedEdits
 */
function simulateLessonAfterLessonEdits(lesson, appliedEdits) {
  const refs = cloneLessonExamQuestions(lesson);
  for (const item of appliedEdits) {
    const qid = String(item.questionId);
    const idx = refs.findIndex((r) => String(r.questionId) === qid);
    if (idx < 0) continue;
    if (item.lessonEdit === null || item.lessonEdit === undefined) {
      refs[idx].lessonEdit = undefined;
    } else {
      refs[idx].lessonEdit = item.lessonEdit;
    }
  }
  return { ...lesson, examQuestions: refs };
}

/**
 * Published lessons that are already Block-28-clean cannot regress via mutation.
 * Published lessons that are legacy-invalid remain editable for remediation.
 *
 * @param {object} lessonBefore
 * @param {object} lessonAfter
 * @param {Map<string, object>} mastersById
 * @param {number} [limit=10]
 */
function validateBlock28NoRegressionOnPublishedLesson(lessonBefore, lessonAfter, mastersById, limit = 10) {
  if (!isPublishedLesson(lessonBefore)) {
    return { ok: true, skipped: true, reason: "NOT_PUBLISHED" };
  }

  const beforeCheck = validateBlock28LessonPublishIntegrity(lessonBefore, mastersById, limit);
  if (!beforeCheck.ok) {
    return {
      ok: true,
      skipped: true,
      reason: "LEGACY_INVALID_PUBLISHED",
      beforeIssues: beforeCheck.issues,
    };
  }

  const afterCheck = validateBlock28LessonPublishIntegrity(lessonAfter, mastersById, limit);
  if (!afterCheck.ok) {
    return {
      ok: false,
      reason: "BLOCK28_REGRESSION",
      msg:
        "This published lesson has a clean Block 28 Practice set — this change would make the student-served practice invalid.",
      beforeServedCount: beforeCheck.servedCount,
      afterIssues: afterCheck.issues,
    };
  }

  return { ok: true, reason: "CLEAN_PUBLISHED_PRESERVED" };
}

/**
 * Published lessons with a clean served set cannot regress when an attached master changes.
 * Used by Question Bank UPDATE when the master is already attached to published lessons.
 *
 * @param {object} lesson
 * @param {Map<string, object>} mastersByIdBefore
 * @param {Map<string, object>} mastersByIdAfter
 * @param {number} [limit=10]
 */
function validateBlock28NoRegressionOnPublishedLessonMasters(
  lesson,
  mastersByIdBefore,
  mastersByIdAfter,
  limit = 10
) {
  if (!isPublishedLesson(lesson)) {
    return { ok: true, skipped: true, reason: "NOT_PUBLISHED" };
  }

  const beforeCheck = validateBlock28LessonPublishIntegrity(lesson, mastersByIdBefore, limit);
  if (!beforeCheck.ok) {
    return {
      ok: true,
      skipped: true,
      reason: "LEGACY_INVALID_PUBLISHED",
      beforeIssues: beforeCheck.issues,
    };
  }

  const afterCheck = validateBlock28LessonPublishIntegrity(lesson, mastersByIdAfter, limit);
  if (!afterCheck.ok) {
    return {
      ok: false,
      reason: "BLOCK28_REGRESSION",
      msg:
        "This question is attached to a published lesson with a clean Block 28 Practice set — this master update would make the served practice invalid.",
      lessonId: String(lesson._id || ""),
      afterIssues: afterCheck.issues,
    };
  }

  return { ok: true, reason: "CLEAN_PUBLISHED_PRESERVED" };
}

module.exports = {
  REPAIR_PROPOSAL_STATUS,
  isPublishedLesson,
  simulateLessonAfterAttach,
  simulateLessonAfterDetach,
  simulateLessonAfterLessonEdits,
  validateBlock28NoRegressionOnPublishedLesson,
  validateBlock28NoRegressionOnPublishedLessonMasters,
};
