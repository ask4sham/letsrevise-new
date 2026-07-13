/**
 * Backend tests: activity question-count + variety validator + repair + fail-closed contract.
 */
const {
  validateLessonActivityQuestionCounts,
  MIN_SELF_CHECK,
  MIN_CHECKPOINT,
  MAX_SELF_CHECK,
  MAX_CHECKPOINT,
  MIN_QUIZ_POOL,
  inferQuestionPurpose,
} = require("../utils/validateLessonActivityQuestionCounts");
const {
  repairLessonActivityQuestionCounts,
} = require("../utils/repairLessonActivityQuestionCounts");

function weakLesson() {
  return {
    pages: [
      {
        title: "Page 1",
        blocks: [
          {
            type: "selfCheck",
            prompt: "Define fertilisation in humans.",
            questionType: "short",
            options: [],
            correctAnswer: "Fusion of gametes nuclei.",
          },
          {
            type: "checkpoint",
            prompt: "Which structure produces sperm?",
            questionType: "mcq",
            options: ["Testis", "Ovary", "Uterus", "Liver"],
            correctAnswer: "Testis",
          },
        ],
      },
    ],
    quiz: { timeSeconds: 600, questions: [] },
  };
}

function validLesson() {
  const repaired = repairLessonActivityQuestionCounts(
    {
      pages: [
        {
          blocks: [
            {
              type: "selfCheck",
              prompt: "Define fertilisation.",
              questionType: "short",
              correctAnswer: "Fusion of nuclei.",
            },
            {
              type: "checkpoint",
              prompt: "Where does fertilisation usually occur?",
              questionType: "mcq",
              options: ["Oviduct", "Stomach", "Skin", "Bone"],
              correctAnswer: "Oviduct",
            },
          ],
        },
      ],
      quiz: { questions: [] },
    },
    {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote", "oviduct", "acrosome"],
      structures: ["sperm", "egg", "oviduct"],
    }
  );
  return { pages: repaired.pages, quiz: repaired.quiz };
}

function fiveSamePatternMcqs() {
  return Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    type: "mcq",
    question: `Which statement best explains idea ${i + 1} about fertilisation?`,
    options: ["A", "B", "C", "D"],
    correctAnswer: "A",
    purpose: "recall",
  }));
}

