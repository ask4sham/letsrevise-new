/**
 * Deterministic repair: replenish activity question counts AND variety before save.
 * Never inserts banned generic placeholder stems or formulaic "(bank N)" clones.
 */

const {
  MIN_SELF_CHECK,
  MIN_CHECKPOINT,
  MIN_QUIZ_POOL,
  normalizeStem,
  isGenericPlaceholderStem,
  isFormulaicRepairStem,
  extractQuestionsFromBlock,
  isSelfCheckActivity,
  isCheckpointActivity,
  validateLessonActivityQuestionCounts,
  inferQuestionPurpose,
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
  if (out.length < 3 && topic) {
    push(`${topic} mechanism`);
    push(`${topic} outcome`);
    push(`${topic} structure`);
  }
  return out.slice(0, 24);
}

function makeShortQuestion(prompt, answer, purpose) {
  return {
    prompt,
    question: prompt,
    questionType: "short",
    options: [],
    correctAnswer: answer,
    explanation: answer,
    purpose: purpose || inferQuestionPurpose({ prompt }),
  };
}

function makeMcqQuestion(prompt, correct, distractors, purpose) {
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
    purpose: purpose || inferQuestionPurpose({ prompt }),
  };
}

function termAt(vocab, i, topic) {
  return titleCase(vocab[i % Math.max(vocab.length, 1)] || topic || "this idea");
}

/**
 * Purpose-tagged short stems for self-check (and checkpoint explain items).
 */
function purposeShortCandidates(topic, vocab, usedStems, purposesWanted) {
  const label = titleCase(topic || "this process");
  const a = termAt(vocab, 0, label);
  const b = termAt(vocab, 1, label);
  const c = termAt(vocab, 2, label);
  const catalog = {
    recall: makeShortQuestion(
      `Identify the role of ${a} in ${label}.`,
      `${a} is a named part of ${label}; state what it does.`,
      "recall"
    ),
    definition: makeShortQuestion(
      `Define ${b} in the context of ${label}.`,
      `${b} means a precise idea used when explaining ${label}.`,
      "definition"
    ),
    misconception: makeShortQuestion(
      `A student says ${a} alone completes ${label}. Explain why this is a misconception.`,
      `Naming ${a} is not enough; ${label} also needs mechanism and outcome.`,
      "misconception"
    ),
    explain: makeShortQuestion(
      `Explain why ${c} matters for the outcome of ${label}.`,
      `Because ${c} changes how ${label} works; therefore the outcome changes.`,
      "explain"
    ),
    application: makeShortQuestion(
      `Apply your knowledge: how would a change in ${a} affect ${label} in practice?`,
      `Use because → therefore linking ${a} to a measurable outcome in ${label}.`,
      "application"
    ),
    comparison: makeShortQuestion(
      `Compare ${a} and ${b} in ${label}: state one clear difference.`,
      `${a} and ${b} play different roles in ${label}; name both roles.`,
      "comparison"
    ),
    exam_style: makeShortQuestion(
      `Explain one reason examiners credit for linking ${a} to ${label}.`,
      `Credit comes from mechanism + outcome, not a lone keyword.`,
      "exam_style"
    ),
    sequence: makeShortQuestion(
      `Describe the order: where does ${a} fit before the final outcome of ${label}?`,
      `Place ${a} in the cause → effect sequence for ${label}.`,
      "sequence"
    ),
  };

  const wanted = purposesWanted?.length ? purposesWanted : Object.keys(catalog);
  const out = [];
  for (const purpose of wanted) {
    const q = catalog[purpose];
    if (!q) continue;
    if (isGenericPlaceholderStem(q.prompt) || isFormulaicRepairStem(q.prompt)) continue;
    const key = normalizeStem(q.prompt);
    if (usedStems.has(key)) continue;
    out.push(q);
  }
  // Extra rotated variants if still short
  for (let i = 0; i < vocab.length && out.length < 8; i++) {
    const t = termAt(vocab, i, label);
    const extras = [
      makeShortQuestion(
        `State one accurate fact about ${t} in ${label}.`,
        `${t} supports ${label} through a clear role.`,
        "recall"
      ),
      makeShortQuestion(
        `Which common error about ${t} should you avoid when revising ${label}? Explain briefly.`,
        `Avoid treating ${t} as the whole of ${label} without mechanism.`,
        "misconception"
      ),
      makeShortQuestion(
        `Why must ${t} be linked to an outcome when explaining ${label}?`,
        `Exam answers need because → therefore, not a label alone.`,
        "explain"
      ),
    ];
    for (const q of extras) {
      const key = normalizeStem(q.prompt);
      if (usedStems.has(key) || isGenericPlaceholderStem(q.prompt)) continue;
      if (out.some((x) => normalizeStem(x.prompt) === key)) continue;
      out.push(q);
    }
  }
  return out;
}

