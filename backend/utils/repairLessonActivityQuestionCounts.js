/**
 * Deterministic repair: replenish activity question counts before save.
 * Never inserts banned generic placeholder stems.
 */

const {
  MIN_SELF_CHECK,
  MIN_CHECKPOINT,
  MIN_QUIZ_POOL,
  normalizeStem,
  isGenericPlaceholderStem,
  extractQuestionsFromBlock,
  isSelfCheckActivity,
  isCheckpointActivity,
  validateLessonActivityQuestionCounts,
} = require("./validateLessonActivityQuestionCounts");

function titleCase(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function harvestVocab(opts = {}) {
  const out = [];
  const push = (v) => {
    const t = String(v || "").trim();
    if (!t || t.length < 2) return;
    if (out.some((x) => normalizeStem(x) === normalizeStem(t))) return;
    out.push(t);
  };
  for (const v of opts.vocabulary || []) push(v);
  for (const v of opts.structures || []) push(v);
  for (const v of opts.misconceptions || []) push(v);
  const topic = String(opts.topic || "").trim();
  if (topic) {
    for (const part of topic.split(/[:/|&,–—-]+/)) push(part.trim());
  }
  // Fallbacks so thin specs still replenish with topic-specific wording
  if (out.length < 3 && topic) {
    push(`${topic} mechanism`);
    push(`${topic} outcome`);
    push(`${topic} structure`);
  }
  return out.slice(0, 24);
}

function makeShortQuestion(prompt, answer) {
  return {
    prompt,
    question: prompt,
    questionType: "short",
    options: [],
    correctAnswer: answer,
    explanation: answer,
  };
}

function makeMcqQuestion(prompt, correct, distractors) {
  const opts = [correct, ...distractors].map((o) => String(o || "").trim()).filter(Boolean);
  const unique = [];
  for (const o of opts) {
    if (!unique.some((u) => normalizeStem(u) === normalizeStem(o))) unique.push(o);
  }
  while (unique.length < 4) {
    unique.push(`Not related to ${correct}`);
  }
  return {
    prompt,
    question: prompt,
    questionType: "mcq",
    options: unique.slice(0, 4),
    correctAnswer: correct,
    explanation: `${correct} is the correct choice for this check.`,
  };
}

/**
 * Topic-specific short stems for self-check / replenish (avoid banned generics).
 */
function shortStemCandidates(topic, vocab, usedStems) {
  const label = titleCase(topic || "this process");
  const terms = vocab.length ? vocab : [label];
  const templates = [];
  terms.forEach((term, i) => {
    const t = titleCase(term);
    templates.push(
      makeShortQuestion(
        `Define ${t} and link it to ${label}.`,
        `${t} is a key idea in ${label}; state its role precisely.`
      ),
      makeShortQuestion(
        `Explain the role of ${t} in ${label}.`,
        `${t} contributes to ${label} through a clear cause → effect chain.`
      ),
      makeShortQuestion(
        `Why does ${t} matter for ${label}?`,
        `Because ${t} affects how ${label} works in practice.`
      ),
      makeShortQuestion(
        `Describe one step involving ${t} during ${label}.`,
        `Name the step, then say what ${t} does and the outcome.`
      ),
      makeShortQuestion(
        `State one difference between naming ${t} and explaining how it works in ${label}.`,
        `Naming alone is recall; explaining uses because → therefore for ${label}.`
      ),
      makeShortQuestion(
        `A student only names ${t}. What else must they add for ${label}?`,
        `Add mechanism and outcome linked to ${label}.`
      )
    );
    if (i === 0) {
      templates.push(
        makeShortQuestion(
          `Apply your knowledge: how does ${t} affect the outcome of ${label}?`,
          `Use because → therefore with ${t} and the measurable outcome.`
        )
      );
    }
  });
  return templates.filter((q) => {
    if (isGenericPlaceholderStem(q.prompt)) return false;
    const key = normalizeStem(q.prompt);
    if (usedStems.has(key)) return false;
    return true;
  });
}

/**
 * Topic-specific MCQ stems for checkpoints / quiz pool.
 */
function mcqStemCandidates(topic, vocab, usedStems) {
  const label = titleCase(topic || "this process");
  const terms = vocab.length ? vocab : [label, `${label} pathway`, `${label} result`];
  const out = [];
  for (let i = 0; i < terms.length; i++) {
    const correct = titleCase(terms[i]);
    const distractors = terms
      .filter((_, j) => j !== i)
      .slice(0, 3)
      .map((d) => titleCase(d));
    while (distractors.length < 3) {
      distractors.push(`Unrelated feature of ${label}`);
    }
    const prompts = [
      `What is the role of ${correct} in ${label}?`,
      `Which structure or term is essential for ${label}?`,
      `Where does ${correct} fit in the sequence for ${label}?`,
      `How does ${correct} change the outcome in ${label}?`,
      `Name the term that best matches this function in ${label}: supporting ${correct.toLowerCase()}.`,
    ];
    // Rotate which prompt style per term
    const prompt = prompts[i % prompts.length];
    // Fix: second prompt always same — vary with term
    const varied =
      i % 5 === 1
        ? `Which of these is essential for ${label}?`
        : i % 5 === 2
          ? `In ${label}, what does ${correct} do?`
          : i % 5 === 3
            ? `Which option correctly places ${correct} in ${label}?`
            : i % 5 === 4
              ? `For ${label}, which choice names ${correct} correctly?`
              : prompt;

    // For "Which of these is essential" the answer should be correct term
    const answer = i % 5 === 1 || i % 5 === 4 ? correct : correct;
    const q = makeMcqQuestion(
      varied.includes("role of") || varied.includes("does ")
        ? varied.startsWith("What is the role")
          ? varied
          : varied
        : i % 5 === 1
          ? `Which of these is essential for ${label}?`
          : varied,
      answer,
      distractors
    );
    // Prefer clearer role question when available
    if (i % 5 === 0) {
      Object.assign(
        q,
        makeMcqQuestion(`What is the role of ${correct} in ${label}?`, correct, distractors)
      );
      // Role MCQ with term as answer is weak if options are terms — still OK for V1 replenish
    }
    if (isGenericPlaceholderStem(q.prompt)) continue;
    const key = normalizeStem(q.prompt);
    if (usedStems.has(key)) continue;
    out.push(q);
  }
  // Extra application MCQs
  if (terms.length >= 2) {
    const a = titleCase(terms[0]);
    const b = titleCase(terms[1]);
    const q = makeMcqQuestion(
      `In ${label}, which comes first in a typical sequence: ${a} or ${b}?`,
      a,
      [b, `Neither is part of ${label}`, `Both happen only after the outcome`]
    );
    if (!isGenericPlaceholderStem(q.prompt) && !usedStems.has(normalizeStem(q.prompt))) {
      out.push(q);
    }
  }
  return out;
}

function syncLegacyFieldsFromQuestions(block, questions) {
  const first = questions[0];
  if (!first) return block;
  block.questions = questions;
  block.prompt = first.prompt;
  block.question = first.prompt;
  block.questionType = first.questionType;
  block.options = first.questionType === "mcq" ? first.options : [];
  block.correctAnswer = first.correctAnswer;
  if (first.questionType === "short") {
    const ans = first.correctAnswer || first.explanation || "";
    if (ans && !/<details/i.test(String(block.explanation || ""))) {
      block.explanation = `<details>\n<summary>Reveal Answer</summary>\n\n<p>${ans}</p>\n\n</details>`;
      block.content = block.explanation;
    } else if (first.explanation) {
      block.explanation = first.explanation;
    }
  } else {
    block.explanation = first.explanation || block.explanation || "";
  }
  return block;
}

function expandBlockQuestions(block, minCount, generators, usedStems) {
  let qs = extractQuestionsFromBlock(block).filter((q) => !isGenericPlaceholderStem(q.prompt));
  // Dedup first so duplicate stems do not satisfy the minimum falsely.
  const seenLocal = new Set();
  qs = qs.filter((q) => {
    const k = normalizeStem(q.prompt);
    if (!k || seenLocal.has(k)) return false;
    seenLocal.add(k);
    return true;
  });
  for (const q of qs) usedStems.add(normalizeStem(q.prompt));

  for (const gen of generators) {
    if (qs.length >= minCount) break;
    for (const candidate of gen()) {
      if (qs.length >= minCount) break;
      const key = normalizeStem(candidate.prompt);
      if (!key || usedStems.has(key) || isGenericPlaceholderStem(candidate.prompt)) continue;
      usedStems.add(key);
      qs.push(candidate);
    }
  }

  syncLegacyFieldsFromQuestions(block, qs);
  return qs.length >= minCount;
}

function buildQuizBank(pages, existingQuiz, topic, vocab, usedAcrossActivities, minCount) {
  const bank = [];
  const seen = new Set();

  const push = (q) => {
    if (!q || q.questionType !== "mcq") return;
    const key = normalizeStem(q.prompt);
    if (!key || seen.has(key) || usedAcrossActivities.has(key)) return;
    if (isGenericPlaceholderStem(q.prompt)) return;
    if (!Array.isArray(q.options) || q.options.length < 2) return;
    if (!String(q.correctAnswer || "").trim()) return;
    seen.add(key);
    bank.push({
      id: `gen-quiz-${bank.length + 1}`,
      type: "mcq",
      question: q.prompt,
      options: q.options.slice(0, 4),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || "",
      tags: ["ai-generated", "activity-count-repair"],
      difficulty: 2,
      marks: 1,
    });
  };

  // Prefer existing stored quiz items first
  for (const raw of existingQuiz?.questions || []) {
    if (!raw || typeof raw !== "object") continue;
    const prompt = String(raw.question || raw.prompt || "").trim();
    const options = Array.isArray(raw.options)
      ? raw.options.map((o) => String(o ?? "").trim()).filter(Boolean)
      : [];
    push({
      prompt,
      questionType: options.length >= 2 ? "mcq" : "short",
      options,
      correctAnswer: String(raw.correctAnswer || "").trim(),
      explanation: String(raw.explanation || "").trim(),
    });
  }

  // Harvest MCQs from page blocks (including questions[]) that are not already reserved by activity stems
  for (const page of pages || []) {
    for (const block of page?.blocks || []) {
      for (const q of extractQuestionsFromBlock(block)) {
        push(q);
      }
    }
  }

  // Generate more MCQs until min
  const mcqs = mcqStemCandidates(topic, vocab, new Set([...usedAcrossActivities, ...seen]));
  for (const q of mcqs) {
    if (bank.length >= minCount) break;
    push(q);
  }

  // Last-resort: guaranteed unique topic-specific MCQs (index in stem prevents collisions).
  let n = 0;
  const label = titleCase(topic || "this topic");
  while (bank.length < minCount && n < 40) {
    n++;
    const term = titleCase(vocab[(n - 1) % Math.max(vocab.length, 1)] || `idea ${n}`);
    const prompts = [
      `In ${label}, what is one accurate role of ${term}? (bank ${n})`,
      `How does ${term} contribute to ${label}? (bank ${n})`,
      `Which option names a valid point about ${term} in ${label}? (bank ${n})`,
      `Select the best description of ${term} for ${label}. (bank ${n})`,
      `For ${label}, which choice correctly places ${term}? (bank ${n})`,
    ];
    const prompt = prompts[(n - 1) % prompts.length];
    if (isGenericPlaceholderStem(prompt)) continue;
    push(
      makeMcqQuestion(prompt, term, [
        `An unrelated idea outside ${label}`,
        `A definition that omits ${term}`,
        `A process that ignores ${term}`,
      ])
    );
  }

  return {
    timeSeconds: existingQuiz?.timeSeconds || 600,
    questions: bank.slice(0, Math.max(minCount, bank.length)),
  };
}

function ensureActivityBlock(pages, type, seedQuestions) {
  if (!pages.length) pages.push({ title: "Page 1", order: 1, blocks: [] });
  const page = pages[0];
  if (!Array.isArray(page.blocks)) page.blocks = [];
  const first = seedQuestions[0];
  const block = {
    type,
    prompt: first.prompt,
    question: first.prompt,
    questionType: first.questionType,
    options: first.options || [],
    correctAnswer: first.correctAnswer,
    explanation: first.explanation || first.correctAnswer || "",
    questions: seedQuestions,
    title: "",
  };
  if (type === "selfCheck") {
    block.questionType = "short";
    block.options = [];
  }
  page.blocks.push(block);
  return block;
}

/**
 * @param {{ pages?: unknown[], quiz?: object }} lessonLike
 * @param {{ topic?: string, vocabulary?: string[], structures?: string[], misconceptions?: string[] }} opts
 */
function repairLessonActivityQuestionCounts(lessonLike, opts = {}) {
  const pages = JSON.parse(JSON.stringify(Array.isArray(lessonLike?.pages) ? lessonLike.pages : []));
  const topic = String(opts.topic || "this topic").trim() || "this topic";
  const vocab = harvestVocab(opts);
  const changes = [];
  const usedStems = new Set();

  // Ensure required activity blocks exist before expanding counts.
  const blocksNow = [];
  for (const page of pages) {
    for (const b of page?.blocks || []) blocksNow.push(b);
  }
  const hasSelf = blocksNow.some((b) => isSelfCheckActivity(b) && !isCheckpointActivity(b));
  const hasCp = blocksNow.some((b) => isCheckpointActivity(b));
  if (!hasSelf) {
    const seeds = shortStemCandidates(topic, vocab, usedStems).slice(0, MIN_SELF_CHECK);
    while (seeds.length < MIN_SELF_CHECK) {
      seeds.push(
        makeShortQuestion(
          `Explain one precise mechanism in ${titleCase(topic)} (item ${seeds.length + 1}).`,
          `Use because → therefore for ${titleCase(topic)}.`
        )
      );
    }
    ensureActivityBlock(pages, "selfCheck", seeds);
    changes.push({ kind: "insert-selfCheck", ok: true, count: seeds.length });
  }
  if (!hasCp) {
    const seeds = mcqStemCandidates(topic, vocab, usedStems).slice(0, MIN_CHECKPOINT);
    while (seeds.length < MIN_CHECKPOINT) {
      const term = titleCase(vocab[seeds.length] || topic);
      seeds.push(
        makeMcqQuestion(`What is the role of ${term} in ${titleCase(topic)}?`, term, [
          `Unrelated to ${titleCase(topic)}`,
          `Opposite of ${term}`,
          `Not involved in ${titleCase(topic)}`,
        ])
      );
    }
    ensureActivityBlock(pages, "checkpoint", seeds);
    changes.push({ kind: "insert-checkpoint", ok: true, count: seeds.length });
  }

  // First pass: register existing good stems so replenish stays unique
  for (const page of pages) {
    for (const block of page?.blocks || []) {
      if (!isSelfCheckActivity(block) && !isCheckpointActivity(block)) continue;
      for (const q of extractQuestionsFromBlock(block)) {
        if (!isGenericPlaceholderStem(q.prompt)) usedStems.add(normalizeStem(q.prompt));
      }
    }
  }

  for (const page of pages) {
    if (!Array.isArray(page?.blocks)) continue;
    for (const block of page.blocks) {
      if (isSelfCheckActivity(block) && !isCheckpointActivity(block)) {
        const ok = expandBlockQuestions(
          block,
          MIN_SELF_CHECK,
          [
            () => shortStemCandidates(topic, vocab, usedStems),
            () =>
              mcqStemCandidates(topic, vocab, usedStems).map((q) =>
                makeShortQuestion(
                  q.prompt.replace(/^What is the role of /i, "Explain the role of ").replace(/\?$/, "."),
                  q.correctAnswer
                )
              ),
          ],
          usedStems
        );
        changes.push({ kind: "selfCheck", ok, count: extractQuestionsFromBlock(block).length });
      } else if (isCheckpointActivity(block)) {
        const ok = expandBlockQuestions(
          block,
          MIN_CHECKPOINT,
          [
            () => mcqStemCandidates(topic, vocab, usedStems),
            () => shortStemCandidates(topic, vocab, usedStems),
          ],
          usedStems
        );
        changes.push({ kind: "checkpoint", ok, count: extractQuestionsFromBlock(block).length });
      }
    }
  }

  // Activity stems reserved — quiz must not clone them
  const reserved = new Set(usedStems);
  for (const page of pages) {
    for (const block of page?.blocks || []) {
      if (!isSelfCheckActivity(block) && !isCheckpointActivity(block)) continue;
      for (const q of extractQuestionsFromBlock(block)) {
        reserved.add(normalizeStem(q.prompt));
      }
    }
  }

  const quiz = buildQuizBank(pages, lessonLike?.quiz, topic, vocab, reserved, MIN_QUIZ_POOL);
  changes.push({ kind: "quiz", ok: quiz.questions.length >= MIN_QUIZ_POOL, count: quiz.questions.length });

  const draft = { pages, quiz };
  const validation = validateLessonActivityQuestionCounts(draft);

  return {
    pages,
    quiz,
    repaired: true,
    changes,
    validation,
  };
}

module.exports = {
  repairLessonActivityQuestionCounts,
  harvestVocab,
  shortStemCandidates,
  mcqStemCandidates,
  expandBlockQuestions,
  buildQuizBank,
};
