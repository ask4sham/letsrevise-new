jest.mock("../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

/* eslint-disable import/first -- jest.mock must run before modules under test */
import { LESSON_GENERATOR_EXPORT_FORMAT_V1 } from "../constants/lessonGeneratorExchange.v1";
import {
  buildPagesFromGeneratorExport,
  resolveCheckpointBlockForCreateLessonPersist,
  type GeneratorExportV1Document,
} from "./lessonGeneratorImport";
import { LEARN_TESTING_BLOCK_TYPES, isLearnTeachingPage } from "./lessonPageGuards";
import {
  buildRevisionPracticePool,
  buildLessonQuestionLayers,
} from "./lessonQuestionPools";
import {
  collectCheckpointMcqsFromPages,
  collectPageQuizMcqsFromPages,
  collectRevisionPracticeMcqSources,
} from "./revisionPracticeVariants";
/* eslint-enable import/first */

const FILLER_PROMPT = /^which statement is correct\??$/i;
const FILLER_OPTION = /^\[?option\s*[1-4]\]?$/i;

const CHECKPOINT_1_STEM =
  "Explain why antibiotic resistance can increase in a bacterial population exposed to an antibiotic.";
const CHECKPOINT_1_ANSWER =
  "The antibiotic kills susceptible bacteria, while resistant bacteria survive. The survivors reproduce, so resistant bacteria form a greater proportion of the population.";
const CHECKPOINT_1_EXPL =
  "Resistant bacteria are not created by the antibiotic; they survive and reproduce.";

function shortPayload(prompt: string, answer: string, explanation = "") {
  return {
    questionType: "short" as const,
    prompt,
    options: [] as string[],
    correctAnswer: answer,
    explanation,
  };
}

function mcqQuestion(
  id: string,
  prompt: string,
  options: [string, string, string, string],
  correctAnswer: string
) {
  return {
    id,
    questionType: "mcq" as const,
    type: "mcq",
    prompt,
    question: prompt,
    options: [...options],
    correctAnswer,
    explanation: `Select “${correctAnswer}”.`,
  };
}

const QUIZ_MCQS = [
  mcqQuestion(
    "quiz-1",
    "A bacterial population is exposed to an antibiotic. What process explains the later increase in antibiotic resistance?",
    [
      "Resistant bacteria survive and reproduce",
      "Every bacterium mutates at once",
      "Antibiotics create resistance genes",
      "White blood cells stop working",
    ],
    "Resistant bacteria survive and reproduce"
  ),
  mcqQuestion(
    "quiz-2",
    "How does a bacterial population after repeated antibiotic treatment compare with the original population?",
    [
      "It may contain a higher proportion of resistant bacteria",
      "It always contains fewer bacteria of every type",
      "It becomes a virus population",
      "It loses all cell walls",
    ],
    "It may contain a higher proportion of resistant bacteria"
  ),
  mcqQuestion(
    "quiz-3",
    "An antibiotic kills most of a bacterial population, but a few bacteria remain alive. What identifies those survivors as a control difficulty?",
    [
      "They may be resistant and continue reproducing",
      "They cannot divide",
      "They become plant cells",
      "They lose plasmids immediately",
    ],
    "They may be resistant and continue reproducing"
  ),
  mcqQuestion(
    "quiz-4",
    "A student claims that an antibiotic deliberately changes every bacterium into a resistant bacterium. Which description correctly explains increasing antibiotic resistance?",
    [
      "Resistant bacteria survive while susceptible bacteria are killed",
      "Antibiotics teach bacteria to become resistant",
      "All bacteria die then new species appear",
      "Resistance only happens in humans",
    ],
    "Resistant bacteria survive while susceptible bacteria are killed"
  ),
  mcqQuestion(
    "quiz-5",
    "A bacterial infection is increasingly resistant to an antibiotic. Why is controlling the infection likely to become more difficult?",
    [
      "More bacteria survive treatment and can reproduce",
      "The immune system always fails",
      "Viruses replace the bacteria",
      "Antibiotics become nutrients",
    ],
    "More bacteria survive treatment and can reproduce"
  ),
];

function antibioticPracticeExport(): GeneratorExportV1Document {
  return {
    formatVersion: LESSON_GENERATOR_EXPORT_FORMAT_V1,
    lesson: {
      title: "Antibiotic Resistance",
      topic: "Antibiotic resistance",
    },
    pages: [
      {
        title: "Learn",
        order: 1,
        blocks: [
          {
            editorType: "text",
            generatorBlockKind: "text-concept",
            headingTitle: "Core learning",
            payload: { content: "<p>Antibiotic resistance can increase in bacterial populations.</p>" },
          },
        ],
      },
      {
        title: "Practise",
        order: 2,
        blocks: [
          {
            editorType: "selfCheck",
            generatorBlockKind: "self-check-question",
            payload: shortPayload(
              "What does antibiotic resistance allow some bacteria to do?",
              "It allows some bacteria to survive treatment with an antibiotic.",
              "Resistant bacteria are not killed by that antibiotic."
            ),
          },
          {
            editorType: "selfCheck",
            generatorBlockKind: "self-check-question",
            payload: shortPayload(
              "During antibiotic treatment, which bacteria in a bacterial population are more likely to survive?",
              "The antibiotic-resistant bacteria are more likely to survive."
            ),
          },
          {
            editorType: "selfCheck",
            generatorBlockKind: "self-check-question",
            payload: shortPayload(
              "How can the proportion of antibiotic-resistant bacteria in a population change after antibiotic use?",
              "The proportion of antibiotic-resistant bacteria can increase."
            ),
          },
          {
            editorType: "checkpoint",
            generatorBlockKind: "checkpoint",
            payload: shortPayload(CHECKPOINT_1_STEM, CHECKPOINT_1_ANSWER, CHECKPOINT_1_EXPL),
          },
          {
            editorType: "checkpoint",
            generatorBlockKind: "checkpoint",
            payload: shortPayload(
              "A bacterial infection contains both resistant and susceptible bacteria. Explain what happens to this population during antibiotic treatment.",
              "More susceptible bacteria are killed by the antibiotic. Resistant bacteria survive and can reproduce."
            ),
          },
          {
            editorType: "checkpoint",
            generatorBlockKind: "checkpoint",
            payload: shortPayload(
              "Explain why increasing antibiotic resistance creates difficulties in controlling bacterial infections.",
              "An antibiotic may no longer kill the resistant bacteria, so the infection becomes harder to treat."
            ),
          },
          {
            editorType: "pageQuiz",
            generatorBlockKind: "page-quiz",
            headingTitle: "Quiz / revision",
            payload: { questions: QUIZ_MCQS },
          },
        ],
      },
    ],
  };
}

function allMcqCheckpointExport(): GeneratorExportV1Document {
  return {
    formatVersion: LESSON_GENERATOR_EXPORT_FORMAT_V1,
    lesson: { title: "Legacy MCQ lesson", topic: "Mitosis" },
    pages: [
      {
        title: "Learn",
        order: 1,
        blocks: [
          {
            editorType: "text",
            payload: { content: "<p>Mitosis produces genetically identical cells.</p>" },
          },
        ],
      },
      {
        title: "Practise",
        order: 2,
        blocks: [
          {
            editorType: "checkpoint",
            payload: {
              questionType: "mcq",
              prompt: "What is produced by mitosis?",
              options: [
                "Two genetically identical daughter cells",
                "Four gametes",
                "A haploid zygote",
                "Two different species",
              ],
              correctAnswer: "Two genetically identical daughter cells",
              explanation: "Mitosis is used for growth and repair.",
            },
          },
          {
            editorType: "pageQuiz",
            payload: {
              questions: [
                mcqQuestion(
                  "q1",
                  "Why is mitosis used for repair?",
                  [
                    "It produces genetically identical cells",
                    "It halves the chromosome number",
                    "It only happens in gametes",
                    "It fuses nuclei",
                  ],
                  "It produces genetically identical cells"
                ),
              ],
            },
          },
        ],
      },
    ],
  };
}

function fillerCount(values: string[]): number {
  return values.filter(
    (v) => FILLER_PROMPT.test(v) || FILLER_OPTION.test(String(v).trim())
  ).length;
}

describe("practice import persist (short checkpoints + pageQuiz MCQs)", () => {
  const pages = buildPagesFromGeneratorExport(antibioticPracticeExport());
  const learn = pages.find((p) => p.title === "Learn")!;
  const practise = pages.find((p) => p.title === "Practise")!;

  test("1. import fixture: 3 short selfCheck, 3 short checkpoint, 5 quiz MCQ", () => {
    expect(pages).toHaveLength(2);
    const selfChecks = practise.blocks.filter((b) => String(b.type) === "selfCheck");
    const checkpoints = practise.blocks.filter((b) => String(b.type) === "checkpoint");
    const quizzes = practise.blocks.filter((b) => String(b.type) === "pageQuiz");
    expect(selfChecks).toHaveLength(5);
    expect(checkpoints).toHaveLength(1);
    expect(quizzes).toHaveLength(1);
    expect(
      ((quizzes[0] as { questions?: unknown[] }).questions || []).length
    ).toBe(5);
  });

  test("2. after import: 5 real selfCheck-like blocks, real checkpoint-1, 5 pageQuiz MCQs", () => {
    const selfChecks = practise.blocks.filter((b) => String(b.type) === "selfCheck");
    expect(
      selfChecks.every((b) => String((b as { prompt?: string }).prompt || "").trim().length > 10)
    ).toBe(true);
    expect(
      selfChecks.every((b) => !FILLER_PROMPT.test(String((b as { prompt?: string }).prompt || "")))
    ).toBe(true);

    const cp = practise.blocks.find((b) => String(b.type) === "checkpoint") as {
      prompt?: string;
      questionType?: string;
      correctAnswer?: string;
      explanation?: string;
    };
    expect(cp.prompt).toBe(CHECKPOINT_1_STEM);
    expect(cp.questionType).toBe("short");
    expect(cp.correctAnswer).toBe(CHECKPOINT_1_ANSWER);
    expect(String(cp.explanation || "")).toContain("Resistant bacteria");

    const pq = practise.blocks.find((b) => String(b.type) === "pageQuiz") as {
      questions?: Array<{ prompt?: string; options?: string[] }>;
    };
    expect(pq.questions).toHaveLength(5);
    expect(pq.questions!.every((q) => (q.options || []).length >= 2)).toBe(true);
  });

  test("3. Create Lesson persist keeps generated short checkpoint (empty/filler page.checkpoint)", () => {
    const cp = practise.blocks.find((b) => String(b.type) === "checkpoint") as Record<
      string,
      unknown
    >;
    const fromImportedPage = resolveCheckpointBlockForCreateLessonPersist(cp, practise.checkpoint);
    const fromEmptyPage = resolveCheckpointBlockForCreateLessonPersist(cp, {
      question: "",
      options: ["", "", "", ""],
      answer: "",
    });
    const fromFillerPage = resolveCheckpointBlockForCreateLessonPersist(cp, {
      question: "Which statement is correct?",
      options: ["Option 1", "Option 2", "Option 3", "Option 4"],
      answer: "Option 1",
    });

    for (const persisted of [fromImportedPage, fromEmptyPage, fromFillerPage]) {
      expect(persisted.prompt).toBe(CHECKPOINT_1_STEM);
      expect(persisted.correctAnswer).toBe(CHECKPOINT_1_ANSWER);
      expect(persisted.questionType).toBe("short");
      expect(persisted.options).toEqual([]);
      expect(FILLER_PROMPT.test(persisted.prompt)).toBe(false);
      expect(persisted.options.some((o) => FILLER_OPTION.test(o))).toBe(false);
    }
  });

  test("4. Revision Practice uses imported pageQuiz MCQs when checkpoint/selfCheck are short", () => {
    expect(collectCheckpointMcqsFromPages(pages)).toHaveLength(0);
    const fromQuiz = collectPageQuizMcqsFromPages(pages);
    expect(fromQuiz).toHaveLength(5);
    const pool = buildRevisionPracticePool(pages, [], 5);
    expect(pool).toHaveLength(5);
    expect(pool.every((q) => q.options.length >= 2 && q.correctAnswer)).toBe(true);
    expect(fillerCount(pool.flatMap((q) => [q.question, ...q.options]))).toBe(0);
    expect(pool.map((q) => q.question)).toEqual(QUIZ_MCQS.map((q) => q.prompt));
  });

  test("5. legacy all-MCQ checkpoint still imports and persists as MCQ", () => {
    const legacy = buildPagesFromGeneratorExport(allMcqCheckpointExport());
    const practiseLegacy = legacy.find((p) => p.title === "Practise")!;
    const cp = practiseLegacy.blocks.find((b) => String(b.type) === "checkpoint") as Record<
      string,
      unknown
    >;
    expect(String(cp.prompt)).toContain("mitosis");
    expect(cp.questionType).toBe("mcq");
    expect(practiseLegacy.checkpoint?.question).toContain("mitosis");
    expect((practiseLegacy.checkpoint?.options || []).filter(Boolean).length).toBeGreaterThanOrEqual(
      2
    );
    const persisted = resolveCheckpointBlockForCreateLessonPersist(cp, practiseLegacy.checkpoint);
    expect(persisted.questionType).toBe("mcq");
    expect(persisted.prompt).toContain("mitosis");
    expect(persisted.options.filter(Boolean).length).toBeGreaterThanOrEqual(2);
    expect(FILLER_PROMPT.test(persisted.prompt)).toBe(false);
  });

  test("6. Learn page still contains no testing blocks", () => {
    expect(isLearnTeachingPage(learn)).toBe(true);
    expect(
      learn.blocks.some((b) => LEARN_TESTING_BLOCK_TYPES.has(String(b.type || "")))
    ).toBe(false);
    expect(learn.checkpoint).toBeUndefined();
  });

  test("7. Block 28 / ExamQuestion attachments are not invented on import", () => {
    const allBlocks = pages.flatMap((p) => p.blocks);
    expect(allBlocks.some((b) => String(b.type) === "examQuestion")).toBe(false);
    expect(
      allBlocks.some((b) => String((b as { examQuestionId?: unknown }).examQuestionId || "").trim())
    ).toBe(false);
  });

  test("8. persisted filler checkpoint/selfCheck MCQs do not block pageQuiz fallback", () => {
    const livePersistedShape = [
      {
        pageId: "practise",
        blocks: [
          {
            type: "selfCheck",
            questionType: "short",
            prompt:
              "What happens to the proportion of antibiotic-resistant bacteria as antibiotic resistance increases in a bacterial population?",
            options: [],
            correctAnswer: "The proportion of antibiotic-resistant bacteria increases.",
          },
          {
            type: "checkpoint",
            questionType: "mcq",
            prompt: "Which statement is correct?",
            options: ["Option 1", "Option 2", "Option 3", "Option 4"],
            correctAnswer: "Option 1",
          },
          {
            type: "selfCheck",
            questionType: "mcq",
            prompt: "Which statement is correct?",
            options: ["Option 1", "Option 2", "Option 3", "Option 4"],
            correctAnswer: "Option 1",
          },
          {
            type: "selfCheck",
            questionType: "mcq",
            prompt: "Which statement is correct?",
            options: ["Option 1", "Option 2", "Option 3", "Option 4"],
            correctAnswer: "Option 1",
          },
          {
            type: "pageQuiz",
            questions: QUIZ_MCQS,
          },
        ],
      },
    ];

    expect(collectCheckpointMcqsFromPages(livePersistedShape)).toHaveLength(0);
    const sources = collectRevisionPracticeMcqSources(livePersistedShape);
    expect(sources).toHaveLength(5);
    expect(sources.map((s) => s.prompt)).toEqual(QUIZ_MCQS.map((q) => q.prompt));
    const pool = buildRevisionPracticePool(livePersistedShape, [], 5);
    expect(pool).toHaveLength(5);
    expect(fillerCount(pool.flatMap((q) => [q.question, ...q.options]))).toBe(0);
    expect(pool.map((q) => q.question)).toEqual(QUIZ_MCQS.map((q) => q.prompt));
  });

  test("9. real checkpoint MCQs still take precedence over pageQuiz; filler siblings are ignored", () => {
    const mixed = [
      {
        pageId: "practise",
        blocks: [
          {
            type: "checkpoint",
            questionType: "mcq",
            prompt: "What is produced by mitosis?",
            options: [
              "Two genetically identical daughter cells",
              "Four gametes",
              "A haploid zygote",
              "Two different species",
            ],
            correctAnswer: "Two genetically identical daughter cells",
          },
          {
            type: "selfCheck",
            questionType: "mcq",
            prompt: "Which statement is correct?",
            options: ["Option 1", "Option 2", "Option 3", "Option 4"],
            correctAnswer: "Option 1",
          },
          {
            type: "pageQuiz",
            questions: QUIZ_MCQS,
          },
        ],
      },
    ];
    const checkpoints = collectCheckpointMcqsFromPages(mixed);
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0].prompt).toContain("mitosis");
    const sources = collectRevisionPracticeMcqSources(mixed);
    expect(sources).toHaveLength(1);
    expect(sources[0].prompt).toContain("mitosis");
    const pool = buildRevisionPracticePool(mixed, [], 5);
    expect(pool.length).toBeGreaterThanOrEqual(1);
    expect(pool.some((q) => /mitosis/i.test(q.question))).toBe(true);
    expect(fillerCount(pool.flatMap((q) => [q.question, ...q.options]))).toBe(0);
  });

  test("filler string count across import persist + revision is zero", () => {
    const cp = practise.blocks.find((b) => String(b.type) === "checkpoint") as Record<
      string,
      unknown
    >;
    const persisted = resolveCheckpointBlockForCreateLessonPersist(cp, {
      question: "",
      options: ["", "", "", ""],
      answer: "",
    });
    const { revisionPractice, quizPage } = buildLessonQuestionLayers(pages, []);
    const blob = [
      persisted.prompt,
      persisted.correctAnswer,
      ...(persisted.options || []),
      ...practise.blocks.map((b) => String((b as { prompt?: string }).prompt || "")),
      ...revisionPractice.flatMap((q) => [q.question, ...q.options]),
      ...quizPage.flatMap((q) => [q.question, ...q.options]),
    ];
    expect(fillerCount(blob)).toBe(0);
  });
});
