import {
  buildRevisionVariantsFromCheckpoints,
  collectCheckpointMcqsFromPages,
  shuffleOptionsDeterministic,
} from "./revisionPracticeVariants";
import { isNearDuplicateStem } from "./questionStemSimilarity";
import { buildRevisionPracticePool, buildQuizPagePool } from "./lessonQuestionPools";

describe("revisionPracticeVariants", () => {
  it("shuffles options but keeps correct answer text", () => {
    const { options, correctAnswer } = shuffleOptionsDeterministic(
      ["A", "B", "C", "D"],
      "B",
      "test-seed"
    );
    expect(options).toHaveLength(4);
    expect(options).toContain("B");
    expect(correctAnswer).toBe("B");
  });

  it("builds stems that differ from checkpoint prompts", () => {
    const sources = [
      {
        prompt: "What is a limiting factor?",
        options: ["A", "B", "C", "D"],
        correctAnswer: "B",
      },
    ];
    const variants = buildRevisionVariantsFromCheckpoints(sources);
    expect(variants).toHaveLength(1);
    expect(isNearDuplicateStem(variants[0].question, sources[0].prompt)).toBe(false);
    expect(variants[0].correctAnswer).toBe("B");
  });

  it("collects MCQs from questions[] banks", () => {
    const mcqs = collectCheckpointMcqsFromPages([
      {
        blocks: [
          {
            type: "checkpoint",
            prompt: "Legacy",
            options: ["L1", "L2"],
            correctAnswer: "L1",
            questions: [
              {
                prompt: "Bank Q1?",
                options: ["A", "B", "C", "D"],
                correctAnswer: "A",
              },
              {
                prompt: "Bank Q2?",
                options: ["A", "B", "C", "D"],
                correctAnswer: "B",
              },
            ],
          },
        ],
      },
    ]);
    expect(mcqs.map((m) => m.prompt)).toEqual(["Bank Q1?", "Bank Q2?"]);
  });
});

describe("lessonQuestionPools with stored quiz bank", () => {
  const pages = [
    {
      blocks: [
        {
          type: "checkpoint",
          questions: [
            {
              prompt: "Checkpoint only?",
              options: ["A", "B", "C", "D"],
              correctAnswer: "A",
            },
          ],
        },
      ],
    },
  ];
  const storedQuiz = [
    {
      id: "1",
      type: "mcq",
      question: "Stored rev 1?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
    },
    {
      id: "2",
      type: "mcq",
      question: "Stored rev 2?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "B",
    },
    {
      id: "3",
      type: "mcq",
      question: "Stored rev 3?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "C",
    },
    {
      id: "4",
      type: "mcq",
      question: "Stored rev 4?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "D",
    },
    {
      id: "5",
      type: "mcq",
      question: "Stored rev 5?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
    },
  ];

  it("revision practice displays all stored questions up to max", () => {
    const pool = buildRevisionPracticePool(pages, storedQuiz, 5);
    expect(pool.length).toBe(5);
    expect(pool.every((q) => q.question.startsWith("Stored rev"))).toBe(true);
  });

  it("quiz page displays stored questions without collapsing to 1/1", () => {
    const revision = buildRevisionPracticePool(pages, storedQuiz, 2);
    const quiz = buildQuizPagePool(pages, storedQuiz, revision, { max: 5 });
    expect(quiz.length).toBeGreaterThanOrEqual(3);
  });
});
