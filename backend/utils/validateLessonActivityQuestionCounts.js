/**
 * Activity question-count contract for newly generated lessons.
 * Legacy single-prompt blocks still count as 1 (render-safe); new generation must meet minima.
 */

const MIN_SELF_CHECK = 3;
const MIN_CHECKPOINT = 3;
const MIN_QUIZ_POOL = 5;
const MIN_REVISION_POOL = 5;

const GENERIC_STEM_PATTERNS = [
  /^which statement best (explains|matches)/i,
  /^which statement is correct\??$/i,
  /^which of the following is correct\??$/i,
  /^what is the correct answer\??$/i,
  /^which option is most accurate/i,
  /^a correct statement about/i,
  /^explain one key idea about/i,
  /best explains a key idea about/i,
  /best matches this topic/i,
];

function normalizeStem(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericPlaceholderStem(stem) {
  const raw = String(stem || "").trim();
  if (!raw) return true;
  return GENERIC_STEM_PATTERNS.some((re) => re.test(raw));
}

function questionFromLegacyBlock(block) {
  const prompt = String(block?.prompt || block?.question || "").trim();
  if (!prompt) return null;
  const options = Array.isArray(block.options)
    ? block.options.map((o) => String(o ?? "").trim()).filter(Boolean)
    : [];
  const questionType =
    String(block.questionType || "").toLowerCase() === "short" || options.length < 2
      ? "short"
      : "mcq";
  return {
    prompt,
    question: prompt,
    questionType,
    options: questionType === "mcq" ? options.slice(0, 4) : [],
    correctAnswer: String(block.correctAnswer || block.answer || "").trim(),
    explanation: String(block.explanation || block.content || "").trim(),
  };
}

/** Prefer questions[]; fall back to legacy single prompt/question. */
function extractQuestionsFromBlock(block) {
  if (!block || typeof block !== "object") return [];
  if (Array.isArray(block.questions) && block.questions.length) {
    return block.questions
      .map((q) => {
        if (!q || typeof q !== "object") return null;
        const prompt = String(q.prompt || q.question || q.questionText || q.stem || "").trim();
        if (!prompt) return null;
        const options = Array.isArray(q.options)
          ? q.options.map((o) => String(o ?? "").trim()).filter(Boolean)
          : [];
        const questionType =
          String(q.questionType || "").toLowerCase() === "short" || options.length < 2
            ? "short"
            : "mcq";
        return {
          prompt,
          question: prompt,
          questionType,
          options: questionType === "mcq" ? options.slice(0, 4) : [],
          correctAnswer: String(q.correctAnswer || q.answer || "").trim(),
          explanation: String(q.explanation || q.markScheme || "").trim(),
        };
      })
      .filter(Boolean);
  }
  const legacy = questionFromLegacyBlock(block);
  return legacy ? [legacy] : [];
}

function blockType(block) {
  return String(block?.type || "")
    .trim()
    .toLowerCase();
}

function blockRole(block) {
  return String(block?.role || "")
    .trim()
    .toLowerCase();
}

/** Primary self-check activity (exclude worked examples). */
function isSelfCheckActivity(block) {
  if (blockType(block) !== "selfcheck") return false;
  const role = blockRole(block);
  if (role === "workedexample" || role === "worked-example") return false;
  return true;
}

/** Primary checkpoint activity. */
function isCheckpointActivity(block) {
  const t = blockType(block);
  const role = blockRole(block);
  if (t === "checkpoint") return true;
  if (t === "selfcheck" && role === "checkpoint") return true;
  return false;
}

function collectPagesBlocks(pages) {
  const out = [];
  for (const page of Array.isArray(pages) ? pages : []) {
    for (const block of Array.isArray(page?.blocks) ? page.blocks : []) {
      out.push(block);
    }
  }
  return out;
}

function quizQuestionsFromLesson(quiz) {
  const raw = quiz && Array.isArray(quiz.questions) ? quiz.questions : [];
  return raw
    .map((q) => {
      if (!q || typeof q !== "object") return null;
      const prompt = String(q.question || q.prompt || q.questionText || "").trim();
      if (!prompt) return null;
      const options = Array.isArray(q.options)
        ? q.options.map((o) => String(o ?? "").trim()).filter(Boolean)
        : Array.isArray(q.choices)
          ? q.choices.map((o) => String(o ?? "").trim()).filter(Boolean)
          : [];
      return {
        prompt,
        question: prompt,
        questionType: options.length >= 2 ? "mcq" : "short",
        options: options.slice(0, 4),
        correctAnswer: String(q.correctAnswer || q.answer || "").trim(),
        explanation: String(q.explanation || "").trim(),
      };
    })
    .filter(Boolean);
}

/**
 * @param {{ pages?: unknown[], quiz?: { questions?: unknown[] } }} lessonLike
 * @returns {{ ok: boolean, issues: string[], summary: object }}
 */
function validateLessonActivityQuestionCounts(lessonLike) {
  const issues = [];
  const pages = lessonLike?.pages;
  const blocks = collectPagesBlocks(pages);
  const quizQs = quizQuestionsFromLesson(lessonLike?.quiz);

  // Exclusive: role=checkpoint on a selfCheck block counts as checkpoint only.
  const checkpoints = blocks.filter(isCheckpointActivity);
  const selfChecks = blocks.filter((b) => isSelfCheckActivity(b) && !isCheckpointActivity(b));

  for (let i = 0; i < selfChecks.length; i++) {
    const qs = extractQuestionsFromBlock(selfChecks[i]);
    if (qs.length < MIN_SELF_CHECK) {
      issues.push(`activity_question_count_too_low:selfCheck:${i}:got_${qs.length}_need_${MIN_SELF_CHECK}`);
    }
    for (const q of qs) {
      if (isGenericPlaceholderStem(q.prompt)) {
        issues.push(`activity_generic_placeholder_stem:selfCheck:${i}:${normalizeStem(q.prompt).slice(0, 40)}`);
      }
    }
  }

  for (let i = 0; i < checkpoints.length; i++) {
    const qs = extractQuestionsFromBlock(checkpoints[i]);
    if (qs.length < MIN_CHECKPOINT) {
      issues.push(`activity_question_count_too_low:checkpoint:${i}:got_${qs.length}_need_${MIN_CHECKPOINT}`);
    }
    for (const q of qs) {
      if (isGenericPlaceholderStem(q.prompt)) {
        issues.push(`activity_generic_placeholder_stem:checkpoint:${i}:${normalizeStem(q.prompt).slice(0, 40)}`);
      }
    }
  }

  const uniqueQuizStems = new Set(quizQs.map((q) => normalizeStem(q.prompt)).filter(Boolean));
  if (uniqueQuizStems.size < MIN_QUIZ_POOL) {
    issues.push(`quiz_pool_too_low:got_${uniqueQuizStems.size}_need_${MIN_QUIZ_POOL}`);
  }
  if (uniqueQuizStems.size < MIN_REVISION_POOL) {
    issues.push(`revision_pool_too_low:got_${uniqueQuizStems.size}_need_${MIN_REVISION_POOL}`);
  }

  for (const q of quizQs) {
    if (isGenericPlaceholderStem(q.prompt)) {
      issues.push(`activity_generic_placeholder_stem:quiz:${normalizeStem(q.prompt).slice(0, 40)}`);
    }
  }

  // Cross-activity exact stem clones (self-check vs checkpoint vs quiz)
  const seen = new Map();
  function track(source, stem) {
    const key = normalizeStem(stem);
    if (!key) return;
    if (seen.has(key) && seen.get(key) !== source) {
      issues.push(`activity_duplicate_stem:${seen.get(key)}_vs_${source}:${key.slice(0, 48)}`);
    } else if (!seen.has(key)) {
      seen.set(key, source);
    }
  }
  selfChecks.forEach((b, i) => extractQuestionsFromBlock(b).forEach((q) => track(`selfCheck${i}`, q.prompt)));
  checkpoints.forEach((b, i) => extractQuestionsFromBlock(b).forEach((q) => track(`checkpoint${i}`, q.prompt)));
  quizQs.forEach((q, i) => track(`quiz${i}`, q.prompt));

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      selfCheckBlocks: selfChecks.length,
      checkpointBlocks: checkpoints.length,
      quizUnique: uniqueQuizStems.size,
    },
  };
}

module.exports = {
  MIN_SELF_CHECK,
  MIN_CHECKPOINT,
  MIN_QUIZ_POOL,
  MIN_REVISION_POOL,
  GENERIC_STEM_PATTERNS,
  normalizeStem,
  isGenericPlaceholderStem,
  extractQuestionsFromBlock,
  isSelfCheckActivity,
  isCheckpointActivity,
  validateLessonActivityQuestionCounts,
  quizQuestionsFromLesson,
};