describe("validateLessonActivityQuestionCounts", () => {
  test("rejects self-check with 1 question", () => {
    const lesson = weakLesson();
    lesson.pages[0].blocks = [lesson.pages[0].blocks[0]];
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.includes("activity_question_count_too_low:selfCheck"))).toBe(
      true
    );
  });

  test("rejects checkpoint with 1 question", () => {
    const lesson = weakLesson();
    lesson.pages[0].blocks = [lesson.pages[0].blocks[1]];
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.includes("activity_question_count_too_low:checkpoint"))).toBe(
      true
    );
  });

  test("rejects quiz pool below 5", () => {
    const lesson = validLesson();
    lesson.quiz = {
      questions: [
        {
          id: "1",
          type: "mcq",
          question: "Only one quiz Q?",
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
        },
      ],
    };
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.startsWith("quiz_pool_too_low"))).toBe(true);
  });

  test("rejects revision pool below 5", () => {
    const lesson = validLesson();
    lesson.quiz = { questions: [] };
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.issues.some((i) => i.startsWith("revision_pool_too_low"))).toBe(true);
  });

  test("rejects duplicate stems across activities", () => {
    const stem = "Explain the role of the acrosome in fertilisation.";
    const lesson = {
      pages: [
        {
          blocks: [
            {
              type: "selfCheck",
              questions: [
                { prompt: stem, questionType: "short", correctAnswer: "A", purpose: "explain" },
                {
                  prompt: "Define a zygote.",
                  questionType: "short",
                  correctAnswer: "B",
                  purpose: "definition",
                },
                {
                  prompt: "A student says sperm are diploid. Explain why this is incorrect.",
                  questionType: "short",
                  correctAnswer: "C",
                  purpose: "misconception",
                },
              ],
            },
            {
              type: "checkpoint",
              questions: [
                {
                  prompt: stem,
                  questionType: "mcq",
                  options: ["A", "B", "C", "D"],
                  correctAnswer: "A",
                  purpose: "explain",
                },
                {
                  prompt: "Where do gametes fuse?",
                  questionType: "mcq",
                  options: ["Oviduct", "Liver", "Skin", "Bone"],
                  correctAnswer: "Oviduct",
                  purpose: "recall",
                },
                {
                  prompt: "In a scenario where the oviduct is blocked, what happens to fertilisation?",
                  questionType: "mcq",
                  options: ["It is prevented", "It speeds up", "Nothing", "More zygotes"],
                  correctAnswer: "It is prevented",
                  purpose: "application",
                },
              ],
            },
          ],
        },
      ],
      quiz: {
        questions: [
          {
            id: "1",
            type: "mcq",
            question: "What is a gamete?",
            options: ["A", "B", "C", "D"],
            correctAnswer: "A",
            purpose: "recall",
          },
          {
            id: "2",
            type: "mcq",
            question: "Which statement shows a common misconception about zygotes?",
            options: ["A", "B", "C", "D"],
            correctAnswer: "A",
            purpose: "misconception",
          },
          {
            id: "3",
            type: "mcq",
            question: "How do sperm and egg differ?",
            options: ["A", "B", "C", "D"],
            correctAnswer: "A",
            purpose: "comparison",
          },
          {
            id: "4",
            type: "mcq",
            question: "In a fertility clinic scenario, why does blocked oviduct matter?",
            options: ["A", "B", "C", "D"],
            correctAnswer: "A",
            purpose: "application",
          },
          {
            id: "5",
            type: "mcq",
            question: "Define fertilisation for an exam mark.",
            options: ["A", "B", "C", "D"],
            correctAnswer: "A",
            purpose: "definition",
          },
        ],
      },
    };
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.startsWith("activity_duplicate_stem"))).toBe(true);
  });

  test("rejects generic placeholder stems", () => {
    const lesson = {
      pages: [
        {
          blocks: [
            {
              type: "selfCheck",
              questions: [
                {
                  prompt: "Which statement best explains a key idea about fertilisation?",
                  questionType: "short",
                  correctAnswer: "x",
                },
                { prompt: "Define zygote.", questionType: "short", correctAnswer: "y" },
                { prompt: "Explain sperm motility.", questionType: "short", correctAnswer: "z" },
              ],
            },
          ],
        },
      ],
      quiz: {
        questions: Array.from({ length: 5 }, (_, i) => ({
          id: String(i),
          type: "mcq",
          question: `Unique quiz ${i}?`,
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
        })),
      },
    };
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.startsWith("activity_generic_placeholder_stem"))).toBe(true);
  });

  test("rejects missing self-check activity", () => {
    const lesson = {
      pages: [
        {
          blocks: [
            {
              type: "checkpoint",
              questions: [
                {
                  prompt: "CP1 recall?",
                  questionType: "mcq",
                  options: ["A", "B", "C", "D"],
                  correctAnswer: "A",
                  purpose: "recall",
                },
                {
                  prompt: "In a scenario, what happens if X is missing?",
                  questionType: "mcq",
                  options: ["A", "B", "C", "D"],
                  correctAnswer: "B",
                  purpose: "application",
                },
                {
                  prompt: "Explain why Y is needed.",
                  questionType: "mcq",
                  options: ["A", "B", "C", "D"],
                  correctAnswer: "C",
                  purpose: "explain",
                },
              ],
            },
          ],
        },
      ],
      quiz: {
        questions: Array.from({ length: 5 }, (_, i) => ({
          id: String(i),
          type: "mcq",
          question: `Quiz ${i} varied purpose item?`,
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          purpose: ["recall", "misconception", "application", "comparison", "definition"][i],
        })),
      },
    };
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i === "activity_missing:selfCheck")).toBe(true);
  });

  test("existing valid lesson passes", () => {
    const lesson = validLesson();
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(true);
    expect(r.summary.quizUnique).toBeGreaterThanOrEqual(MIN_QUIZ_POOL);
  });

  test("variety rejects five same-pattern MCQs", () => {
    const lesson = validLesson();
    lesson.quiz = { questions: fiveSamePatternMcqs() };
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(
      r.issues.some(
        (i) =>
          i.includes("activity_repeated_stem_pattern") ||
          i.includes("activity_question_variety_too_low") ||
          i.includes("activity_generic_placeholder_stem")
      )
    ).toBe(true);
  });

  test("variety rejects repeated Which statement best stems", () => {
    const lesson = validLesson();
    const sc = lesson.pages[0].blocks.find((b) => b.type === "selfCheck");
    sc.questions = [
      {
        prompt: "Which statement best explains gametes?",
        questionType: "short",
        correctAnswer: "a",
        purpose: "recall",
      },
      {
        prompt: "Which statement best explains fertilisation?",
        questionType: "short",
        correctAnswer: "b",
        purpose: "misconception",
      },
      {
        prompt: "Which statement best explains zygotes?",
        questionType: "short",
        correctAnswer: "c",
        purpose: "explain",
      },
    ];
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.includes("activity_repeated_stem_pattern"))).toBe(true);
  });

  test("variety rejects all-recall activity", () => {
    const lesson = validLesson();
    const sc = lesson.pages[0].blocks.find((b) => b.type === "selfCheck");
    sc.questions = [
      { prompt: "Name a gamete.", questionType: "short", correctAnswer: "sperm", purpose: "recall" },
      {
        prompt: "Name a zygote feature.",
        questionType: "short",
        correctAnswer: "diploid",
        purpose: "recall",
      },
      {
        prompt: "Identify the oviduct.",
        questionType: "short",
        correctAnswer: "tube",
        purpose: "recall",
      },
    ];
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(
      r.issues.some(
        (i) =>
          i.includes("activity_question_variety_too_low") ||
          i.includes("activity_missing_misconception") ||
          i.includes("activity_missing_application")
      )
    ).toBe(true);
  });
});

