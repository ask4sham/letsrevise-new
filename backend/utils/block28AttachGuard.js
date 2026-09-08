/**
 * Block 28 — pre-attach validation for lesson Practice attachments.
 */
const { BLOCK28_UNSUPPORTED_ATTACH_MESSAGE } = require("../../lib/block28PracticePolicy");
const { validateBlock28MasterForAttach } = require("../../lib/block28IntegrityGate");
const { wouldBlock28RegenerationDuplicateAttach } = require("./block28RegenerationDuplicateGuard");

/**
 * @param {object[]} masters - full ExamQuestion docs
 * @param {object} lesson - lesson with examQuestions refs
 * @param {Map<string, object>} [mastersById] - all masters for duplicate check
 */
function validateMastersForBlock28Attach(masters, lesson = null, mastersById = null) {
  const refs = Array.isArray(lesson?.examQuestions) ? lesson.examQuestions : [];
  const errors = [];

  for (const master of masters) {
    const ref = refs.find((r) => String(r.questionId) === String(master._id));
    const attachCheck = validateBlock28MasterForAttach(master, ref);
    if (!attachCheck.ok) {
      errors.push({
        questionId: String(master._id),
        code: attachCheck.code,
        msg: attachCheck.msg,
        type: master.type,
      });
      continue;
    }

    if (lesson && mastersById) {
      const dup = wouldBlock28RegenerationDuplicateAttach(lesson, master, mastersById, ref);
      if (dup.duplicate) {
        errors.push({
          questionId: String(master._id),
          code: "BLOCK28_REGEN_DUPLICATE",
          msg: dup.reason === "EXACT_TEXT"
            ? "This question is already attached to this lesson."
            : "This question is a conceptual duplicate of an existing Practice attachment.",
          duplicateOf: dup.duplicateOf,
        });
      }
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      msg: errors.some((e) => e.code === "UNSUPPORTED_TYPE")
        ? BLOCK28_UNSUPPORTED_ATTACH_MESSAGE
        : "One or more questions cannot be attached to Block 28 Practice.",
      errors,
    };
  }
  return { ok: true };
}

module.exports = {
  validateMastersForBlock28Attach,
};
