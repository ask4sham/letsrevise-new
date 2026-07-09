import type { ExamQuestionPart } from "../../../api/examQuestions";
import {
  compositeAllPartsChecked,
  compositeAllPartsHaveAnswers,
} from "./compositeUtils";

describe("composite marking readiness helpers", () => {
  test("compositeAllPartsHaveAnswers is false until every part is answered", () => {
    const parts: ExamQuestionPart[] = [
      { label: "a", type: "mcq", marks: 1, questionText: "Q", options: ["A", "B"], correctIndex: 0 },
      { label: "c", type: "short", marks: 1, questionText: "Q2" },
    ];
    expect(compositeAllPartsHaveAnswers(parts, { 0: 0 }, {})).toBe(false);
    expect(compositeAllPartsHaveAnswers(parts, { 0: 0 }, { 1: "pituitary" })).toBe(true);
  });

  test("compositeAllPartsChecked requires every part index", () => {
    const parts = [{ label: "a", type: "short", marks: 1, questionText: "Q" }];
    expect(compositeAllPartsChecked(parts, {})).toBe(false);
    expect(compositeAllPartsChecked(parts, { 0: true })).toBe(true);
  });
});