describe("repairLessonActivityQuestionCounts", () => {
  test("repair replenishes self-check to 3", () => {
    const weak = weakLesson();
    const out = repairLessonActivityQuestionCounts(weak, {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote", "acrosome", "oviduct"],
    });
    const sc = out.pages[0].blocks.find((b) => b.type === "selfCheck");
    expect(Array.isArray(sc.questions)).toBe(true);
    expect(sc.questions.length).toBeGreaterThanOrEqual(MIN_SELF_CHECK);
  });

  test("repair replenishes checkpoint to 3", () => {
    const weak = weakLesson();
    const out = repairLessonActivityQuestionCounts(weak, {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote", "acrosome", "oviduct"],
    });
    const cp = out.pages[0].blocks.find((b) => b.type === "checkpoint");
    expect(cp.questions.length).toBeGreaterThanOrEqual(MIN_CHECKPOINT);
  });

  test("repair replenishes quiz/revision to 5", () => {
    const weak = weakLesson();
    const out = repairLessonActivityQuestionCounts(weak, {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote", "acrosome", "oviduct"],
    });
    expect(out.quiz.questions.length).toBeGreaterThanOrEqual(MIN_QUIZ_POOL);
    expect(out.validation.ok).toBe(true);
  });

  test("repair replenishes with varied purposes", () => {
    const weak = weakLesson();
    const out = repairLessonActivityQuestionCounts(weak, {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote", "acrosome", "oviduct"],
    });
    const sc = out.pages[0].blocks.find((b) => b.type === "selfCheck");
    const purposes = new Set(sc.questions.map((q) => q.purpose || inferQuestionPurpose(q)));
    expect(purposes.size).toBeGreaterThanOrEqual(3);
    expect(out.validation.ok).toBe(true);
  });

  test("repair does not add formulaic bank-N clone questions", () => {
    const weak = weakLesson();
    const out = repairLessonActivityQuestionCounts(weak, {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote", "acrosome", "oviduct"],
    });
    for (const q of out.quiz.questions) {
      expect(String(q.question)).not.toMatch(/\(bank\s+\d+\)/i);
    }
  });

  test("revision practice does not clone checkpoint stem", () => {
    const out = repairLessonActivityQuestionCounts(weakLesson(), {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote", "acrosome", "oviduct"],
    });
    const cp = out.pages[0].blocks.find((b) => b.type === "checkpoint");
    const cpStems = new Set(cp.questions.map((q) => String(q.prompt).toLowerCase().trim()));
    for (const q of out.quiz.questions) {
      expect(cpStems.has(String(q.question).toLowerCase().trim())).toBe(false);
    }
  });

  test("duplicate removal then replenish keeps count >= minimum", () => {
    const stem = "Define fertilisation clearly.";
    const lesson = {
      pages: [
        {
          blocks: [
            {
              type: "selfCheck",
              questions: [
                { prompt: stem, questionType: "short", correctAnswer: "a" },
                { prompt: stem, questionType: "short", correctAnswer: "a" },
                { prompt: stem, questionType: "short", correctAnswer: "a" },
              ],
            },
            {
              type: "checkpoint",
              prompt: "Which organ releases eggs?",
              questionType: "mcq",
              options: ["Ovary", "Liver", "Skin", "Bone"],
              correctAnswer: "Ovary",
            },
          ],
        },
      ],
      quiz: { questions: [] },
    };
    const out = repairLessonActivityQuestionCounts(lesson, {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote", "acrosome", "oviduct", "nucleus"],
    });
    const sc = out.pages[0].blocks.find((b) => b.type === "selfCheck");
    expect(sc.questions.length).toBeGreaterThanOrEqual(MIN_SELF_CHECK);
    expect(out.validation.ok).toBe(true);
  });

  test("repair inserts missing self-check and reaches quiz 5", () => {
    const lesson = {
      pages: [
        {
          blocks: [
            {
              type: "checkpoint",
              prompt: "Only checkpoint?",
              questionType: "mcq",
              options: ["A", "B", "C", "D"],
              correctAnswer: "A",
            },
          ],
        },
      ],
      quiz: { questions: [] },
    };
    const out = repairLessonActivityQuestionCounts(lesson, {
      topic: "Sexual & Asexual Reproduction: Differences",
      vocabulary: ["gamete", "clone", "mitosis", "meiosis", "variation"],
    });
    const sc = out.pages[0].blocks.find((b) => b.type === "selfCheck");
    expect(sc).toBeTruthy();
    expect(sc.questions.length).toBeGreaterThanOrEqual(MIN_SELF_CHECK);
    expect(out.quiz.questions.length).toBeGreaterThanOrEqual(MIN_QUIZ_POOL);
    expect(out.validation.ok).toBe(true);
  });

  test("generated valid activity with varied purposes passes", () => {
    const lesson = validLesson();
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(true);
    expect(r.summary.varietyIssueCount).toBe(0);
  });

  test("fail closed when repair cannot meet contract (no topic/vocab)", () => {
    const empty = {
      pages: [
        {
          blocks: [
            { type: "selfCheck", prompt: "", questionType: "short" },
            { type: "checkpoint", prompt: "", questionType: "mcq", options: [] },
          ],
        },
      ],
      quiz: { questions: [] },
    };
    const out = repairLessonActivityQuestionCounts(empty, { topic: "" });
    const broken = {
      pages: out.pages,
      quiz: { questions: out.quiz.questions.slice(0, 2) },
    };
    const v = validateLessonActivityQuestionCounts(broken);
    expect(v.ok).toBe(false);
    expect(
      v.issues.some((i) => i.includes("quiz_pool_too_low") || i.includes("revision_pool_too_low"))
    ).toBe(true);
  });
});

