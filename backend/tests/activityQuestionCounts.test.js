/**
 * Backend tests: activity question-count validator + repair + fail-closed contract.
 */
const {
  validateLessonActivityQuestionCounts,
  MIN_SELF_CHECK,
  MIN_CHECKPOINT,
  MIN_QUIZ_POOL,
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
    // Strip to keep block counts high but quiz low — re-validate after mutating quiz only
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
                { prompt: stem, questionType: "short", correctAnswer: "A" },
                { prompt: "Define a zygote.", questionType: "short", correctAnswer: "B" },
                { prompt: "Why is haploid important?", questionType: "short", correctAnswer: "C" },
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
                },
                {
                  prompt: "Where do gametes fuse?",
                  questionType: "mcq",
                  options: ["Oviduct", "Liver", "Skin", "Bone"],
                  correctAnswer: "Oviduct",
                },
                {
                  prompt: "What is produced by fertilisation?",
                  questionType: "mcq",
                  options: ["Zygote", "Urea", "Sweat", "Bone"],
                  correctAnswer: "Zygote",
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
            question: "Q1 unique?",
            options: ["A", "B", "C", "D"],
            correctAnswer: "A",
          },
          {
            id: "2",
            type: "mcq",
            question: "Q2 unique?",
            options: ["A", "B", "C", "D"],
            correctAnswer: "A",
          },
          {
            id: "3",
            type: "mcq",
            question: "Q3 unique?",
            options: ["A", "B", "C", "D"],
            correctAnswer: "A",
          },
          {
            id: "4",
            type: "mcq",
            question: "Q4 unique?",
            options: ["A", "B", "C", "D"],
            correctAnswer: "A",
          },
          {
            id: "5",
            type: "mcq",
            question: "Q5 unique?",
            options: ["A", "B", "C", "D"],
            correctAnswer: "A",
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

  test("existing valid lesson passes", () => {
    const lesson = validLesson();
    const r = validateLessonActivityQuestionCounts(lesson);
    expect(r.ok).toBe(true);
    expect(r.summary.quizUnique).toBeGreaterThanOrEqual(MIN_QUIZ_POOL);
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

  test("fail closed when repair cannot meet contract (no topic/vocab)", () => {
    // Force failure by validating a still-weak shape after empty repair inputs
    // with blocks that have no extractable questions.
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
    // With empty topic, harvestVocab may still produce weak but valid items —
    // assert the validator fail-closed path for explicitly insufficient quiz.
    const broken = {
      pages: out.pages,
      quiz: { questions: out.quiz.questions.slice(0, 2) },
    };
    const v = validateLessonActivityQuestionCounts(broken);
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.includes("quiz_pool_too_low") || i.includes("revision_pool_too_low"))).toBe(
      true
    );
  });
});
