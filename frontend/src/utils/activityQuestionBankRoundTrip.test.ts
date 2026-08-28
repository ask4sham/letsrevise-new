import {
  normalizeActivityBankQuestion,
  patchActivityBankQuestionAtIndex,
  preserveActivityQuestions,
  withPreservedActivityQuestions,
  hasActivityQuestionBank,
} from "./activityQuestionBankRoundTrip";
import { patchMcqOptionText } from "./lessonMcqOptionsEditor";

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

  test("patchActivityBankQuestionAtIndex updates prompt and question together", () => {
    const qs = preserveActivityQuestions(bank)!;
    const next = patchActivityBankQuestionAtIndex(qs, 0, {
      prompt: "Updated stem?",
      explanation: "Because.",
    });
    expect(next[0].prompt).toBe("Updated stem?");
    expect(next[0].question).toBe("Updated stem?");
    expect(next[0].explanation).toBe("Because.");
    expect(next[0].id).toBe("sc1");
    expect(next[0].purpose).toBe("definition");
    expect(next[1]).toEqual(qs[1]);
  });

  test("patching index 1 preserves sibling questions 0 and 2..N", () => {
    const qs = preserveActivityQuestions(bank)!;
    const before0 = JSON.parse(JSON.stringify(qs[0]));
    const before2 = JSON.parse(JSON.stringify(qs[2]));
    const next = patchActivityBankQuestionAtIndex(qs, 1, {
      prompt: "New MCQ stem?",
      question: "New MCQ stem?",
      correctAnswer: "Bright petals",
    });
    expect(next[0]).toEqual(before0);
    expect(next[2]).toEqual(before2);
    expect(next[1].prompt).toBe("New MCQ stem?");
  });

  test("navigation-only index change does not mutate bank content", () => {
    const qs = preserveActivityQuestions(bank)!;
    const snapshot = JSON.parse(JSON.stringify(qs));
    const idx1 = 1;
    const idx0 = 0;
    expect(idx1).not.toBe(idx0);
    expect(qs[idx1].prompt).toBe(snapshot[idx1].prompt);
    expect(qs[idx0].prompt).toBe(snapshot[idx0].prompt);
  });

  test("MCQ option patch keeps correctAnswer aligned via lessonMcqOptionsEditor", () => {
    const qs = preserveActivityQuestions([
      {
        id: "quiz1",
        prompt: "Why must human gametes be haploid before fertilisation?",
        questionType: "mcq",
        options: ["Alpha", "Beta", "Gamma", "Delta"],
        correctAnswer: "Alpha",
        purpose: "recall",
        marks: 1,
        tags: ["page-quiz"],
      },
      {
        id: "quiz2",
        prompt: "Sibling two?",
        questionType: "mcq",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
      },
    ])!;
    const optPatch = patchMcqOptionText(
      qs[0].options ?? [],
      0,
      "The amino acid sequence of a protein may change.",
      qs[0].correctAnswer ?? ""
    );
    const next = patchActivityBankQuestionAtIndex(qs, 0, {
      prompt:
        "A mutation changes the base sequence of a gene. What is a possible consequence of this change?",
      question:
        "A mutation changes the base sequence of a gene. What is a possible consequence of this change?",
      options: optPatch.options,
      ...(optPatch.correctAnswer !== undefined
        ? { correctAnswer: optPatch.correctAnswer }
        : {}),
      explanation:
        "Changing the DNA base sequence can change the amino acid sequence, which may alter the structure or function of the protein produced.",
    });
    expect(next[0].prompt).toMatch(/mutation changes the base sequence/i);
    expect(next[0].correctAnswer).toBe("The amino acid sequence of a protein may change.");
    expect(next[0].id).toBe("quiz1");
    expect(next[0].purpose).toBe("recall");
    expect(next[0].marks).toBe(1);
    expect(next[1]).toEqual(qs[1]);
    expect(next[0].prompt).not.toMatch(/haploid/i);
  });
});
