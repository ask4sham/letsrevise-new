const {
  sanitizeCheckpointOrSelfCheckBlock,
  sanitizePageQuizBlock,
  validateActivityQuestionBank,
} = require("../utils/sanitizeActivityBlockQuestions");

describe("sanitizeActivityBlockQuestions", () => {
  const goodBank = [
    {
      id: "sc1",
      prompt: "Define adaptations for pollination.",
      questionType: "short",
      correctAnswer: "Features that help transfer pollen.",
      purpose: "definition",
    },
    {
      id: "sc2",
      prompt: "Which feature aids insect pollination?",
      questionType: "mcq",
      options: ["Bright petals", "Feathery stigma", "Lots of light pollen", "Tall bare anthers"],
      correctAnswer: "Bright petals",
      purpose: "recall",
    },
    {
      id: "sc3",
      prompt: "Explain one common misconception about pollination.",
      questionType: "short",
      correctAnswer: "Pollination is not fertilisation.",
      purpose: "misconception",
    },
  ];

  test("preserves valid questions[] and does not inject Option 1–4", () => {
    const { block } = sanitizeCheckpointOrSelfCheckBlock(
      { type: "selfCheck", questions: goodBank },
      "selfCheck"
    );
    expect(block.questions).toHaveLength(3);
    expect(block.prompt).toMatch(/Define adaptations/i);
    expect(block.correctAnswer).toMatch(/Features that help/i);
    const blob = JSON.stringify(block);
    expect(blob).not.toMatch(/Option 1/);
    expect(blob).not.toMatch(/Which statement is correct/);
  });

  test("rejects invalid questions[] instead of filler (fail closed)", () => {
    const result = sanitizeCheckpointOrSelfCheckBlock(
      {
        type: "checkpoint",
        questions: [{ prompt: "x", questionType: "mcq", options: ["Option 1", "Option 2"], correctAnswer: "Option 1" }],
      },
      "checkpoint"
    );
    expect(result.error).toBeTruthy();
    expect(result.code).toBe("ACTIVITY_QUESTION_BANK_INVALID");
    expect(result.block).toBeUndefined();
  });

  test("legacy invalid single-prompt still gets Option filler", () => {
    const { block } = sanitizeCheckpointOrSelfCheckBlock(
      { type: "checkpoint", prompt: "", options: [], correctAnswer: "" },
      "checkpoint"
    );
    expect(block.options).toEqual(["Option 1", "Option 2", "Option 3", "Option 4"]);
    expect(block.prompt).toBe("Which statement is correct?");
  });

  test("pageQuiz preserves questions[] bank", () => {
    const quizBank = [
      {
        id: "qz1",
        question: "State a precise definition linked to pollination.",
        type: "short",
        correctAnswer: "Transfer of pollen to a stigma.",
        purpose: "definition",
      },
      {
        id: "qz2",
        prompt: "Correct a misconception about wind pollination.",
        questionType: "short",
        correctAnswer: "Wind-pollinated flowers are not brightly coloured.",
        purpose: "misconception",
      },
      {
        id: "qz3",
        prompt: "When comparing insect and wind pollination, what should students contrast?",
        questionType: "mcq",
        options: [
          "A normal process versus what changes when a factor is altered",
          "Two identical keywords with no mechanism",
          "Only spelling differences",
          "Unrelated physics quantities",
        ],
        correctAnswer: "A normal process versus what changes when a factor is altered",
        purpose: "comparison",
      },
      {
        id: "qz4",
        prompt: "Outline a sensible teaching order for pollination adaptations.",
        questionType: "short",
        correctAnswer: "Definition, mechanism, then example.",
        purpose: "sequence",
      },
      {
        id: "qz5",
        prompt: "Explain one exam tip for pollination adaptations.",
        questionType: "short",
        correctAnswer: "Link structure to function with named examples.",
        purpose: "exam_style",
      },
    ];
    const { block } = sanitizePageQuizBlock({ type: "pageQuiz", questions: quizBank });
    expect(block.questions).toHaveLength(5);
    expect(validateActivityQuestionBank(block.questions).ok).toBe(true);
  });
});
