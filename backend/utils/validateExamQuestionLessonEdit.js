/**
 * Validate and sanitise lesson.examQuestions[].lessonEdit payloads.
 * Phase 2 v1: mcq and short only; type must match master (no conversion).
 */

const { deriveCorrectIndex, SUPPORTED_PRACTICE_TYPES } = require("./mergeExamQuestionLessonEdit");
const {
  BLOCK28_UNSUPPORTED_TYPES: UNSUPPORTED_MASTER_TYPES,
  normalizeMarkSchemeLines,
  validateShortMarksMarkSchemeInvariant,
} = require("../../lib/block28PracticePolicy");

function trimStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function normalizeMarkScheme(raw) {
  return normalizeMarkSchemeLines(raw);
}

function normalizeOptions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((o) => trimStr(o)).filter(Boolean);
}

/**
 * @param {object|null} master - ExamQuestion document
 * @param {object|null} lessonEditInput - request payload (null = undo)
 * @param {{ editedBy?: object|string }} opts
 * @returns {null|object} sanitised lessonEdit or null for undo
 */
function validateExamQuestionLessonEdit(master, lessonEditInput, opts = {}) {
  if (lessonEditInput === null || lessonEditInput === undefined) {
    return null;
  }

  if (!master || !master._id) {
    const err = new Error("Cannot save lessonEdit without a master ExamQuestion");
    err.code = "MASTER_REQUIRED";
    throw err;
  }

  const masterType = String(master.type || "");
  if (UNSUPPORTED_MASTER_TYPES.has(masterType) || !SUPPORTED_PRACTICE_TYPES.has(masterType)) {
    const err = new Error(`Question type "${masterType}" cannot be edited from a lesson`);
    err.code = "UNSUPPORTED_TYPE";
    throw err;
  }

  const inputType = trimStr(lessonEditInput.type) || masterType;
  if (inputType !== masterType) {
    const err = new Error(
      `lessonEdit.type must match master type "${masterType}"; cross-type conversion is not allowed`
    );
    err.code = "TYPE_MISMATCH";
    throw err;
  }

  const question = trimStr(lessonEditInput.question);
  if (!question) {
    const err = new Error("question is required");
    err.code = "INVALID_QUESTION";
    throw err;
  }

  let marks = lessonEditInput.marks;
  if (typeof marks === "string" && marks.trim() !== "") {
    marks = parseInt(marks, 10);
  }
  if (!Number.isFinite(marks) || marks < 1) {
    const err = new Error("marks must be an integer >= 1");
    err.code = "INVALID_MARKS";
    throw err;
  }
  marks = Math.trunc(marks);

  const out = {
    type: masterType,
    question,
    marks,
    editedAt: new Date(),
  };

  if (opts.editedBy) {
    out.editedBy = opts.editedBy;
  }

  if (masterType === "mcq") {
    const options = normalizeOptions(lessonEditInput.options);
    if (options.length < 2 || options.length > 6) {
      const err = new Error("MCQ requires 2–6 non-empty options");
      err.code = "INVALID_OPTIONS";
      throw err;
    }
    const correctAnswer = trimStr(lessonEditInput.correctAnswer);
    if (!correctAnswer) {
      const err = new Error("correctAnswer is required for MCQ");
      err.code = "INVALID_CORRECT_ANSWER";
      throw err;
    }
    const correctIndex = deriveCorrectIndex(options, correctAnswer);
    if (correctIndex < 0) {
      const err = new Error("correctAnswer must match exactly one option");
      err.code = "INVALID_CORRECT_ANSWER";
      throw err;
    }
    out.options = options;
    out.correctAnswer = correctAnswer;
    out.correctIndex = correctIndex;

    const markScheme = normalizeMarkScheme(lessonEditInput.markScheme);
    if (markScheme.length > 0) out.markScheme = markScheme;

    const explanation = trimStr(lessonEditInput.explanation);
    if (explanation) out.explanation = explanation;
  } else if (masterType === "short") {
    const schemeCheck = validateShortMarksMarkSchemeInvariant(marks, lessonEditInput.markScheme);
    if (!schemeCheck.ok) {
      const err = new Error(schemeCheck.msg);
      err.code = schemeCheck.code || "INVALID_MARK_SCHEME";
      throw err;
    }
    out.marks = schemeCheck.marks;
    out.markScheme = schemeCheck.markScheme;

    const correctAnswer = trimStr(lessonEditInput.correctAnswer);
    if (correctAnswer) out.correctAnswer = correctAnswer;

    const explanation = trimStr(lessonEditInput.explanation);
    if (explanation) out.explanation = explanation;
  }

  return out;
}

module.exports = {
  validateExamQuestionLessonEdit,
  UNSUPPORTED_MASTER_TYPES,
};
