import {
  buildLessonQuestionLayers,
  buildQuizPagePool,
  buildRevisionPracticePool,
  buildEndOfLessonQuizPool,
} from "./lessonQuestionPools";
import { collectCheckpointMcqsFromPages } from "./revisionPracticeVariants";
import { isNearDuplicateStem, normalizeQuestionStem } from "./questionStemSimilarity";

const haploidStem = "Why must human gametes be haploid before fertilisation?";
const haploidAnswer = "So fusion restores the diploid chromosome number in the zygote";

const checkpointBlock = {
  type: "checkpoint",
  question: "What is produced during anaerobic respiration in human muscle cells?",
  options: ["Carbon dioxide", "Ethanol", "Lactic acid", "Oxygen"],
  correctAnswer: "Lactic acid",
};

const pages = [{ blocks: [checkpointBlock] }];

describe("lessonQuestionPools", () => {
  it("revision and quiz layers do not repeat exact checkpoint stems", () => {
    const stored = [
      {
        id: "clone-1",
        question: checkpointBlock.question,
        options: checkpointBlock.options,
        correctAnswer: checkpointBlock.correctAnswer,
        pageId: "p1",
      },
    ];
    const { revisionPractice, quizPage } = buildLessonQuestionLayers(pages, stored);
    const checkpoints = collectCheckpointMcqsFromPages(pages);

    expect(revisionPractice.length).toBeGreaterThan(0);
    expect(quizPage.length).toBeGreaterThan(0);

    for (const q of revisionPractice) {
      expect(isNearDuplicateStem(q.question, checkpoints[0].prompt)).toBe(false);
    }
    for (const q of quizPage) {
      expect(isNearDuplicateStem(q.question, checkpoints[0].prompt)).toBe(false);
    }
    expect(revisionPractice[0].question).not.toBe(checkpoints[0].prompt);
    expect(quizPage[0].question).not.toBe(checkpoints[0].prompt);
    expect(revisionPractice[0].question).not.toBe(quizPage[0].question);
  });

  it("tags variant-generated questions when only checkpoints exist", () => {
    const revision = buildRevisionPracticePool(pages, []);
    const quiz = buildQuizPagePool(pages, [], revision);
    expect(revision.every((q) => q.questionSource === "variant-generated")).toBe(true);
    expect(quiz.every((q) => q.questionSource === "variant-generated")).toBe(true);
  });

  it("end-of-lesson does not invent variants when quiz page already has bank items", () => {
    const stored = [
      {
        id: "pq-1",
        question: "Which statement correctly defines pollination?",
        options: [
          "Transfer of pollen from anther to stigma",
          "Fusion of gamete nuclei",
          "Seed formation",
          "Leaf photosynthesis",
        ],
        correctAnswer: "Transfer of pollen from anther to stigma",
        pageId: "practise",
        tags: ["page-quiz"],
        metadata: { source: "pageQuiz" },
      },
    ];
    const multiPages = [
      { pageId: "learn", title: "Learn", blocks: [] },
      {
        pageId: "practise",
        title: "Practise",
        blocks: [
          {
            type: "checkpoint",
            prompt: "Compare pollen adaptations of wind and insect flowers.",
            options: ["Light vs sticky pollen", "Same pollen", "No pollen", "Only nectar"],
            correctAnswer: "Light vs sticky pollen",
          },
        ],
      },
    ];
    const revision = buildRevisionPracticePool(multiPages, stored);
    const quizPage = buildQuizPagePool(multiPages, stored, revision, { pageId: "practise" });
    const eol = buildEndOfLessonQuizPool(multiPages, stored, quizPage, revision);
    // Prefer empty EOL over paraphrasing the same checkpoint/quiz stems.
    expect(quizPage.length).toBeGreaterThan(0);
    expect(eol.every((q) => !quizPage.some((pq) => pq.question === q.question))).toBe(true);
    for (const q of eol) {
      for (const pq of quizPage) {
        expect(isNearDuplicateStem(q.question, pq.question)).toBe(false);
      }
    }
  });

  it("excludes untagged lesson.quiz copy when inline pageQuiz already has same stem+answer", () => {
    const productionPages = [
      {
        blocks: [
          {
            type: "pageQuiz",
            questions: [
              {
                id: "quiz1",
                prompt: haploidStem,
                options: [
                  haploidAnswer,
                  "So the zygote can remain haploid after fertilisation",
                  "So gametes can divide by mitosis only",
                  "So body cells can fuse without chromosomes",
                ],
                correctAnswer: haploidAnswer,
              },
            ],
          },
        ],
      },
    ];
    const storedQuiz = [
      {
        id: "quiz1",
        tags: ["page-quiz"],
        question: haploidStem,
        options: [
          haploidAnswer,
          "So the zygote can remain haploid after fertilisation",
          "So gametes can divide by mitosis only",
          "So body cells can fuse without chromosomes",
        ],
        correctAnswer: haploidAnswer,
      },
      {
        id: "pq_p_test_2",
        question: haploidStem,
        options: [
          haploidAnswer,
          "So the zygote can remain haploid after fertilisation",
          "So gametes can divide by mitosis only",
          "So body cells can fuse without chromosomes",
        ],
        correctAnswer: haploidAnswer,
      },
      {
        id: "unique_rev",
        question: "Which nuclear event defines fertilisation in sexual reproduction?",
        options: ["Fusion of gamete nuclei", "Meiosis only", "Mitosis only", "Binary fission"],
        correctAnswer: "Fusion of gamete nuclei",
      },
    ];
    const revision = buildRevisionPracticePool(productionPages, storedQuiz);
    expect(
      revision.some((q) => normalizeQuestionStem(q.question) === normalizeQuestionStem(haploidStem))
    ).toBe(false);
    expect(revision.some((q) => q.id === "unique_rev")).toBe(true);
  });
});
