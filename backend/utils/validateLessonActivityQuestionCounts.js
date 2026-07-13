/**
 * Activity question-count + variety contract for newly generated lessons.
 * Legacy single-prompt blocks still count as 1 (render-safe); new generation must meet minima.
 * Renderer never invents questions — this only gates what may be saved.
 */

const MIN_SELF_CHECK = 3;
const MAX_SELF_CHECK = 3;
const MIN_CHECKPOINT = 3;
const MAX_CHECKPOINT = 3;
const MIN_QUIZ_POOL = 5;
const MIN_REVISION_POOL = 5;

const QUESTION_PURPOSES = [
  "recall",
  "definition",
  "misconception",
  "application",
  "comparison",
  "explain",
  "calculate",
  "evaluate",
  "sequence",
  "exam_style",
];

const {
  WEAK_FORMULAIC_STEM_PATTERNS,
  isWeakFormulaicStem,
} = require("./activityQuestionStemPacks");

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

const WHICH_STATEMENT_PATTERN = /^which statement\b/i;
const WHICH_STATEMENT_BEST_PATTERN = /^which statement best\b/i;
const BANK_FORMULAIC_PATTERN = /\(bank\s+\d+\)\s*$/i;
/** Formulaic "... for {Topic}?" endings that signal topic-word substitution. */
const FOR_TOPIC_ENDING_PATTERN = /\bfor\s+[A-Z][^?]{2,80}\?\s*$/;

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
  if (isWeakFormulaicStem(raw)) return true;
  return GENERIC_STEM_PATTERNS.some((re) => re.test(raw));
}

function isFormulaicRepairStem(stem) {
  return BANK_FORMULAIC_PATTERN.test(String(stem || "").trim());
}

function openingPhrase(stem) {
  const words = normalizeStem(stem).split(/\s+/).filter(Boolean);
  return words.slice(0, 4).join(" ");
}

function commandWord(stem) {
  const raw = String(stem || "").trim();
  const m = raw.match(
    /^(which|what|where|when|how|why|define|describe|explain|compare|evaluate|suggest|identify|name|state|outline|apply|a student)\b/i
  );
  return m ? m[1].toLowerCase() : "other";
}

/**
 * Prefer explicit purpose/skill; otherwise infer from stem/command words.
 * Also reads tags like "purpose:comparison" when Mongo strips unknown quiz fields.
 * @returns {string} one of QUESTION_PURPOSES, or "recall" as soft default
 */
function purposeFromTags(q) {
  const tags = Array.isArray(q?.tags) ? q.tags : [];
  for (const t of tags) {
    const m = String(t || "").match(/^purpose:(.+)$/i);
    if (m && QUESTION_PURPOSES.includes(m[1].toLowerCase().replace(/[\s-]+/g, "_"))) {
      return m[1].toLowerCase().replace(/[\s-]+/g, "_");
    }
  }
  return "";
}

