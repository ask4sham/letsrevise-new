/**
 * Backend tests: activity question-count + variety validator + repair + fail-closed contract.
 */
const {
  validateLessonActivityQuestionCounts,
  MIN_SELF_CHECK,
  MIN_CHECKPOINT,
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
