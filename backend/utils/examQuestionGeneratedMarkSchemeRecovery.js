/**

 * Bounded recovery when AI-generated short exam questions fail marks/markScheme invariant.

 * At most ONE corrective LLM regeneration per item.

 */

const { callOpenAiJson } = require("./lessonAssetLlm");
const { validateShortMarksMarkSchemeInvariant, normalizeMarkSchemeLines } = require("../../lib/block28PracticePolicy");

const {

  GENERATED_EXAM_REJECT,

  parseGeneratedExamQuestionRaw,

  tryNormalizeGeneratedExamQuestionForBank,

} = require("./examQuestionBankGeneratedItem");



const CORRECTIVE_SYSTEM = `You correct UK GCSE exam-style short-answer questions for the Exam Question Bank.

Reply with ONLY JSON:

{"question":"string","marks":number,"markScheme":["point1","point2"],"modelAnswer":"string"}

Rules:

- type is always short written answer; no MCQ options.

- marks must stay the same as requested.

- markScheme must contain exactly as many non-empty bullets as marks.

- Each bullet is one distinct, independently awardable one-mark point.

- British English.`;



function buildCorrectiveRegenerationUserPrompt(eq, marks) {

  const parsed = parseGeneratedExamQuestionRaw(eq);

  const question = parsed.reject ? String(eq?.question || "").trim() : parsed.question;

  const modelAnswer = parsed.reject ? String(eq?.modelAnswer || eq?.correctAnswer || "").trim() : parsed.modelAnswer;

  const markScheme = parsed.reject

    ? Array.isArray(eq?.markScheme)

      ? eq.markScheme

      : String(eq?.markScheme || "")

    : parsed.markScheme;



  return `Fix the mark scheme for this GCSE short-answer exam question.



This question is worth ${marks} marks. Return exactly ${marks} distinct, independently awardable one-mark mark-scheme points.



Keep the same marks value (${marks}). Do not change the question stem unless required for clarity.



Question: ${question}

Marks: ${marks}

Current markScheme: ${JSON.stringify(markScheme)}

Model answer: ${modelAnswer}`;

}



/**

 * @param {object} eq

 * @returns {Promise<object>}

 */

async function regenerateShortExamQuestionMarkScheme(eq) {

  const parsed = parseGeneratedExamQuestionRaw(eq);

  const marks = parsed.reject === GENERATED_EXAM_REJECT.MARK_SCHEME_COUNT_MISMATCH

    ? parsed.marks

    : parsed.reject

      ? Math.min(10, Math.max(2, Number(eq?.marks) || 4))

      : parsed.marks;



  const out = await callOpenAiJson({

    system: CORRECTIVE_SYSTEM,

    user: buildCorrectiveRegenerationUserPrompt(eq, marks),

    temperature: 0.2,

  });



  const candidate = out?.examQuestion && typeof out.examQuestion === "object" ? out.examQuestion : out;

  return {

    ...eq,

    type: "short",

    question: candidate?.question ?? eq?.question,

    marks: candidate?.marks ?? marks,

    markScheme: candidate?.markScheme ?? eq?.markScheme,

    modelAnswer: candidate?.modelAnswer ?? candidate?.correctAnswer ?? eq?.modelAnswer ?? eq?.correctAnswer,

    options: [],

  };

}



/**

 * @param {object} rawEq

 * @param {{ allowCorrectiveRetry?: boolean, regenerate?: (eq: object) => Promise<object> }} [opts]

 */

function tryNormalizeShortExamQuestionMarks(eq) {
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

  return {
    ok: true,
    value: {
      question,
      marks: schemeCheck.marks,
      markScheme: schemeCheck.markScheme,
      modelAnswer,
    },
  };
}

async function resolveGeneratedShortExamQuestionMarks(rawEq, opts = {}) {
  const allowCorrectiveRetry = opts.allowCorrectiveRetry !== false;
  const regenerate = opts.regenerate || regenerateShortExamQuestionMarkScheme;
  const tryNormalize = opts.tryNormalize || tryNormalizeShortExamQuestionMarks;

  const first = tryNormalize(rawEq);
  if (first.ok) {
    return { ok: true, normalized: first.value, retried: false };
  }

  if (allowCorrectiveRetry && first.code === GENERATED_EXAM_REJECT.MARK_SCHEME_COUNT_MISMATCH) {
    let regenerated = rawEq;
    try {
      regenerated = await regenerate(rawEq);
    } catch (err) {
      return {
        ok: false,
        incomplete: true,
        retried: true,
        code: GENERATED_EXAM_REJECT.MARK_SCHEME_COUNT_MISMATCH,
        msg: err.message || "Corrective regeneration failed",
        marks: first.marks,
        raw: rawEq,
      };
    }
    const second = tryNormalize(regenerated);
    if (second.ok) {
      return { ok: true, normalized: second.value, retried: true };
    }
    return {
      ok: false,
      incomplete: true,
      retried: true,
      code: GENERATED_EXAM_REJECT.MARK_SCHEME_COUNT_MISMATCH,
      msg:
        second.msg ||
        `Could not generate a valid ${first.marks}-mark short question after corrective retry.`,
      marks: first.marks,
      raw: rawEq,
    };
  }

  return {
    ok: false,
    incomplete: false,
    retried: false,
    code: first.code,
    msg: first.msg,
    raw: rawEq,
  };
}