function inferQuestionPurpose(q) {
  const explicit = String(q?.purpose || q?.skill || q?.questionPurpose || purposeFromTags(q) || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (QUESTION_PURPOSES.includes(explicit)) return explicit;

  const stem = String(q?.prompt || q?.question || "").trim();
  const lower = stem.toLowerCase();

  if (
    /misconception|common mistake|student says|incorrect because|why (this|that|it) is (wrong|incorrect)|shows a common misconception/i.test(
      lower
    )
  ) {
    return "misconception";
  }
  if (
    /^compare\b|\bdiffer\b|difference between|similarit|contrast\b|how do .+ and .+ differ/i.test(lower)
  ) {
    return "comparison";
  }
  if (/^evaluate\b|to what extent|how far|weakest for an exam/i.test(lower)) return "evaluate";
  if (/^suggest\b|^calculate\b|work out|how many/i.test(lower)) {
    return /^calculate\b|work out|how many/i.test(lower) ? "calculate" : "exam_style";
  }
  if (/exam[- ]style|command word|using the data|in an exam|earn a mark|not just naming/i.test(lower)) {
    return "exam_style";
  }
  if (
    /^sequence\b|order of|comes first|comes earlier|what happens next|step[- ]by[- ]step|typical sequence/i.test(
      lower
    )
  ) {
    return "sequence";
  }
  if (
    /\bscenario\b|a student (does|observes|measures)|apply your|in practice|during an experiment|affect the outcome|most likely effect/i.test(
      lower
    )
  ) {
    return "application";
  }
  if (/^explain\b|^why\b|because →|give a reason|explain why|needed before the final outcome/i.test(lower)) {
    return "explain";
  }
  if (
    /^define\b|correctly defines?|what is (the )?meaning|definition of|which option correctly defines/i.test(
      lower
    )
  ) {
    return "definition";
  }
  if (/^identify\b|^name\b|^state\b|^what is\b|^which (structure|term|process|cell)\b/i.test(lower)) {
    return "recall";
  }
  if (/^which\b|^where\b|^what\b/i.test(lower)) return "recall";
  if (/^describe\b/i.test(lower)) return "explain";
  if (/^how do\b|^how does\b/i.test(lower)) return "application";
  return "recall";
}

function enrichQuestion(q) {
  if (!q || typeof q !== "object") return null;
  const purpose = inferQuestionPurpose(q);
  return { ...q, purpose };
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
  return enrichQuestion({
    prompt,
    question: prompt,
    questionType,
    options: questionType === "mcq" ? options.slice(0, 4) : [],
    correctAnswer: String(block.correctAnswer || block.answer || "").trim(),
    explanation: String(block.explanation || block.content || "").trim(),
    purpose: block.purpose || block.skill,
  });
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
        return enrichQuestion({
          prompt,
          question: prompt,
          questionType,
          options: questionType === "mcq" ? options.slice(0, 4) : [],
          correctAnswer: String(q.correctAnswer || q.answer || "").trim(),
          explanation: String(q.explanation || q.markScheme || "").trim(),
          purpose: q.purpose || q.skill || q.questionPurpose,
        });
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

/** Primary checkpoint activity (exclude worked examples). */
function isCheckpointActivity(block) {
  const t = blockType(block);
  const role = blockRole(block);
  if (role === "workedexample" || role === "worked-example") return false;
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
      return enrichQuestion({
        prompt,
        question: prompt,
        questionType: options.length >= 2 ? "mcq" : "short",
        options: options.slice(0, 4),
        correctAnswer: String(q.correctAnswer || q.answer || "").trim(),
        explanation: String(q.explanation || "").trim(),
        purpose: q.purpose || q.skill || q.questionPurpose,
        tags: q.tags,
      });
    })
    .filter(Boolean);
}

function purposeSet(questions) {
  return new Set(questions.map((q) => q.purpose || inferQuestionPurpose(q)));
}

function hasAnyPurpose(purposes, list) {
  return list.some((p) => purposes.has(p));
}

/**
 * Variety checks for one activity's question list.
 * @param {string} activityKey e.g. selfCheck:0
 * @param {object[]} questions
 * @param {{ minDistinct?: number, require?: string[][], label?: string }} rules
 */
