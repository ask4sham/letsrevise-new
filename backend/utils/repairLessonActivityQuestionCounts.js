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
  isWeakFormulaicStem,
  extractQuestionsFromBlock,
  isSelfCheckActivity,
  isCheckpointActivity,
  validateLessonActivityQuestionCounts,
  inferQuestionPurpose,
} = require("./validateLessonActivityQuestionCounts");
const {
  resolveTopicPack,
  genericShortCatalog,
  genericMcqCatalog,
  genericShortExtras,
  genericMcqExtras,
} = require("./activityQuestionStemPacks");

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

function stemIsUsable(prompt, usedStems) {
  if (!prompt) return false;
  if (isGenericPlaceholderStem(prompt) || isFormulaicRepairStem(prompt) || isWeakFormulaicStem(prompt)) {
    return false;
  }
  const key = normalizeStem(prompt);
  if (!key || usedStems.has(key)) return false;
  return true;
}

function pushUniqueQuestion(out, usedStems, q) {
  if (!q || !stemIsUsable(q.prompt, usedStems)) return false;
  const key = normalizeStem(q.prompt);
  if (out.some((x) => normalizeStem(x.prompt) === key)) return false;
  out.push(q);
  return true;
}

/**
 * Purpose-tagged short stems for self-check (and checkpoint explain items).
 * Prefer topic-specific GCSE/IGCSE packs; fall back to exam-style generics (no weak templates).
 */
function purposeShortCandidates(topic, vocab, usedStems, purposesWanted) {
  const pack = resolveTopicPack(topic);
  const generic = genericShortCatalog(topic);
  const wanted = purposesWanted?.length ? purposesWanted : Object.keys(generic);
  const out = [];

  if (pack) {
    for (const purpose of wanted) {
      const hit = (pack.short || []).find(
        (s) =>
          s.purpose === purpose &&
          stemIsUsable(s.prompt, usedStems) &&
          !out.some((x) => normalizeStem(x.prompt) === normalizeStem(s.prompt))
      );
      if (hit) {
        pushUniqueQuestion(out, usedStems, makeShortQuestion(hit.prompt, hit.answer, hit.purpose));
      }
    }
    for (const s of pack.short || []) {
      if (out.length >= 10) break;
      pushUniqueQuestion(out, usedStems, makeShortQuestion(s.prompt, s.answer, s.purpose));
    }
  }

  for (const purpose of wanted) {
    const g = generic[purpose];
    if (!g) continue;
    pushUniqueQuestion(out, usedStems, makeShortQuestion(g.prompt, g.answer, g.purpose));
  }

  for (const s of genericShortExtras(topic, vocab)) {
    if (out.length >= 12) break;
    pushUniqueQuestion(out, usedStems, makeShortQuestion(s.prompt, s.answer, s.purpose));
  }
  return out;
}

/**
 * Purpose-tagged MCQ stems for checkpoint / quiz.
 */
function purposeMcqCandidates(topic, vocab, usedStems, purposesWanted) {
  const pack = resolveTopicPack(topic);
  const generic = genericMcqCatalog(topic, vocab);
  const wanted = purposesWanted?.length ? purposesWanted : Object.keys(generic);
  const out = [];

  if (pack) {
    for (const purpose of wanted) {
      const hit = (pack.mcq || []).find(
        (s) =>
          s.purpose === purpose &&
          stemIsUsable(s.prompt, usedStems) &&
          !out.some((x) => normalizeStem(x.prompt) === normalizeStem(s.prompt))
      );
      if (hit) {
        pushUniqueQuestion(
          out,
          usedStems,
          makeMcqQuestion(hit.prompt, hit.correct, hit.distractors, hit.purpose)
        );
      }
    }
    for (const s of pack.mcq || []) {
      if (out.length >= 12) break;
      pushUniqueQuestion(
        out,
        usedStems,
        makeMcqQuestion(s.prompt, s.correct, s.distractors, s.purpose)
      );
    }
  }

  for (const purpose of wanted) {
    const g = generic[purpose];
    if (!g) continue;
    pushUniqueQuestion(
      out,
      usedStems,
      makeMcqQuestion(g.prompt, g.correct, g.distractors, g.purpose)
    );
  }

  for (const s of genericMcqExtras(topic, vocab)) {
    if (out.length >= 16) break;
    pushUniqueQuestion(
      out,
      usedStems,
      makeMcqQuestion(s.prompt, s.correct, s.distractors, s.purpose)
    );
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
    (q) =>
      !isGenericPlaceholderStem(q.prompt) &&
      !isFormulaicRepairStem(q.prompt) &&
      !isWeakFormulaicStem(q.prompt)
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
    if (isFormulaicRepairStem(candidate.prompt) || isWeakFormulaicStem(candidate.prompt)) return false;
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
    if (
      isGenericPlaceholderStem(q.prompt) ||
      isFormulaicRepairStem(q.prompt) ||
      isWeakFormulaicStem(q.prompt)
    ) {
      return false;
    }
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
      const used = new Set(seeds.map((s) => normalizeStem(s.prompt)));
      const more = purposeShortCandidates(topic, vocab, used, [
        "explain",
        "application",
        "comparison",
        "definition",
      ]);
      if (more.length) {
        seeds.push(more[0]);
        continue;
      }
      seeds.push(
        makeShortQuestion(
          `Outline cause-and-effect link ${seeds.length + 1} for this process.`,
          `State a cause and its effect linked to ${titleCase(topic) || "this process"}.`,
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
      const used = new Set(seeds.map((s) => normalizeStem(s.prompt)));
      const more = purposeMcqCandidates(topic, vocab, used, [
        "application",
        "sequence",
        "explain",
        "comparison",
      ]);
      if (more.length) {
        seeds.push(more[0]);
        continue;
      }
      const g = genericMcqCatalog(topic, vocab).application;
      seeds.push(
        makeMcqQuestion(
          `${g.prompt} (check ${seeds.length + 1})`,
          g.correct,
          g.distractors,
          g.purpose
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
        if (
          !isGenericPlaceholderStem(q.prompt) &&
          !isFormulaicRepairStem(q.prompt) &&
          !isWeakFormulaicStem(q.prompt)
        ) {
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
