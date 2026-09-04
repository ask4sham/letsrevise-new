/**
 * Block 28 Practice Questions — shared type policy and short mark-scheme invariant.
 * Used by backend routes/utils; mirrored in frontend/src/lib/block28PracticePolicy.ts.
 */

const BLOCK28_SUPPORTED_TYPES = new Set(["mcq", "short"]);
const BLOCK28_UNSUPPORTED_TYPES = new Set(["composite", "label", "table", "data"]);

const BLOCK28_UNSUPPORTED_ATTACH_MESSAGE =
  "This question type cannot be attached as a Practice Question. Only multiple choice (MCQ) and short answer questions are supported in Block 28.";

const BLOCK28_UNSUPPORTED_TYPE_EDITOR_MESSAGE =
  "This question type is managed in the Question Bank.";

function normalizeBlock28Type(type) {
  return String(type || "")
    .trim()
    .toLowerCase();
}

function isBlock28SupportedType(type) {
  return BLOCK28_SUPPORTED_TYPES.has(normalizeBlock28Type(type));
}

function isBlock28UnsupportedType(type) {
  const t = normalizeBlock28Type(type);
  return BLOCK28_UNSUPPORTED_TYPES.has(t) || (t !== "" && !BLOCK28_SUPPORTED_TYPES.has(t));
}

function normalizeMarkSchemeLines(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((line) => String(line ?? "").trim()).filter(Boolean);
}

/**
 * Short-question invariant: marks === count of non-empty markScheme lines.
 * @returns {{ ok: true, marks: number, markScheme: string[] } | { ok: false, msg: string, code?: string }}
 */
function validateShortMarksMarkSchemeInvariant(marksInput, markSchemeRaw) {
  let marks = marksInput;
  if (typeof marks === "string" && marks.trim() !== "") {
    marks = parseInt(marks, 10);
  }
  if (!Number.isFinite(marks) || marks < 1) {
    return {
      ok: false,
      code: "INVALID_MARKS",
      msg: "marks must be an integer >= 1",
    };
  }
  marks = Math.trunc(marks);
  const markScheme = normalizeMarkSchemeLines(markSchemeRaw);
  if (markScheme.length !== marks) {
    return {
      ok: false,
      code: "MARK_SCHEME_COUNT_MISMATCH",
      msg:
        marks === 1
          ? "Short questions worth 1 mark need exactly 1 mark-scheme point."
          : `Short questions worth ${marks} marks need exactly ${marks} mark-scheme points (found ${markScheme.length}).`,
    };
  }
  return { ok: true, marks, markScheme };
}

/** Drop Block 28 unsupported practice rows (legacy attachments may still exist on lessons). */
function filterBlock28SupportedPracticeQuestions(questions) {
  return (questions || []).filter((q) => isBlock28SupportedType(q?.type));
}

module.exports = {
  BLOCK28_SUPPORTED_TYPES,
  BLOCK28_UNSUPPORTED_TYPES,
  BLOCK28_SUPPORTED_TYPE_LIST: [...BLOCK28_SUPPORTED_TYPES],
  BLOCK28_UNSUPPORTED_ATTACH_MESSAGE,
  BLOCK28_UNSUPPORTED_TYPE_EDITOR_MESSAGE,
  normalizeBlock28Type,
  isBlock28SupportedType,
  isBlock28UnsupportedType,
  normalizeMarkSchemeLines,
  validateShortMarksMarkSchemeInvariant,
  filterBlock28SupportedPracticeQuestions,
};
