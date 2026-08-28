import { buildPageQuizLessonQuizEntriesFromPages } from "./pageQuizLessonQuizRebuild";

describe("pageQuizLessonQuizRebuild", () => {
  const mutationFixture = () => ({
    pageId: "p_practise",
    blocks: [
      {
        type: "pageQuiz",
        questions: [
          {
            id: "quiz1",
            prompt: "Why must human gametes be haploid before fertilisation?",
            questionType: "mcq",
            options: [
              "To keep the chromosome number constant after fertilisation",
              "To increase genetic variation only",
              "To produce more gametes",
              "To speed up cell division",
            ],
            correctAnswer: "To keep the chromosome number constant after fertilisation",
            explanation: "Old explanation",
            purpose: "recall",
            marks: 1,
            tags: ["page-quiz"],
          },
          {
            id: "quiz2",
            prompt: "Sibling question two?",
            questionType: "mcq",
            options: ["A", "B", "C", "D"],
            correctAnswer: "A",
            marks: 1,
          },
          {
            id: "quiz3",
            prompt: "Sibling question three?",
            questionType: "mcq",
            options: ["A", "B", "C", "D"],
            correctAnswer: "B",
            marks: 1,
          },
          {
            id: "quiz4",
            prompt: "Sibling question four?",
            questionType: "mcq",
            options: ["A", "B", "C", "D"],
            correctAnswer: "C",
            marks: 1,
          },
          {
            id: "quiz5",
            prompt: "Sibling question five?",
            questionType: "mcq",
            options: ["A", "B", "C", "D"],
            correctAnswer: "D",
            marks: 1,
          },
        ],
      },
    ],
  });

  test("rebuild reflects edited quiz1 in lesson.quiz representation", () => {
    const page = mutationFixture();
    const questions = page.blocks[0].questions as Array<Record<string, unknown>>;
    questions[0] = {
      ...questions[0],
      prompt:
        "A mutation changes the base sequence of a gene. What is a possible consequence of this change?",
      options: [
        "The amino acid sequence of a protein may change.",
        "The number of chromosomes in every cell always increases.",
        "The organism will always develop a harmful characteristic.",
        "The mutation will always be inherited by its offspring.",
      ],
      correctAnswer: "The amino acid sequence of a protein may change.",
      explanation:
        "Changing the DNA base sequence can change the amino acid sequence, which may alter the structure or function of the protein produced.",
    };

    const rebuilt = buildPageQuizLessonQuizEntriesFromPages([page]);
    expect(rebuilt).toHaveLength(5);

    const quiz1 = rebuilt.find((q) => q.id === "quiz1");
    expect(quiz1?.question).toMatch(/mutation changes the base sequence/i);
    expect(quiz1?.correctAnswer).toBe("The amino acid sequence of a protein may change.");
    expect(quiz1?.sourceType).toBe("pageQuiz");
    expect(quiz1?.pageId).toBe("p_practise");

    expect(rebuilt.find((q) => q.id === "quiz2")?.question).toBe("Sibling question two?");
    expect(rebuilt.find((q) => q.id === "quiz5")?.correctAnswer).toBe("D");
    expect(
      rebuilt.some((q) => /human gametes be haploid/i.test(q.question))
    ).toBe(false);
  });

  test("explicit bank id is preserved unchanged", () => {
    const rebuilt = buildPageQuizLessonQuizEntriesFromPages([mutationFixture()]);
    expect(rebuilt.find((q) => q.id === "quiz1")?.id).toBe("quiz1");
  });

  test("missing bank id uses historical pq_pageId_qi_Date.now fallback", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(1787930000000));

    const rebuilt = buildPageQuizLessonQuizEntriesFromPages([
      {
        pageId: "p_practise",
        blocks: [
          {
            type: "pageQuiz",
            questions: [
              {
                prompt: "No explicit id?",
                questionType: "mcq",
                options: ["Alpha", "Beta"],
                correctAnswer: "Alpha",
              },
            ],
          },
        ],
      },
    ]);

    expect(rebuilt).toHaveLength(1);
    expect(rebuilt[0].id).toBe("pq_p_practise_0_1787930000000");

    jest.useRealTimers();
  });
});
