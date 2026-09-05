/**
 * Normalize LLM / content-pack output for Exam Question Bank inserts.
 * Only items that already satisfy publish-readiness are returned (strict bank hygiene).
 */
const { validateExamQuestionPublishReadiness } = require("./examQuestionPublishValidation");
const {
  normalizeMarkSchemeLines,
  validateShortMarksMarkSchemeInvariant,
} = require("../../lib/block28PracticePolicy");

const GENERATED_EXAM_REJECT = {
  MCQ: "mcq",
  MISSING_QUESTION: "missing_question",
  MARK_SCHEME_COUNT_MISMATCH: "mark_scheme_count_mismatch",
  PUBLISH_NOT_READY: "publish_not_ready",
};

function parseGeneratedExamQuestionRaw(eq) {
  const rawType = String(eq?.type || "").toLowerCase();
  if (rawType === "mcq") return { reject: GENERATED_EXAM_REJECT.MCQ };
  const opts = eq?.options;
  if (Array.isArray(opts) && opts.length > 0) return { reject: GENERATED_EXAM_REJECT.MCQ };

  const question = String(eq?.question || "").trim();
  if (!question) return { reject: GENERATED_EXAM_REJECT.MISSING_QUESTION };

  let lines = [];
  if (Array.isArray(eq?.markScheme)) {
    lines = eq.markScheme.map((x) => String(x || "").trim()).filter(Boolean);
  } else if (eq?.markScheme != null && String(eq.markScheme).trim()) {
    lines = String(eq.markScheme)
      .split(/\n|;/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const marks = Math.min(10, Math.max(2, Number(eq?.marks) || 4));
  const modelAnswer = String(eq?.modelAnswer || eq?.correctAnswer || "").trim();
  const markScheme = lines.length ? lines : modelAnswer ? [modelAnswer] : [];

  return { question, marks, markScheme, modelAnswer, raw: eq };
}

/**
 * @param {object} eq
 * @returns {{ ok: true, value: { question: string, marks: number, markScheme: string[], modelAnswer: string } } | { ok: false, code: string, msg?: string, marks?: number, markSchemeCount?: number, raw: object }}
 */
function tryNormalizeGeneratedExamQuestionForBank(eq) {
  const parsed = parseGeneratedExamQuestionRaw(eq);
  if (parsed.reject) {
    return {
      ok: false,
      code: parsed.reject,
      msg: parsed.reject,
      raw: eq,
    };
  }

  const { question, marks, markScheme, modelAnswer } = parsed;
  const schemeCheck = validateShortMarksMarkSchemeInvariant(marks, markScheme);
  if (!schemeCheck.ok) {
    return {
      ok: false,
      code: GENERATED_EXAM_REJECT.MARK_SCHEME_COUNT_MISMATCH,
      msg: schemeCheck.msg,
      marks: schemeCheck.marks ?? marks,
      markSchemeCount: normalizeMarkSchemeLines(markScheme).length,
      raw: eq,
    };
  }

  const docLike = {
    type: "short",
    marks: schemeCheck.marks,
    question,
    markScheme: schemeCheck.markScheme,
    correctAnswer: modelAnswer || null,
    topicKey: String(eq?.topicKey || "").trim() || undefined,
    metadata: eq?.metadata && typeof eq.metadata === "object" ? eq.metadata : {},
  };

  const ready = validateExamQuestionPublishReadiness(docLike);
  if (!ready.ok) {
    return {
      ok: false,
      code: GENERATED_EXAM_REJECT.PUBLISH_NOT_READY,
      msg: ready.msg,
      raw: eq,
    };
  }

  return {
    ok: true,
    value: {
      question,
      marks: schemeCheck.marks,
      markScheme: docLike.markScheme,
      modelAnswer: modelAnswer || String(docLike.correctAnswer || "").trim(),
    },
  };
}

/**
 * @param {object} eq - raw exam item from LLM (question, marks, markScheme string|array, modelAnswer?)
 * @returns {null | { question: string, marks: number, markScheme: string[], modelAnswer: string }}
 */
function normalizeGeneratedExamQuestionForBank(eq) {
  const attempt = tryNormalizeGeneratedExamQuestionForBank(eq);
  return attempt.ok ? attempt.value : null;
}

module.exports = {
  GENERATED_EXAM_REJECT,
  parseGeneratedExamQuestionRaw,
  tryNormalizeGeneratedExamQuestionForBank,
  normalizeGeneratedExamQuestionForBank,
};
