/**
 * Sanitize checkpoint / selfCheck / pageQuiz blocks without destroying V2 multi-question banks.
 * Legacy single-prompt blocks keep previous Option-filler behaviour when invalid.
 */

function trimStr(v) {
  return v == null ? "" : String(v).trim();
}

function isFillerOption(o) {
  return /^option\s*[1-4]$/i.test(trimStr(o)) || /^\[option\s*[1-4]\]$/i.test(trimStr(o));
}

/**
 * @param {unknown} raw
 * @param {number} index
 * @returns {object|null}
 */
function normalizeBankQuestion(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;
  const q = raw;
  const prompt = trimStr(q.prompt || q.question);
  if (prompt.length < 1) return null;

  const typeRaw = trimStr(q.questionType || q.type).toLowerCase();
  const questionType = typeRaw === "mcq" ? "mcq" : "short";
  const options = Array.isArray(q.options)
    ? q.options.map((o) => trimStr(o)).filter(Boolean).slice(0, 8)
    : [];
  const correctAnswer = trimStr(q.correctAnswer ?? q.answer);

  if (questionType === "mcq") {
    if (options.length < 2) return null;
    if (options.every(isFillerOption)) return null;
    if (correctAnswer && !options.some((o) => o.toLowerCase() === correctAnswer.toLowerCase())) {
      return null;
    }
  } else if (!correctAnswer) {
    return null;
  }

  if (/^which statement is correct\??$/i.test(prompt) && options.every(isFillerOption)) {
    return null;
  }

  const out = {
    id: trimStr(q.id) || `q${index + 1}`,
    prompt,
    question: prompt,
    questionType,
    type: questionType,
    options: questionType === "mcq" ? options : [],
    correctAnswer,
  };
  const purpose = trimStr(q.purpose);
  if (purpose) out.purpose = purpose;
  const marks = Number(q.marks);
  if (Number.isFinite(marks) && marks > 0) out.marks = marks;
  if (Array.isArray(q.tags)) {
    out.tags = q.tags.map((t) => trimStr(t)).filter(Boolean);
  }
  const explanation = trimStr(q.explanation);
  if (explanation) out.explanation = explanation.slice(0, 8000);
  if (q.metadata && typeof q.metadata === "object") out.metadata = q.metadata;
  return out;
}

/**
 * @param {unknown} questions
 * @returns {{ ok: true, questions: object[] } | { ok: false, reason: string }}
 */
function validateActivityQuestionBank(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, reason: "questions_missing" };
  }
  const normalized = [];
  for (let i = 0; i < questions.length; i += 1) {
    const n = normalizeBankQuestion(questions[i], i);
    if (!n) return { ok: false, reason: `question_${i}_invalid` };
    normalized.push(n);
  }
  return { ok: true, questions: normalized };
}

function legacyFillerBlock(type) {
  return {
    type,
    prompt: "Which statement is correct?",
    questionType: "mcq",
    options: ["Option 1", "Option 2", "Option 3", "Option 4"],
    correctAnswer: "Option 1",
    explanation: "",
  };
}

/**
 * Sanitize checkpoint or selfCheck block.
 * @param {object} b
 * @param {"checkpoint"|"selfCheck"} type
 * @returns {{ block: object } | { error: string, code: string }}
 */
