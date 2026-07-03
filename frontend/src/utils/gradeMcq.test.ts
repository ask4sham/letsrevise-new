import { buildMcqFeedback, gradeMcq, mcqOptionLabel } from "./gradeMcq";

const OPTIONS = ["0", "1", "2", "23"];

describe("gradeMcq", () => {
  test("correct answer awards full marks", () => {
    const grade = gradeMcq(1, 1, OPTIONS, 1);
    expect(grade.status).toBe("correct");
    expect(grade.marksAwarded).toBe(1);
    expect(grade.totalMarks).toBe(1);
    expect(grade.correctLabel).toBe("B");
    expect(grade.correctOption).toBe("1");
    expect(grade.selectedLabel).toBe("B");
  });

  test("wrong answer awards zero marks and exposes correct option label", () => {
    const grade = gradeMcq(3, 1, OPTIONS, 1);
    expect(grade.status).toBe("incorrect");
    expect(grade.marksAwarded).toBe(0);
    expect(grade.totalMarks).toBe(1);
    expect(grade.selectedLabel).toBe("D");
    expect(grade.selectedOption).toBe("23");
    expect(grade.correctLabel).toBe("B");
    expect(grade.correctOption).toBe("1");
  });

  test("mcqOptionLabel returns A-D", () => {
    expect(mcqOptionLabel(0)).toBe("A");
    expect(mcqOptionLabel(3)).toBe("D");
  });
});

describe("buildMcqFeedback", () => {
  test("parses mark scheme and option explanations for wrong answers", () => {
    const grade = gradeMcq(3, 1, OPTIONS, 1);
    const feedback = buildMcqFeedback({
      grade,
      options: OPTIONS,
      markScheme: [
        "Correct answer: B — 1",
        "Why D is wrong: 23 is the total number of chromosomes in a sperm cell, not the number of X chromosomes.",
      ],
      explanation:
        "A sperm cell is haploid and contains either one X chromosome or one Y chromosome.",
    });

    expect(feedback.whyCorrect).toMatch(/haploid/i);
    expect(feedback.whySelectedWrong).toMatch(/23 is the total number of chromosomes/i);
    expect(feedback.wrongOptionExplanations.some((w) => w.label === "D")).toBe(true);
  });

  test("falls back when no distractor explanations exist", () => {
    const grade = gradeMcq(0, 1, OPTIONS, 1);
    const feedback = buildMcqFeedback({
      grade,
      options: OPTIONS,
      markScheme: ["Correct answer: B — 1"],
    });
    expect(feedback.whySelectedWrong).toMatch(/correct answer is B/i);
    expect(feedback.improvementTip).toBeTruthy();
  });
});