function validateActivityVariety(activityKey, questions, rules, issues) {
  if (!questions.length) return;

  const openings = questions.map((q) => openingPhrase(q.prompt));
  const openingCounts = new Map();
  for (const o of openings) {
    if (!o) continue;
    openingCounts.set(o, (openingCounts.get(o) || 0) + 1);
  }
  for (const [phrase, count] of openingCounts) {
    if (count >= 3 || (questions.length >= 3 && count === questions.length)) {
      issues.push(`activity_repeated_stem_pattern:${activityKey}:${phrase.slice(0, 40)}`);
    }
  }

  const commands = questions.map((q) => commandWord(q.prompt));
  const cmdCounts = new Map();
  for (const c of commands) {
    cmdCounts.set(c, (cmdCounts.get(c) || 0) + 1);
  }
  for (const [cmd, count] of cmdCounts) {
    if (questions.length >= 3 && count === questions.length && cmd !== "other") {
      issues.push(`activity_repeated_command_word:${activityKey}:${cmd}`);
    }
  }

  const whichStatementCount = questions.filter((q) =>
    WHICH_STATEMENT_PATTERN.test(String(q.prompt || ""))
  ).length;
  if (whichStatementCount >= 2) {
    issues.push(`activity_repeated_stem_pattern:${activityKey}:which_statement`);
  }

  const whichStatementBestCount = questions.filter((q) =>
    WHICH_STATEMENT_BEST_PATTERN.test(String(q.prompt || ""))
  ).length;
  if (whichStatementBestCount >= 2) {
    issues.push(`activity_repeated_stem_pattern:${activityKey}:which_statement_best`);
  }

  const forTopicEndingCount = questions.filter((q) =>
    FOR_TOPIC_ENDING_PATTERN.test(String(q.prompt || "").trim())
  ).length;
  if (forTopicEndingCount >= 2) {
    issues.push(`activity_repeated_stem_pattern:${activityKey}:for_topic_ending`);
  }

  const formulaic = questions.filter((q) => isFormulaicRepairStem(q.prompt));
  if (formulaic.length >= 2) {
    issues.push(`activity_repeated_stem_pattern:${activityKey}:formulaic_bank`);
  }

  const purposes = purposeSet(questions);
  const minDistinct = rules.minDistinct ?? Math.min(3, questions.length);
  if (purposes.size < minDistinct) {
    issues.push(
      `activity_question_variety_too_low:${activityKey}:got_${purposes.size}_need_${minDistinct}`
    );
  }

  const onlyRecallLike =
    [...purposes].every((p) => p === "recall" || p === "definition") && questions.length >= 3;
  if (onlyRecallLike) {
    issues.push(`activity_question_variety_too_low:${activityKey}:all_recall`);
  }

  for (const group of rules.require || []) {
    if (!hasAnyPurpose(purposes, group)) {
      const tag = group.includes("misconception")
        ? "activity_missing_misconception_question"
        : group.includes("application")
          ? "activity_missing_application_question"
          : group.includes("explain")
            ? "activity_missing_application_question"
            : "activity_question_variety_too_low";
      issues.push(`${tag}:${activityKey}:need_${group.join("|")}`);
    }
  }
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

  if (selfChecks.length === 0) {
    issues.push("activity_missing:selfCheck");
  }
  if (checkpoints.length === 0) {
    issues.push("activity_missing:checkpoint");
  }

  for (let i = 0; i < selfChecks.length; i++) {
    const qs = extractQuestionsFromBlock(selfChecks[i]);
    if (qs.length < MIN_SELF_CHECK) {
      issues.push(`activity_question_count_too_low:selfCheck:${i}:got_${qs.length}_need_${MIN_SELF_CHECK}`);
    }
    if (qs.length > MAX_SELF_CHECK) {
      issues.push(`activity_question_count_too_high:selfCheck:${i}:got_${qs.length}_max_${MAX_SELF_CHECK}`);
    }
    for (const q of qs) {
      if (isGenericPlaceholderStem(q.prompt)) {
        issues.push(`activity_generic_placeholder_stem:selfCheck:${i}:${normalizeStem(q.prompt).slice(0, 40)}`);
      }
    }
    validateActivityVariety(`selfCheck:${i}`, qs, {
      minDistinct: Math.min(3, qs.length),
      require: [
        ["recall", "definition"],
        ["misconception"],
        ["explain", "application"],
      ],
    }, issues);
  }

  for (let i = 0; i < checkpoints.length; i++) {
    const qs = extractQuestionsFromBlock(checkpoints[i]);
    if (qs.length < MIN_CHECKPOINT) {
      issues.push(`activity_question_count_too_low:checkpoint:${i}:got_${qs.length}_need_${MIN_CHECKPOINT}`);
    }
    if (qs.length > MAX_CHECKPOINT) {
      issues.push(`activity_question_count_too_high:checkpoint:${i}:got_${qs.length}_max_${MAX_CHECKPOINT}`);
    }
    for (const q of qs) {
      if (isGenericPlaceholderStem(q.prompt)) {
        issues.push(`activity_generic_placeholder_stem:checkpoint:${i}:${normalizeStem(q.prompt).slice(0, 40)}`);
      }
    }
    validateActivityVariety(`checkpoint:${i}`, qs, {
      minDistinct: Math.min(3, qs.length),
      require: [
        ["recall", "definition", "explain"],
        ["application", "sequence"],
        ["explain", "misconception", "evaluate"],
      ],
    }, issues);
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

  if (quizQs.length >= MIN_QUIZ_POOL) {
    validateActivityVariety("quiz", quizQs.slice(0, Math.max(MIN_QUIZ_POOL, quizQs.length)), {
      minDistinct: 4,
      require: [
        ["recall", "definition"],
        ["misconception"],
        ["application", "sequence"],
        ["comparison", "explain", "exam_style", "evaluate"],
      ],
    }, issues);
    validateActivityVariety("revision", quizQs.slice(0, Math.max(MIN_REVISION_POOL, quizQs.length)), {
      minDistinct: 4,
      require: [
        ["recall", "definition"],
        ["misconception"],
        ["application", "sequence"],
        ["comparison", "explain", "exam_style", "evaluate"],
      ],
    }, issues);
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

  // Revision must not clone checkpoint purpose+near-identical stem pattern (opening phrase)
  const cpOpenings = new Set();
  const cpPurposeStem = new Set();
  checkpoints.forEach((b, i) => {
    for (const q of extractQuestionsFromBlock(b)) {
      cpOpenings.add(openingPhrase(q.prompt));
      cpPurposeStem.add(`${q.purpose}|${normalizeStem(q.prompt)}`);
    }
  });
  for (const q of quizQs) {
    const open = openingPhrase(q.prompt);
    if (open && cpOpenings.has(open) && questionsSharePurposeClone(q, checkpoints)) {
      issues.push(`activity_repeated_stem_pattern:revision_clones_checkpoint:${open.slice(0, 40)}`);
    }
    if (cpPurposeStem.has(`${q.purpose}|${normalizeStem(q.prompt)}`)) {
      issues.push(`activity_duplicate_stem:checkpoint_vs_revision:${normalizeStem(q.prompt).slice(0, 48)}`);
    }
  }

  const varietyIssues = issues.filter(
    (i) =>
      i.includes("variety") ||
      i.includes("repeated_stem") ||
      i.includes("repeated_command") ||
      i.includes("missing_application") ||
      i.includes("missing_misconception")
  );

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      selfCheckBlocks: selfChecks.length,
      checkpointBlocks: checkpoints.length,
      quizUnique: uniqueQuizStems.size,
      varietyIssueCount: varietyIssues.length,
      quizPurposes: [...purposeSet(quizQs)],
    },
  };
}

