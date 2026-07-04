/**
 * Practice Questions marking — integration with shared gradeMcq / gradeShortAnswer utilities.
 * Component wiring lives in LessonViewPage PracticeMCQQuestion / PracticeShortQuestion.
 */
import { buildMcqFeedback, gradeMcq } from "../utils/gradeMcq";
import {
  buildShortAnswerImprovementTip,
  deriveShortAnswerFeedbackStatus,
  gradeShortAnswer,
} from "../utils/gradeShortAnswer";

function deriveCorrectIndex(options: string[], correctAnswer: string): number {
  const ca = correctAnswer.trim();
  if (!ca) return -1;
  const idx = options.findIndex((o) => String(o ?? "").trim() === ca);
  return idx >= 0 ? idx : -1;
}

describe("Practice Questions automatic marking", () => {
  describe("MCQ", () => {
    const options = ["Mitochondria", "Nucleus", "Ribosome", "Chloroplast"];
    const correctAnswer = "Mitochondria";
    const correctIndex = deriveCorrectIndex(options, correctAnswer);

    it("awards full marks when the correct option is selected (1/1)", () => {
      const grade = gradeMcq(correctIndex, correctIndex, options, 1);
      expect(grade.marksAwarded).toBe(1);
      expect(grade.totalMarks).toBe(1);
      expect(grade.status).toBe("correct");
    });

    it("awards zero marks when a wrong option is selected (0/1)", () => {
      const wrongIndex = deriveCorrectIndex(options, "Nucleus");
      const grade = gradeMcq(wrongIndex, correctIndex, options, 1);
      expect(grade.marksAwarded).toBe(0);
      expect(grade.status).toBe("incorrect");
    });

    it("builds feedback with explanation text", () => {
      const grade = gradeMcq(correctIndex, correctIndex, options, 1);
      const feedback = buildMcqFeedback({
        grade,
        options,
        explanation: "Mitochondria release energy through respiration.",
        correctAnswer,
      });
      expect(feedback.whyCorrect).toMatch(/respiration/i);
    });

    it("separates wrong-answer explanation from revision target", () => {
      const wrongIndex = deriveCorrectIndex(options, "Nucleus");
      const grade = gradeMcq(wrongIndex, correctIndex, options, 1);
      const feedback = buildMcqFeedback({
        grade,
        options,
        markScheme: ["Why B is wrong: Nucleus is not the site of aerobic respiration."],
        explanation: "Mitochondria release energy through respiration.",
        correctAnswer,
      });
      expect(feedback.whySelectedWrong).toMatch(/Nucleus|not the site/i);
      expect(feedback.improvementTip).toMatch(/^Revise: Mitochondria/i);
    });
  });

  describe("short answer", () => {
    const markScheme = [
      "Oestrogen repairs the uterus lining after menstruation",
      "High oestrogen triggers the LH surge before ovulation",
    ];

    it("awards partial marks when one scheme point is present", () => {
      const distinctScheme = [
        "Mitochondria release ATP during aerobic respiration",
        "Chloroplasts absorb light energy for photosynthesis",
      ];
      const result = gradeShortAnswer({
        userAnswer: "Mitochondria release ATP during aerobic respiration",
        markScheme: distinctScheme,
        marks: 2,
      });
      expect(result.score).toBe(1);
      expect(deriveShortAnswerFeedbackStatus(result.score, result.maxMarks)).toBe("partial");
      expect(result.missing?.length).toBe(1);
    });

    it("suggests revision from missing mark scheme points", () => {
      const result = gradeShortAnswer({
        userAnswer: "LH surge before ovulation",
        markScheme,
        marks: 2,
      });
      expect(result.missing?.length).toBeGreaterThan(0);
      const reviseTip = `Revise: ${result.missing![0]}`;
      expect(reviseTip).toMatch(/^Revise:/);
      expect(buildShortAnswerImprovementTip(result)).toMatch(/include|Compare/i);
    });

    it("awards full marks when all scheme points are matched", () => {
      const result = gradeShortAnswer({
        userAnswer:
          "Oestrogen repairs the uterus lining after menstruation and high oestrogen triggers the LH surge before ovulation",
        markScheme,
        marks: 2,
      });
      expect(result.score).toBe(2);
      expect(deriveShortAnswerFeedbackStatus(result.score, result.maxMarks)).toBe("correct");
    });
  });
});