function sanitizeCheckpointOrSelfCheckBlock(b, type) {
  const bank = validateActivityQuestionBank(b?.questions);
  if (bank.ok) {
    const first = bank.questions[0];
    const out = {
      type,
      prompt: first.prompt,
      questionType: first.questionType,
      options: first.questionType === "mcq" ? first.options.slice(0, 6) : [],
      correctAnswer: first.correctAnswer,
      questions: bank.questions,
    };
    if (typeof b?.explanation === "string" && b.explanation.trim()) {
      out.explanation = b.explanation.trim().slice(0, 8000);
    } else if (first.explanation) {
      out.explanation = first.explanation;
    }
    const markSchemeBlk = Array.isArray(b?.markScheme)
      ? b.markScheme.map((x) => String(x).trim()).filter(Boolean).slice(0, 20)
      : undefined;
    if (markSchemeBlk && markSchemeBlk.length) out.markScheme = markSchemeBlk;
    if (typeof b?.role === "string" && b.role.trim()) out.role = b.role.trim();
    return { block: out };
  }

  // Present but invalid multi-question bank → fail closed (do not inject Option 1–4).
  if (Array.isArray(b?.questions) && b.questions.length > 0) {
    return {
      error: `${type} questions[] is present but invalid (${bank.reason})`,
      code: "ACTIVITY_QUESTION_BANK_INVALID",
    };
  }

  // Legacy single-prompt path (unchanged behaviour for old lessons).
  const prompt = typeof b?.prompt === "string" ? b.prompt : "";
  const options = Array.isArray(b?.options) ? b.options.map((x) => String(x)).slice(0, 6) : [];
  const correctAnswer = typeof b?.correctAnswer === "string" ? b.correctAnswer : "";
  const questionType = b?.questionType === "short" ? "short" : "mcq";
  const nonEmptyOpts = options.filter((o) => String(o || "").trim());
  const hasPrompt = String(prompt || "").trim().length > 0;
  const isValidMcq =
    questionType === "mcq"
      ? nonEmptyOpts.length >= 2 &&
        nonEmptyOpts.some((o) => String(o).trim() === String(correctAnswer || "").trim())
      : hasPrompt && String(correctAnswer || "").trim().length > 0;

  if (!hasPrompt || !isValidMcq) {
    return { block: legacyFillerBlock(type) };
  }

  const out = {
    type,
    prompt: prompt.trim(),
    questionType,
    options: questionType === "mcq" ? nonEmptyOpts.slice(0, 6) : [],
    correctAnswer: correctAnswer.trim(),
  };
  if (type === "checkpoint") {
    const explanationTrim =
      typeof b?.explanation === "string" && b.explanation.trim()
        ? b.explanation.trim().slice(0, 8000)
        : undefined;
    if (explanationTrim) out.explanation = explanationTrim;
    const markSchemeBlk = Array.isArray(b?.markScheme)
      ? b.markScheme.map((x) => String(x).trim()).filter(Boolean).slice(0, 20)
      : undefined;
    if (markSchemeBlk && markSchemeBlk.length) out.markScheme = markSchemeBlk;
  } else if (typeof b?.explanation === "string") {
    out.explanation = b.explanation;
  }
  if (typeof b?.role === "string" && b.role.trim()) out.role = b.role.trim();
  return { block: out };
}

/**
 * @param {object} b
 * @returns {{ block: object } | { error: string, code: string }}
 */
function sanitizePageQuizBlock(b) {
  const bank = validateActivityQuestionBank(b?.questions);
  if (bank.ok) {
    const first = bank.questions[0];
    const out = {
      type: "pageQuiz",
      question: first.prompt,
      prompt: first.prompt,
      questionType: first.questionType,
      options: first.questionType === "mcq" ? first.options.slice(0, 6) : [],
      correctAnswer: first.correctAnswer,
      questions: bank.questions,
    };
    if (typeof b?.explanation === "string") out.explanation = b.explanation;
    if (typeof b?.role === "string" && b.role.trim()) out.role = b.role.trim();
    return { block: out };
  }
  if (Array.isArray(b?.questions) && b.questions.length > 0) {
    return {
      error: `pageQuiz questions[] is present but invalid (${bank.reason})`,
      code: "ACTIVITY_QUESTION_BANK_INVALID",
    };
  }

  const qText =
    typeof b?.question === "string" ? b.question : typeof b?.prompt === "string" ? b.prompt : "";
  const out = {
    type: "pageQuiz",
    question: qText,
    questionType: b?.questionType === "short" || b?.type === "shortAnswer" ? "short" : "mcq",
    options: Array.isArray(b?.options) ? b.options.map((x) => String(x)).slice(0, 6) : [],
    correctAnswer: typeof b?.correctAnswer === "string" ? b.correctAnswer : "",
    explanation: typeof b?.explanation === "string" ? b.explanation : undefined,
  };
  if (typeof b?.role === "string" && b.role.trim()) out.role = b.role.trim();
  return { block: out };
}

module.exports = {
  sanitizeCheckpointOrSelfCheckBlock,
  sanitizePageQuizBlock,
  validateActivityQuestionBank,
  normalizeBankQuestion,
  isFillerOption,
};