function collectActivityStems(lessonLike) {
  const stems = [];
  for (const page of lessonLike.pages || []) {
    for (const block of page.blocks || []) {
      for (const q of block.questions || []) {
        stems.push(String(q.prompt || q.question || ""));
      }
      if (!block.questions?.length && (block.prompt || block.question)) {
        stems.push(String(block.prompt || block.question));
      }
    }
  }
  for (const q of lessonLike.quiz?.questions || []) {
    stems.push(String(q.question || q.prompt || ""));
  }
  return stems;
}

describe("activity question stem quality", () => {
  test("validator rejects Identify the role of X in Y", () => {
    const lesson = validLesson();
    const sc = lesson.pages[0].blocks.find((b) => b.type === "selfCheck");
    sc.questions[0].prompt =
      "Identify the role of Gametes in Gametes & Fertilisation.";
    sc.questions[0].question = sc.questions[0].prompt;
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.includes("generic_placeholder_stem"))).toBe(true);
  });

  test("validator rejects Which option correctly defines X for Y", () => {
    const lesson = validLesson();
    const cp = lesson.pages[0].blocks.find((b) => b.type === "checkpoint");
    cp.questions[0].prompt =
      "Which option correctly defines Gametes for Gametes & Fertilisation?";
    cp.questions[0].question = cp.questions[0].prompt;
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.includes("generic_placeholder_stem"))).toBe(true);
  });

  test("validator rejects A student says X alone completes Y", () => {
    const lesson = validLesson();
    const sc = lesson.pages[0].blocks.find((b) => b.type === "selfCheck");
    sc.questions[1].prompt =
      "A student says Gametes alone completes Gametes & Fertilisation. Explain why this is a misconception.";
    sc.questions[1].question = sc.questions[1].prompt;
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.includes("generic_placeholder_stem"))).toBe(true);
  });

  test("repair for Gametes & Fertilisation produces biology-specific stems", () => {
    const out = repairLessonActivityQuestionCounts(weakLesson(), {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote", "acrosome", "oviduct"],
    });
    const stems = collectActivityStems({ pages: out.pages, quiz: out.quiz });
    const joined = stems.join("\n");
    expect(out.validation.ok).toBe(true);
    expect(joined).toMatch(/gamete|fertilis|meiosis|zygote|chromosome/i);
    expect(joined).not.toMatch(/Identify the role of/i);
    expect(joined).not.toMatch(/Which option correctly defines .+ for/i);
    expect(joined).not.toMatch(/alone completes/i);
    expect(joined).not.toMatch(/use of .+ in medicine/i);
  });

  test("repair for Sexual & Asexual Reproduction produces biology-specific stems", () => {
    const out = repairLessonActivityQuestionCounts(weakLesson(), {
      topic: "Sexual & Asexual Reproduction: Differences",
      vocabulary: ["gamete", "clone", "mitosis", "meiosis", "variation"],
    });
    const stems = collectActivityStems({ pages: out.pages, quiz: out.quiz });
    const joined = stems.join("\n");
    expect(out.validation.ok).toBe(true);
    expect(joined).toMatch(/sexual|asexual|meiosis|mitosis|variation|parent/i);
    expect(joined).not.toMatch(/Identify the role of/i);
    expect(joined).not.toMatch(/Which option correctly defines .+ for/i);
    expect(joined).not.toMatch(/alone completes/i);
  });

  test("repair preserves self-check >= 3 with quality stems", () => {
    const out = repairLessonActivityQuestionCounts(weakLesson(), {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote"],
    });
    const sc = out.pages[0].blocks.find((b) => b.type === "selfCheck");
    expect(sc.questions.length).toBeGreaterThanOrEqual(MIN_SELF_CHECK);
    expect(out.validation.ok).toBe(true);
  });

  test("repair preserves checkpoint >= 3 with quality stems", () => {
    const out = repairLessonActivityQuestionCounts(weakLesson(), {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote"],
    });
    const cp = out.pages[0].blocks.find((b) => b.type === "checkpoint");
    expect(cp.questions.length).toBeGreaterThanOrEqual(MIN_CHECKPOINT);
    expect(out.validation.ok).toBe(true);
  });

  test("repair preserves quiz/revision >= 5 with quality stems", () => {
    const out = repairLessonActivityQuestionCounts(weakLesson(), {
      topic: "Sexual & Asexual Reproduction: Differences",
      vocabulary: ["gamete", "clone", "mitosis", "meiosis"],
    });
    expect(out.quiz.questions.length).toBeGreaterThanOrEqual(MIN_QUIZ_POOL);
    expect(out.validation.ok).toBe(true);
  });

  test("repair preserves purpose variety without weak templates", () => {
    const out = repairLessonActivityQuestionCounts(weakLesson(), {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote", "oviduct"],
    });
    const sc = out.pages[0].blocks.find((b) => b.type === "selfCheck");
    const purposes = new Set(sc.questions.map((q) => q.purpose || inferQuestionPurpose(q)));
    expect(purposes.size).toBeGreaterThanOrEqual(3);
    expect(out.validation.ok).toBe(true);
    expect(out.validation.summary.varietyIssueCount).toBe(0);
  });

  test("no repeated Which statement best pattern beyond allowed misconception item", () => {
    const out = repairLessonActivityQuestionCounts(weakLesson(), {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote"],
    });
    const stems = collectActivityStems({ pages: out.pages, quiz: out.quiz });
    const bestCount = stems.filter((s) => /^which statement best\b/i.test(s)).length;
    expect(bestCount).toBeLessThanOrEqual(1);
    const lesson = validLesson();
    lesson.quiz.questions = fiveSamePatternMcqs();
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(
      r.issues.some(
        (i) => i.includes("which_statement") || i.includes("which_statement_best")
      )
    ).toBe(true);
  });
});

