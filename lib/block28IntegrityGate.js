/**
 * Block 28 Integrity Gate V2 — shared pre-save / pre-attach validation.
 * Does not pad, truncate, or invent mark-scheme points.
 */
const {
  normalizeMarkSchemeLines,
  validateShortMarksMarkSchemeInvariant,
  isBlock28SupportedType,
  isBlock28UnsupportedType,
  BLOCK28_UNSUPPORTED_ATTACH_MESSAGE,
} = require("./block28PracticePolicy");

const GATE_CODES = Object.freeze({
  INVALID_MARKS: "INVALID_MARKS",
  MARK_SCHEME_COUNT_MISMATCH: "MARK_SCHEME_COUNT_MISMATCH",
  UNSUPPORTED_TYPE: "UNSUPPORTED_TYPE",
  EMPTY_SCHEME_POINT: "EMPTY_SCHEME_POINT",
  INVALID_LESSON_EDIT: "INVALID_LESSON_EDIT",
});

/**
 * Validate a Block 28 short question before persistence.
 * @returns {{ ok: true, marks: number, markScheme: string[] } | { ok: false, code: string, msg: string }}
 */
function validateBlock28ShortForPersist({ marks, markScheme, type = "short" }) {
  const t = String(type || "short").toLowerCase();
  if (t !== "short") {
    return { ok: true, marks: marks ?? null, markScheme: normalizeMarkSchemeLines(markScheme) };
  }
  const schemeCheck = validateShortMarksMarkSchemeInvariant(marks, markScheme);
  if (!schemeCheck.ok) {
    return { ok: false, code: schemeCheck.code || GATE_CODES.MARK_SCHEME_COUNT_MISMATCH, msg: schemeCheck.msg };
  }
  return { ok: true, marks: schemeCheck.marks, markScheme: schemeCheck.markScheme };
}

/**
 * Validate effective short content before Block 28 attach.
 * @param {{ type?: string, marks?: number, markScheme?: unknown, question?: string }} effective
 */
function validateBlock28ShortForAttach(effective) {
  const type = String(effective?.type || "short").toLowerCase();
  if (isBlock28UnsupportedType(type)) {
    return {
      ok: false,
      code: GATE_CODES.UNSUPPORTED_TYPE,
      msg: BLOCK28_UNSUPPORTED_ATTACH_MESSAGE,
    };
  }
  if (type !== "short") {
    return { ok: true };
  }
  const schemeCheck = validateBlock28ShortForPersist({
    marks: effective.marks,
    markScheme: effective.markScheme,
    type: "short",
  });
  if (!schemeCheck.ok) {
    return schemeCheck;
  }
  if (!String(effective.question || "").trim()) {
    return { ok: false, code: GATE_CODES.INVALID_LESSON_EDIT, msg: "Short question stem is required" };
  }
  return { ok: true, marks: schemeCheck.marks, markScheme: schemeCheck.markScheme };
}

/**
 * Validate master (+ optional lessonEdit ref) before Block 28 attach.
 */
function validateBlock28MasterForAttach(master, ref = null) {
  if (!master) {
    return { ok: false, code: "MASTER_NOT_FOUND", msg: "Exam question not found" };
  }
  const type = String(master.type || "").toLowerCase();
  if (!isBlock28SupportedType(type)) {
    return {
      ok: false,
      code: GATE_CODES.UNSUPPORTED_TYPE,
      msg: BLOCK28_UNSUPPORTED_ATTACH_MESSAGE,
      type: master.type,
    };
  }
  if (type !== "short") {
    return { ok: true };
  }
  const { mergeExamQuestionForPractice } = require("../backend/utils/mergeExamQuestionLessonEdit");
  const effective = mergeExamQuestionForPractice(master, ref || {});
  return validateBlock28ShortForAttach(effective);
}

module.exports = {
  GATE_CODES,
  validateBlock28ShortForPersist,
  validateBlock28ShortForAttach,
  validateBlock28MasterForAttach,
};
