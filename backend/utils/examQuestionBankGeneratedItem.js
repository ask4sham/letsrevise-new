/**
 * Normalize LLM / content-pack output for Exam Question Bank inserts.
 * Only items that already satisfy publish-readiness are returned (strict bank hygiene).
 */
const { validateExamQuestionPublishReadiness } = require("./examQuestionPublishValidation");

/**
 * @param {object} eq - raw exam item from LLM (question, marks, markScheme string|array, modelAnswer?)
 * @returns {null | { question: string, marks: number, markScheme: string[], modelAnswer: string }}
 */
function normalizeGeneratedExamQuestionForBank(eq) {
  const rawType = String(eq.type || "").toLowerCase();
  if (rawType === "mcq") return null;
  const opts = eq.options;
  if (Array.isArray(opts) && opts.length > 0) return null;

  const question = String(eq.question || "").trim();
  if (!question) return null;

  let lines = [];
  if (Array.isArray(eq.markScheme)) {
    lines = eq.markScheme.map((x) => String(x || "").trim()).filter(Boolean);
  } else if (eq.markScheme != null && String(eq.markScheme).trim()) {
    lines = String(eq.markScheme)
      .split(/\n|;/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const marks = Math.min(10, Math.max(2, Number(eq.marks) || 4));
  const modelAnswer = String(eq.modelAnswer || eq.correctAnswer || "").trim();
  const markScheme = lines.length ? lines : modelAnswer ? [modelAnswer] : [];

  const docLike = {
    type: "short",
    marks,
    question,
    markScheme,
    correctAnswer: modelAnswer || null,
    metadata: eq.metadata && typeof eq.metadata === "object" ? eq.metadata : {},
  };

  const ready = validateExamQuestionPublishReadiness(docLike);
  if (!ready.ok) return null;

  return {
    question,
    marks,
    markScheme: docLike.markScheme,
    modelAnswer: modelAnswer || String(docLike.correctAnswer || "").trim(),
  };
}

module.exports = { normalizeGeneratedExamQuestionForBank };