describe("checkpoint/self-check max-3 and filler prune", () => {
  test("validator rejects checkpoint with 4 questions", () => {
    const lesson = validLesson();
    const cp = lesson.pages[0].blocks.find((b) => b.type === "checkpoint");
    cp.questions.push({
      prompt: "Extra fourth checkpoint question about fertilisation?",
      questionType: "mcq",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
      purpose: "evaluate",
    });
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.includes("activity_question_count_too_high:checkpoint"))).toBe(
      true
    );
  });

  test("validator rejects self-check with 4 questions", () => {
    const lesson = validLesson();
    const sc = lesson.pages[0].blocks.find((b) => b.type === "selfCheck");
    sc.questions.push({
      prompt: "Extra fourth self-check about zygotes?",
      questionType: "short",
      correctAnswer: "A",
      purpose: "evaluate",
    });
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.includes("activity_question_count_too_high:selfCheck"))).toBe(
      true
    );
  });

  test("validator rejects weak checkpoint filler stems", () => {
    const fillers = [
      "Describe how Gametes & Fertilisation might be tested in an exam (2 marks).",
      "Which cause → effect chain best explains Gametes & Fertilisation?",
      "If a key factor in this process is missing, what is most likely?",
      "Why is a later step in this process able to happen?",
    ];
    for (const stem of fillers) {
      const lesson = validLesson();
      const cp = lesson.pages[0].blocks.find((b) => b.type === "checkpoint");
      cp.questions[0].prompt = stem;
      cp.questions[0].question = stem;
      const r = validateLessonActivityQuestionCounts(lesson);
      expect(r.ok).toBe(false);
      expect(r.issues.some((i) => i.includes("generic_placeholder_stem"))).toBe(true);
    }
  });

  test("repair caps checkpoint to 3", () => {
    const lesson = {
      pages: [
        {
          blocks: [
            {
              type: "selfCheck",
              questions: [
                { prompt: "Define a gamete.", questionType: "short", correctAnswer: "a", purpose: "definition" },
                {
                  prompt: "A student says fertilisation produces gametes. Explain why this is incorrect.",
                  questionType: "short",
                  correctAnswer: "b",
                  purpose: "misconception",
                },
                {
                  prompt: "Why must gametes be haploid?",
                  questionType: "short",
                  correctAnswer: "c",
                  purpose: "explain",
                },
              ],
            },
            {
              type: "checkpoint",
              questions: [
                { prompt: "What is a gamete?", questionType: "mcq", options: ["A", "B", "C", "D"], correctAnswer: "A", purpose: "recall" },
                {
                  prompt: "Why is meiosis needed before fertilisation?",
                  questionType: "mcq",
                  options: ["A", "B", "C", "D"],
                  correctAnswer: "A",
                  purpose: "explain",
                },
                {
                  prompt: "If an egg cell were diploid, what is most likely after fertilisation?",
                  questionType: "mcq",
                  options: ["A", "B", "C", "D"],
                  correctAnswer: "A",
                  purpose: "application",
                },
                {
                  prompt: "Describe fertilisation of nuclei.",
                  questionType: "mcq",
                  options: ["A", "B", "C", "D"],
                  correctAnswer: "A",
                  purpose: "definition",
                },
              ],
            },
          ],
        },
      ],
      quiz: { questions: [] },
    };
    const out = repairLessonActivityQuestionCounts(lesson, {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote"],
    });
    const cp = out.pages[0].blocks.find((b) => b.type === "checkpoint");
    expect(cp.questions.length).toBeLessThanOrEqual(MAX_CHECKPOINT);
    expect(cp.questions.length).toBe(MIN_CHECKPOINT);
    expect(out.validation.ok).toBe(true);
  });

  test("repair caps self-check to 3", () => {
    const lesson = {
      pages: [
        {
          blocks: [
            {
              type: "selfCheck",
              questions: [
                { prompt: "Q1 define gamete", questionType: "short", correctAnswer: "a", purpose: "definition" },
                { prompt: "Q2 misconception fertilisation", questionType: "short", correctAnswer: "b", purpose: "misconception" },
                { prompt: "Q3 explain meiosis", questionType: "short", correctAnswer: "c", purpose: "explain" },
                { prompt: "Q4 compare gamete body cell", questionType: "short", correctAnswer: "d", purpose: "comparison" },
              ],
            },
            {
              type: "checkpoint",
              questions: [
                { prompt: "What is a gamete?", questionType: "mcq", options: ["A", "B", "C", "D"], correctAnswer: "A", purpose: "recall" },
                {
                  prompt: "Why is meiosis needed before fertilisation?",
                  questionType: "mcq",
                  options: ["A", "B", "C", "D"],
                  correctAnswer: "A",
                  purpose: "explain",
                },
                {
                  prompt: "If an egg were diploid what happens?",
                  questionType: "mcq",
                  options: ["A", "B", "C", "D"],
                  correctAnswer: "A",
                  purpose: "application",
                },
              ],
            },
          ],
        },
      ],
      quiz: { questions: [] },
    };
    const out = repairLessonActivityQuestionCounts(lesson, {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote"],
    });
    const sc = out.pages[0].blocks.find((b) => b.type === "selfCheck");
    expect(sc.questions.length).toBeLessThanOrEqual(MAX_SELF_CHECK);
    expect(sc.questions.length).toBe(MIN_SELF_CHECK);
  });

  test("repair does not add second generic checkpoint block", () => {
    const lesson = {
      pages: [
        {
          blocks: [
            {
              type: "selfCheck",
              prompt: "Define fertilisation.",
              questionType: "short",
              correctAnswer: "Fusion of nuclei.",
            },
            {
              type: "checkpoint",
              prompt: "What is a gamete?",
              questionType: "mcq",
              options: ["Sex cell", "Liver", "Bone", "Skin"],
              correctAnswer: "Sex cell",
            },
            {
              type: "checkpoint",
              prompt: "Which cause → effect chain best explains Gametes & Fertilisation?",
              questionType: "mcq",
              options: ["A", "B", "C", "D"],
              correctAnswer: "A",
              role: "quickCheck",
            },
          ],
        },
      ],
      quiz: { questions: [] },
    };
    const out = repairLessonActivityQuestionCounts(lesson, {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote", "meiosis"],
    });
    const cps = out.pages[0].blocks.filter((b) => b.type === "checkpoint");
    expect(cps.length).toBe(1);
    expect(cps[0].questions.length).toBe(MIN_CHECKPOINT);
    const stems = cps[0].questions.map((q) => q.prompt).join("\n");
    expect(stems).not.toMatch(/might be tested in an exam/i);
    expect(stems).not.toMatch(/cause\s*(→|->|to)\s*effect chain best explains/i);
    expect(stems).not.toMatch(/key factor in this process is missing/i);
    expect(stems).not.toMatch(/later step in this process/i);
    expect(out.quiz.questions.length).toBeGreaterThanOrEqual(MIN_QUIZ_POOL);
    expect(out.validation.ok).toBe(true);
  });

  test("Gametes checkpoint repair produces topic-specific stems", () => {
    const out = repairLessonActivityQuestionCounts(weakLesson(), {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote"],
    });
    const cp = out.pages[0].blocks.find((b) => b.type === "checkpoint");
    const joined = cp.questions.map((q) => q.prompt).join("\n");
    expect(cp.questions.length).toBe(3);
    expect(joined).toMatch(/gamete|fertilis|meiosis|zygote|chromosome|egg|sperm/i);
    expect(joined).not.toMatch(/might be tested in an exam/i);
    expect(joined).not.toMatch(/cause\s*(→|->|to)\s*effect chain best explains/i);
  });

  test("Sexual/Asexual checkpoint repair produces topic-specific stems", () => {
    const out = repairLessonActivityQuestionCounts(weakLesson(), {
      topic: "Sexual & Asexual Reproduction: Differences",
      vocabulary: ["gamete", "clone", "mitosis", "meiosis"],
    });
    const cp = out.pages[0].blocks.find((b) => b.type === "checkpoint");
    const joined = cp.questions.map((q) => q.prompt).join("\n");
    expect(cp.questions.length).toBe(3);
    expect(joined).toMatch(/sexual|asexual|meiosis|mitosis|variation|parent|gamete/i);
    expect(joined).not.toMatch(/might be tested in an exam/i);
    expect(joined).not.toMatch(/later step in this process/i);
  });

  test("quiz/revision remains 5 after checkpoint cap repair", () => {
    const out = repairLessonActivityQuestionCounts(weakLesson(), {
      topic: "Gametes & Fertilisation",
      vocabulary: ["sperm", "egg", "zygote"],
    });
    expect(out.quiz.questions.length).toBeGreaterThanOrEqual(MIN_QUIZ_POOL);
  });
});
