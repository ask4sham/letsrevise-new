import {
  buildShortAnswerImprovementTip,
  deriveShortAnswerFeedbackStatus,
  gradeShortAnswer,
} from "./gradeShortAnswer";

describe("gradeShortAnswer", () => {
  test("awards marks when answer matches acceptable model", () => {
    const result = gradeShortAnswer({
      userAnswer: "It controls what enters and leaves the cell",
      correctAnswer: "It controls what enters and leaves the cell",
      marks: 1,
    });
    expect(result.maxMarks).toBe(1);
    expect(result.score).toBe(1);
    expect(result.hits?.length).toBeGreaterThan(0);
  });

  test("returns zero on contradiction", () => {
    const result = gradeShortAnswer({
      userAnswer: "It does not have a nucleus",
      correctAnswer: "A cell with a nucleus",
      marks: 1,
    });
    expect(result.score).toBe(0);
    expect(result.contradictionFeedback).toMatch(/contradicts/i);
  });

  test("scores mark-scheme points partially", () => {
    const result = gradeShortAnswer({
      userAnswer: "mitochondria release energy",
      markScheme: [
        "mitochondria release energy",
        "tail moves for swimming",
      ],
      marks: 2,
    });
    expect(result.score).toBe(1);
    expect(result.maxMarks).toBe(2);
    expect(result.hits).toHaveLength(1);
    expect(result.missing).toHaveLength(1);
  });

  test("deriveShortAnswerFeedbackStatus maps score bands", () => {
    expect(deriveShortAnswerFeedbackStatus(2, 2)).toBe("correct");
    expect(deriveShortAnswerFeedbackStatus(1, 2)).toBe("partial");
    expect(deriveShortAnswerFeedbackStatus(0, 2)).toBe("incorrect");
  });

  test("buildShortAnswerImprovementTip uses first missing point", () => {
    const tip = buildShortAnswerImprovementTip({
      score: 1,
      maxMarks: 2,
      hits: ["Release energy via aerobic respiration"],
      missing: ["Energy allows the tail to move so the sperm can swim"],
    });
    expect(tip).toMatch(/Try to include/i);
    expect(tip).toMatch(/tail to move/i);
  });
});
