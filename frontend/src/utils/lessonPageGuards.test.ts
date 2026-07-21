import {
  isLearnTeachingPage,
  isPlaceholderOrEmptyCheckpoint,
  isRenderablePageCheckpoint,
  isStudentVisiblePageQuizBlock,
  emptyPageQuizBankEditorWarning,
  stripLearnPageTestingBlocks,
} from "./lessonPageGuards";

describe("lessonPageGuards", () => {
  test("detects Learn teaching pages", () => {
    expect(isLearnTeachingPage({ title: "Learn" })).toBe(true);
    expect(isLearnTeachingPage({ title: "Learn — Fertilisation", pageType: "" })).toBe(true);
    expect(isLearnTeachingPage({ title: "Practise", pageType: "learn" })).toBe(true);
    expect(isLearnTeachingPage({ title: "Practise" })).toBe(false);
  });

  test("rejects placeholder Option 1–4 checkpoints", () => {
    expect(
      isPlaceholderOrEmptyCheckpoint({
        question: "Which statement is correct?",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
      })
    ).toBe(true);
    expect(
      isRenderablePageCheckpoint({
        question: "Which statement is correct?",
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
      })
    ).toBe(false);
    expect(
      isRenderablePageCheckpoint({
        question: "Why must plant gametes fuse inside the ovule?",
        options: ["To form a zygote", "To make pollen", "To attract insects", "To open the stigma"],
      })
    ).toBe(true);
  });

  test("strips testing blocks from Learn", () => {
    const out = stripLearnPageTestingBlocks([
      { type: "text", content: "Teach" },
      { type: "selfCheck", prompt: "Q?" },
      { type: "checkpoint", prompt: "Q2?" },
      { type: "pageQuiz", questions: [] },
      { type: "keyIdea", content: "Idea" },
    ]);
    expect(out.map((b) => b.type)).toEqual(["text", "keyIdea"]);
  });

  test("pageQuiz visibility requires a real question bank", () => {
    expect(isStudentVisiblePageQuizBlock({ type: "pageQuiz", questions: [] })).toBe(false);
    expect(
      isStudentVisiblePageQuizBlock({
        type: "pageQuiz",
        questions: [
          {
            prompt: "Why is water needed?",
            questionType: "mcq",
            options: ["A", "B", "C", "D"],
            correctAnswer: "A",
          },
        ],
      })
    ).toBe(true);
  });

  test("emptyPageQuizBankEditorWarning only when bank is unusable", () => {
    expect(emptyPageQuizBankEditorWarning({ type: "text" })).toBeNull();
    expect(emptyPageQuizBankEditorWarning({ type: "pageQuiz", questions: [] })).toMatch(
      /no usable questions/i
    );
    expect(
      emptyPageQuizBankEditorWarning({
        type: "pageQuiz",
        questions: [
          {
            prompt: "Q?",
            questionType: "mcq",
            options: ["A", "B"],
            correctAnswer: "A",
          },
        ],
      })
    ).toBeNull();
  });
});