/**
 * Purpose-tagged MCQ stems for checkpoint / quiz.
 */
function purposeMcqCandidates(topic, vocab, usedStems, purposesWanted) {
  const label = titleCase(topic || "this process");
  const a = termAt(vocab, 0, label);
  const b = termAt(vocab, 1, label);
  const c = termAt(vocab, 2, label);
  const d = termAt(vocab, 3, label);
  const distract = (correct) =>
    [b, c, d, `Unrelated idea outside ${label}`].filter((x) => normalizeStem(x) !== normalizeStem(correct)).slice(0, 3);

  const catalog = {
    recall: makeMcqQuestion(
      `What is produced as a direct result of ${label}?`,
      a,
      distract(a),
      "recall"
    ),
    definition: makeMcqQuestion(
      `Which option correctly defines ${a} for ${label}?`,
      a,
      distract(a),
      "definition"
    ),
    misconception: makeMcqQuestion(
      `Which statement shows a common misconception about ${label}?`,
      `${a} alone is the complete process of ${label}`,
      [
        `${a} is one part of a larger mechanism in ${label}`,
        `${b} can contribute to ${label}`,
        `Outcomes of ${label} depend on more than one factor`,
      ],
      "misconception"
    ),
    application: makeMcqQuestion(
      `In a scenario where ${a} is missing, what is the most likely effect on ${label}?`,
      `The expected outcome of ${label} is disrupted`,
      [
        `Nothing changes in ${label}`,
        `${label} speeds up without ${a}`,
        `${b} fully replaces every role of ${a}`,
      ],
      "application"
    ),
    comparison: makeMcqQuestion(
      `How do ${a} and ${b} differ in ${label}?`,
      `They have different roles in the ${label} sequence`,
      [
        `They are identical in every way`,
        `Neither is involved in ${label}`,
        `Only one of them can ever be named in ${label}`,
      ],
      "comparison"
    ),
    explain: makeMcqQuestion(
      `Why is ${c} needed before the final outcome of ${label}?`,
      `It enables a later step in the ${label} mechanism`,
      [
        `It is decorative only`,
        `It happens after the outcome is finished`,
        `It replaces the need for ${label}`,
      ],
      "explain"
    ),
    sequence: makeMcqQuestion(
      `In ${label}, which comes earlier in a typical sequence: ${a} or the final outcome?`,
      a,
      [d || `Final outcome of ${label}`, `Neither belongs in ${label}`, `Both only after the outcome`],
      "sequence"
    ),
    exam_style: makeMcqQuestion(
      `Which answer would earn a mark for explaining ${label} (not just naming a word)?`,
      `A because → therefore link involving ${a}`,
      [
        `The single word ${a} with no mechanism`,
        `A vague claim that ${label} happens`,
        `An unrelated definition of ${b}`,
      ],
      "exam_style"
    ),
    evaluate: makeMcqQuestion(
      `Which claim about ${label} is weakest for an exam answer?`,
      `Just writing the word ${a} without linking it to an outcome`,
      [
        `Linking ${a} to a clear mechanism in ${label}`,
        `Comparing ${a} and ${b} with a difference`,
        `Explaining why a misconception about ${label} is wrong`,
      ],
      "evaluate"
    ),
  };

  // Fix misconception correctAnswer to be the misconception statement (it's in options)
  // Already set correctly above.

  const wanted = purposesWanted?.length ? purposesWanted : Object.keys(catalog);
  const out = [];
  for (const purpose of wanted) {
    const q = catalog[purpose];
    if (!q) continue;
    if (isGenericPlaceholderStem(q.prompt) || isFormulaicRepairStem(q.prompt)) continue;
    const key = normalizeStem(q.prompt);
    if (usedStems.has(key)) continue;
    out.push(q);
  }

  // Additional unique MCQs rotating vocab (varied openings, not bank-N)
  const openings = [
    (t) => ({ prompt: `Name the term that fits this function in ${label}: supporting ${t.toLowerCase()}.`, purpose: "recall" }),
    (t) => ({ prompt: `Where does ${t} fit in the sequence for ${label}?`, purpose: "sequence" }),
    (t) => ({ prompt: `How does ${t} change the outcome in ${label}?`, purpose: "application" }),
    (t) => ({
      prompt: `A student claims ${t} is unrelated to ${label}. Which response is best?`,
      purpose: "misconception",
    }),
    (t) => ({ prompt: `What is one precise difference between naming ${t} and explaining ${label}?`, purpose: "comparison" }),
  ];
  for (let i = 0; i < vocab.length; i++) {
    const t = termAt(vocab, i, label);
    const spec = openings[i % openings.length](t);
    const q = makeMcqQuestion(
      spec.prompt,
      t,
      distract(t).length ? distract(t) : [`Unrelated to ${label}`, `Opposite of ${t}`, `Not in ${label}`],
      spec.purpose
    );
    const key = normalizeStem(q.prompt);
    if (usedStems.has(key) || isGenericPlaceholderStem(q.prompt)) continue;
    if (out.some((x) => normalizeStem(x.prompt) === key)) continue;
    out.push(q);
  }
  return out;
}

