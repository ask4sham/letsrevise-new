import {
  normalizeActivityBankQuestion,
  preserveActivityQuestions,
  withPreservedActivityQuestions,
  hasActivityQuestionBank,
} from "./activityQuestionBankRoundTrip";

describe("activityQuestionBankRoundTrip", () => {
  const bank = [
    {
      id: "sc1",
      prompt: "Define pollination in flowering plants.",
      questionType: "short",
      correctAnswer: "Transfer of pollen from anther to stigma.",
      purpose: "definition",
      marks: 1,
    },
    {
      id: "sc2",
      prompt: "Which adaptation helps insect pollination?",
      questionType: "mcq",
      options: ["Bright petals", "Feathery stigma", "Lots of pollen", "Tall anthers"],
      correctAnswer: "Bright petals",
      purpose: "recall",
    },
    {
      id: "sc3",
      prompt: "Explain one student misconception about pollination.",
      questionType: "short",
      correctAnswer: "Pollination is not the same as fertilisation.",
      purpose: "misconception",
    },
  ];

  test("preserveActivityQuestions keeps 3-bank shape and fields", () => {
    const qs = preserveActivityQuestions(bank);
    expect(qs).toHaveLength(3);
    expect(qs![0].prompt).toMatch(/Define pollination/i);
    expect(qs![1].options).toEqual([
      "Bright petals",
      "Feathery stigma",
      "Lots of pollen",
      "Tall anthers",
    ]);
    expect(qs![1].correctAnswer).toBe("Bright petals");
    expect(qs![2].purpose).toBe("misconception");
  });

  test("withPreservedActivityQuestions does not invent Option 1 fillers", () => {
    const out = withPreservedActivityQuestions(
      {
        type: "selfCheck",
        prompt: bank[0].prompt,
        questionType: "short",
        options: [] as string[],
        correctAnswer: bank[0].correctAnswer,
      },
      { questions: bank }
    ) as { questions?: unknown[] };
    expect(out.questions).toHaveLength(3);
    const blob = JSON.stringify(out);
    expect(blob).not.toMatch(/Option 1/);
    expect(blob).not.toMatch(/Which statement is correct/);
  });

  test("hasActivityQuestionBank / empty handling", () => {
    expect(hasActivityQuestionBank({ questions: bank })).toBe(true);
    expect(hasActivityQuestionBank({ questions: [] })).toBe(false);
    expect(preserveActivityQuestions([])).toBeUndefined();
    expect(normalizeActivityBankQuestion({})).toBeNull();
  });
});