async function resolveGeneratedExamQuestionForBank(rawEq, opts = {}) {
  const allowCorrectiveRetry = opts.allowCorrectiveRetry !== false;
  const regenerate = opts.regenerate || regenerateShortExamQuestionMarkScheme;

  const first = tryNormalizeGeneratedExamQuestionForBank(rawEq);
  if (first.ok) {
    return { ok: true, normalized: first.value, retried: false };
  }

  if (
    allowCorrectiveRetry &&
    first.code === GENERATED_EXAM_REJECT.MARK_SCHEME_COUNT_MISMATCH
  ) {
    let regenerated = rawEq;
    try {
      regenerated = await regenerate(rawEq);
    } catch (err) {
      return {
        ok: false,
        incomplete: true,
        retried: true,
        code: GENERATED_EXAM_REJECT.MARK_SCHEME_COUNT_MISMATCH,
        msg: err.message || "Corrective regeneration failed",
        marks: first.marks,
        raw: rawEq,
      };
    }
    const second = tryNormalizeGeneratedExamQuestionForBank(regenerated);

    if (second.ok) {

      return { ok: true, normalized: second.value, retried: true };

    }

    return {

      ok: false,

      incomplete: true,

      retried: true,

      code: GENERATED_EXAM_REJECT.MARK_SCHEME_COUNT_MISMATCH,

      msg:

        second.msg ||

        `Could not generate a valid ${first.marks}-mark short question after corrective retry.`,

      marks: first.marks,

      raw: rawEq,

    };

  }



  return {

    ok: false,

    incomplete: false,

    retried: false,

    code: first.code,

    msg: first.msg,

    raw: rawEq,

  };

}



class GeneratedExamQuestionSetIncompleteError extends Error {

  constructor({ expectedCount, persistedCount, failures }) {

    const failedMarks = (failures || [])

      .map((f) => f.marks)

      .filter((m) => m != null)

      .join(", ");

    super(

      `Generated exam question set incomplete: persisted ${persistedCount}${

        expectedCount != null ? ` of ${expectedCount} requested` : ""

      }. Mark-scheme corrective retry failed for ${failures?.length || 0} item(s)${

        failedMarks ? ` (${failedMarks}-mark)` : ""

      }.`

    );

    this.name = "GeneratedExamQuestionSetIncompleteError";

    this.code = "GENERATED_EXAM_QUESTION_SET_INCOMPLETE";

    this.expectedCount = expectedCount;

    this.persistedCount = persistedCount;

    this.failures = failures || [];

  }

}



/**

 * @param {{ items: object[], expectedCount?: number, allowCorrectiveRetry?: boolean, regenerate?: Function, persist: (normalized: object, rawEq: object, meta: { retried: boolean }) => Promise<*> }} opts

 */

async function persistGeneratedExamQuestionBatch(opts) {

  const {

    items = [],

    expectedCount,

    allowCorrectiveRetry = true,

    regenerate,

    persist,

  } = opts;



  const persisted = [];

  const incompleteFailures = [];

  const skipped = [];



  for (const rawEq of items) {

    const resolved = await resolveGeneratedExamQuestionForBank(rawEq, {

      allowCorrectiveRetry,

      regenerate,

    });

    if (resolved.ok) {

      const id = await persist(resolved.normalized, rawEq, { retried: resolved.retried });

      persisted.push({ id, retried: resolved.retried, normalized: resolved.normalized });

      continue;

    }

    if (resolved.incomplete) {

      incompleteFailures.push(resolved);

      continue;

    }

    skipped.push(resolved);

  }



  const result = {

    persisted,

    incompleteFailures,

    skipped,

    persistedCount: persisted.length,

    complete: incompleteFailures.length === 0,

  };



  if (incompleteFailures.length > 0) {

    result.error = new GeneratedExamQuestionSetIncompleteError({

      expectedCount,

      persistedCount: persisted.length,

      failures: incompleteFailures,

    });

  }



  return result;

}



module.exports = {

  CORRECTIVE_SYSTEM,

  buildCorrectiveRegenerationUserPrompt,

  regenerateShortExamQuestionMarkScheme,
  tryNormalizeShortExamQuestionMarks,
  resolveGeneratedShortExamQuestionMarks,
  resolveGeneratedExamQuestionForBank,

  persistGeneratedExamQuestionBatch,

  GeneratedExamQuestionSetIncompleteError,

};