/** Back-compat exports used by tests */
function shortStemCandidates(topic, vocab, usedStems) {
  return purposeShortCandidates(topic, vocab, usedStems, [
    "recall",
    "misconception",
    "explain",
    "application",
    "definition",
    "comparison",
  ]);
}

function mcqStemCandidates(topic, vocab, usedStems) {
  return purposeMcqCandidates(topic, vocab, usedStems, [
    "recall",
    "misconception",
    "application",
    "comparison",
    "explain",
    "sequence",
    "definition",
    "exam_style",
  ]);
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
  block.purpose = first.purpose;
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

function missingPurposes(questions, requiredGroups) {
  const have = new Set(questions.map((q) => q.purpose || inferQuestionPurpose(q)));
  const missing = [];
  for (const group of requiredGroups) {
    if (!group.some((p) => have.has(p))) missing.push(group[0]);
  }
  return missing;
}

/**
 * Expand to min count while also covering required purposes.
 * May replace formulaic / same-purpose clones when variety is weak.
 */
function expandBlockQuestions(block, minCount, requiredGroups, generators, usedStems, preferShort) {
  let qs = extractQuestionsFromBlock(block).filter(
    (q) => !isGenericPlaceholderStem(q.prompt) && !isFormulaicRepairStem(q.prompt)
  );
  const seenLocal = new Set();
  qs = qs.filter((q) => {
    const k = normalizeStem(q.prompt);
    if (!k || seenLocal.has(k)) return false;
    seenLocal.add(k);
    q.purpose = q.purpose || inferQuestionPurpose(q);
    return true;
  });
  for (const q of qs) usedStems.add(normalizeStem(q.prompt));

  const tryAdd = (candidate) => {
    if (!candidate) return false;
    const key = normalizeStem(candidate.prompt);
    if (!key || usedStems.has(key) || isGenericPlaceholderStem(candidate.prompt)) return false;
    if (isFormulaicRepairStem(candidate.prompt)) return false;
    usedStems.add(key);
    candidate.purpose = candidate.purpose || inferQuestionPurpose(candidate);
    qs.push(candidate);
    return true;
  };

  // Fill missing purposes first
  let guard = 0;
  while (guard++ < 24) {
    const need = missingPurposes(qs, requiredGroups);
    if (!need.length && qs.length >= minCount) break;
    const purposeFocus = need.length ? need : null;
    let added = false;
    for (const gen of generators) {
      const pool = gen(purposeFocus);
      for (const candidate of pool) {
        if (purposeFocus && !purposeFocus.includes(candidate.purpose) && need.length) continue;
        let item = candidate;
        if (preferShort && candidate.questionType === "mcq") {
          item = makeShortQuestion(
            candidate.prompt.replace(/\?$/, "."),
            candidate.correctAnswer,
            candidate.purpose
          );
        }
        if (tryAdd(item)) {
          added = true;
          break;
        }
      }
      if (added) break;
    }
    if (!added && qs.length >= minCount && !need.length) break;
    if (!added) break;
  }

  // Pad to min count with any remaining varied candidates
  for (const gen of generators) {
    if (qs.length >= minCount) break;
    for (const candidate of gen(null)) {
      if (qs.length >= minCount) break;
      let item = candidate;
      if (preferShort && candidate.questionType === "mcq") {
        item = makeShortQuestion(
          candidate.prompt.replace(/\?$/, "."),
          candidate.correctAnswer,
          candidate.purpose
        );
      }
      tryAdd(item);
    }
  }

  // Dedup purposes if we somehow got 3 identical purposes: swap last with a missing purpose
  const needAfter = missingPurposes(qs, requiredGroups);
  if (needAfter.length && qs.length >= minCount) {
    for (const gen of generators) {
      const pool = gen(needAfter);
      for (const candidate of pool) {
        if (!needAfter.includes(candidate.purpose)) continue;
        const key = normalizeStem(candidate.prompt);
        if (usedStems.has(key)) continue;
        // Replace the last duplicate-purpose item
        const purposeCounts = {};
        qs.forEach((q) => {
          purposeCounts[q.purpose] = (purposeCounts[q.purpose] || 0) + 1;
        });
        const replaceIdx = qs.findIndex((q) => (purposeCounts[q.purpose] || 0) > 1);
        if (replaceIdx < 0) break;
        usedStems.delete(normalizeStem(qs[replaceIdx].prompt));
        usedStems.add(key);
        let item = candidate;
        if (preferShort && candidate.questionType === "mcq") {
          item = makeShortQuestion(
            candidate.prompt.replace(/\?$/, "."),
            candidate.correctAnswer,
            candidate.purpose
          );
        }
        qs[replaceIdx] = item;
        break;
      }
    }
  }

  syncLegacyFieldsFromQuestions(block, qs);
  return qs.length >= minCount && missingPurposes(qs, requiredGroups).length === 0;
}

function buildQuizBank(pages, existingQuiz, topic, vocab, usedAcrossActivities, minCount) {
  const bank = [];
  const seen = new Set();
  const requiredGroups = [
    ["recall", "definition"],
    ["misconception"],
    ["application", "sequence"],
    ["comparison", "explain", "exam_style", "evaluate"],
  ];

  const push = (q) => {
    if (!q || q.questionType !== "mcq") return false;
    const key = normalizeStem(q.prompt);
    if (!key || seen.has(key) || usedAcrossActivities.has(key)) return false;
    if (isGenericPlaceholderStem(q.prompt) || isFormulaicRepairStem(q.prompt)) return false;
    if (!Array.isArray(q.options) || q.options.length < 2) return false;
    if (!String(q.correctAnswer || "").trim()) return false;
    seen.add(key);
    const purpose = q.purpose || inferQuestionPurpose(q);
    bank.push({
      id: `gen-quiz-${bank.length + 1}`,
      type: "mcq",
      question: q.prompt,
      options: q.options.slice(0, 4),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || "",
      purpose,
      tags: ["ai-generated", "activity-count-repair", `purpose:${purpose}`],
      difficulty: 2,
      marks: 1,
    });
    return true;
  };

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
      purpose: raw.purpose || raw.skill,
    });
  }

  // Do NOT harvest page-block MCQs into quiz — that clones checkpoint/self-check purposes.
  // Fill with purpose-tagged MCQs instead.
  const purposeOrder = [
    "recall",
    "definition",
    "misconception",
    "application",
    "comparison",
    "explain",
    "sequence",
    "exam_style",
    "evaluate",
  ];
  const mcqs = purposeMcqCandidates(topic, vocab, new Set([...usedAcrossActivities, ...seen]), purposeOrder);
  for (const q of mcqs) {
    if (bank.length >= Math.max(minCount, 5) && missingPurposes(
      bank.map((b) => ({ purpose: b.purpose, prompt: b.question })),
      requiredGroups
    ).length === 0) {
      break;
    }
    push(q);
  }

  // Targeted fill for missing purposes
  let n = 0;
  while (
    (bank.length < minCount ||
      missingPurposes(
        bank.map((b) => ({ purpose: b.purpose, prompt: b.question })),
        requiredGroups
      ).length > 0) &&
    n < 20
  ) {
    n++;
    const missing = missingPurposes(
      bank.map((b) => ({ purpose: b.purpose, prompt: b.question })),
      requiredGroups
    );
    const focus = missing.length ? missing : purposeOrder;
    const more = purposeMcqCandidates(
      topic,
      vocab.map((v, i) => `${v} aspect ${n}`),
      new Set([...usedAcrossActivities, ...seen]),
      focus
    );
    let added = false;
    for (const q of more) {
      if (push(q)) {
        added = true;
        break;
      }
    }
    if (!added) break;
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
    purpose: first.purpose,
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

const SELF_CHECK_REQUIRE = [["recall", "definition"], ["misconception"], ["explain", "application"]];
const CHECKPOINT_REQUIRE = [
  ["recall", "definition", "explain"],
  ["application", "sequence"],
  ["explain", "misconception", "evaluate"],
];

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

  const blocksNow = [];
  for (const page of pages) {
    for (const b of page?.blocks || []) blocksNow.push(b);
  }
  const hasSelf = blocksNow.some((b) => isSelfCheckActivity(b) && !isCheckpointActivity(b));
  const hasCp = blocksNow.some((b) => isCheckpointActivity(b));
  if (!hasSelf) {
    const seeds = purposeShortCandidates(topic, vocab, usedStems, [
      "recall",
      "misconception",
      "explain",
    ]).slice(0, MIN_SELF_CHECK);
    while (seeds.length < MIN_SELF_CHECK) {
      seeds.push(
        makeShortQuestion(
          `Explain one precise mechanism in ${titleCase(topic)} involving ${termAt(vocab, seeds.length, topic)}.`,
          `Use because → therefore for ${titleCase(topic)}.`,
          "explain"
        )
      );
    }
    ensureActivityBlock(pages, "selfCheck", seeds);
    changes.push({ kind: "insert-selfCheck", ok: true, count: seeds.length });
  }
  if (!hasCp) {
    const seeds = purposeMcqCandidates(topic, vocab, usedStems, [
      "recall",
      "application",
      "explain",
    ]).slice(0, MIN_CHECKPOINT);
    while (seeds.length < MIN_CHECKPOINT) {
      const term = termAt(vocab, seeds.length, topic);
      seeds.push(
        makeMcqQuestion(
          `How does ${term} affect the outcome in ${titleCase(topic)}?`,
          term,
          [`Unrelated to ${titleCase(topic)}`, `Opposite of ${term}`, `Not involved`],
          "application"
        )
      );
    }
    ensureActivityBlock(pages, "checkpoint", seeds);
    changes.push({ kind: "insert-checkpoint", ok: true, count: seeds.length });
  }

  for (const page of pages) {
    for (const block of page?.blocks || []) {
      if (!isSelfCheckActivity(block) && !isCheckpointActivity(block)) continue;
      for (const q of extractQuestionsFromBlock(block)) {
        if (!isGenericPlaceholderStem(q.prompt) && !isFormulaicRepairStem(q.prompt)) {
          usedStems.add(normalizeStem(q.prompt));
        }
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
          SELF_CHECK_REQUIRE,
          [
            (focus) => purposeShortCandidates(topic, vocab, usedStems, focus),
            (focus) => purposeMcqCandidates(topic, vocab, usedStems, focus),
          ],
          usedStems,
          true
        );
        changes.push({
          kind: "selfCheck",
          ok,
          count: extractQuestionsFromBlock(block).length,
          purposes: extractQuestionsFromBlock(block).map((q) => q.purpose),
        });
      } else if (isCheckpointActivity(block)) {
        const ok = expandBlockQuestions(
          block,
          MIN_CHECKPOINT,
          CHECKPOINT_REQUIRE,
          [
            (focus) => purposeMcqCandidates(topic, vocab, usedStems, focus),
            (focus) => purposeShortCandidates(topic, vocab, usedStems, focus),
          ],
          usedStems,
          false
        );
        changes.push({
          kind: "checkpoint",
          ok,
          count: extractQuestionsFromBlock(block).length,
          purposes: extractQuestionsFromBlock(block).map((q) => q.purpose),
        });
      }
    }
  }

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
  changes.push({
    kind: "quiz",
    ok: quiz.questions.length >= MIN_QUIZ_POOL,
    count: quiz.questions.length,
    purposes: quiz.questions.map((q) => q.purpose),
  });

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
  purposeShortCandidates,
  purposeMcqCandidates,
  expandBlockQuestions,
  buildQuizBank,
};
