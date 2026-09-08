/**
 * Block 28 — forward publish integrity gate for newly published/republished lessons.
 * Does not unpublish legacy lessons.
 */
const { simulateLessonPractice } = require("../services/block28Phase2/practiceSimulator");
const { mergeExamQuestionForPractice } = require("./mergeExamQuestionLessonEdit");
const { isBlock28SupportedType } = require("../../lib/block28PracticePolicy");
const { validateBlock28ShortForAttach } = require("../../lib/block28IntegrityGate");

/**
 * @param {object} lesson
 * @param {Map<string, object>} mastersById
 * @param {number} [limit=10]
 */
function validateBlock28LessonPublishIntegrity(lesson, mastersById, limit = 10) {
  const issues = [];
  const sim = simulateLessonPractice(lesson, mastersById, limit);
  const practiceIds = sim.practiceIds || [];
  const idSet = new Set();

  for (const qid of practiceIds) {
    if (idSet.has(qid)) {
      issues.push({ code: "DUPLICATE_SERVED_ID", questionId: qid, msg: "Duplicate question ID in student-served set" });
    }
    idSet.add(qid);

    const ref = (lesson.examQuestions || []).find((r) => String(r.questionId) === qid);
    const master = mastersById.get(qid);
    if (!master) {
      issues.push({ code: "MISSING_MASTER", questionId: qid, msg: "Served practice question master not found" });
      continue;
    }
    if (!isBlock28SupportedType(master.type)) {
      issues.push({
        code: "UNSUPPORTED_SERVED",
        questionId: qid,
        type: master.type,
        msg: "Unsupported question type would be served to students",
      });
      continue;
    }
    if (String(master.type).toLowerCase() === "short") {
      const effective = mergeExamQuestionForPractice(master, ref || {});
      const check = validateBlock28ShortForAttach(effective);
      if (!check.ok) {
        issues.push({
          code: check.code || "INVALID_SERVED_SHORT",
          questionId: qid,
          msg: check.msg,
        });
      }
      if (!effective.markScheme || effective.markScheme.length === 0) {
        issues.push({
          code: "EMPTY_SCHEME",
          questionId: qid,
          msg: "Student-served short has empty effective mark scheme",
        });
      }
    }
    if (ref?.lessonEdit) {
      try {
        const { validateExamQuestionLessonEdit } = require("./validateExamQuestionLessonEdit");
        validateExamQuestionLessonEdit(master, ref.lessonEdit);
      } catch (err) {
        issues.push({
          code: err.code || "INVALID_LESSON_EDIT",
          questionId: qid,
          msg: err.message,
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    servedCount: practiceIds.length,
    practiceIds,
  };
}

module.exports = {
  validateBlock28LessonPublishIntegrity,
};