function questionsSharePurposeClone(quizQ, checkpoints) {
  for (const b of checkpoints) {
    for (const q of extractQuestionsFromBlock(b)) {
      if (q.purpose === quizQ.purpose && openingPhrase(q.prompt) === openingPhrase(quizQ.prompt)) {
        return true;
      }
    }
  }
  return false;
}

function isVarietyIssue(issue) {
  return /variety|repeated_stem|repeated_command|missing_application|missing_misconception|formulaic_bank|which_statement/.test(
    String(issue || "")
  );
}

function isCountIssue(issue) {
  return /question_count_too_low|question_count_too_high|pool_too_low|activity_missing:|generic_placeholder|duplicate_stem/.test(
    String(issue || "")
  );
}

module.exports = {
  MIN_SELF_CHECK,
  MAX_SELF_CHECK,
  MIN_CHECKPOINT,
  MAX_CHECKPOINT,
  MIN_QUIZ_POOL,
  MIN_REVISION_POOL,
  QUESTION_PURPOSES,
  GENERIC_STEM_PATTERNS,
  WEAK_FORMULAIC_STEM_PATTERNS,
  normalizeStem,
  isGenericPlaceholderStem,
  isWeakFormulaicStem,
  isFormulaicRepairStem,
  inferQuestionPurpose,
  extractQuestionsFromBlock,
  isSelfCheckActivity,
  isCheckpointActivity,
  validateLessonActivityQuestionCounts,
  quizQuestionsFromLesson,
  openingPhrase,
  commandWord,
  isVarietyIssue,
  isCountIssue,
};
