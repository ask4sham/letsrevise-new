import type { ExamQuestionPart } from "../../../api/examQuestions";
import {
  buildCompositeExamSummary,
  gradeCompositePartResult,
} from "./compositeMarking";
import { serializeTableStudentAnswers } from "./interactions/table/tableTypes";

const TABLE_PART: ExamQuestionPart = {
  label: "b",
  type: "table",
  marks: 2,
  questionText: "Complete the table.",
  markScheme: ["FSH stimulates follicles", "LH triggers ovulation"],
  partData: {
    headers: ["Hormone", "Role"],
    rows: [
      {
        cells: [
          { value: "FSH", blank: false },
          { blank: true, correctAnswer: "Stimulates follicles" },
        ],
      },
      {
        cells: [
          { value: "LH", blank: false },
          { blank: true, correctAnswer: "Triggers ovulation" },
        ],
      },
    ],
  },
};

const MCQ_PART: ExamQuestionPart = {
  label: "a",
  type: "mcq",
  marks: 1,
  questionText: "Which hormone triggers ovulation?",
  options: ["FSH", "LH"],
  correctIndex: 1,
  markScheme: ["Correct answer: B — LH"],
};

const SHORT_PART: ExamQuestionPart = {
  label: "c",
  type: "short",
  marks: 1,
  questionText: "Name the gland that secretes FSH.",
  markScheme: ["Pituitary gland"],
};

describe("compositeMarking table parts", () => {
  test("grades table part with full marks when all blanks correct", () => {
    const answers = serializeTableStudentAnswers({
      "0:1": "Stimulates follicles",
      "1:1": "Triggers ovulation",
    });
    const result = gradeCompositePartResult(TABLE_PART, undefined, answers);
    expect(result?.status).toBe("correct");
    expect(result?.marksAwarded).toBe(2);
  });

  test("grades table part with partial marks", () => {
    const answers = serializeTableStudentAnswers({
      "0:1": "Stimulates follicles",
      "1:1": "wrong",
    });
    const result = gradeCompositePartResult(TABLE_PART, undefined, answers);
    expect(result?.status).toBe("partial");
    expect(result?.marksAwarded).toBe(1);
  });

  test("buildCompositeExamSummary handles mixed MCQ + table + short", () => {
    const parts = [MCQ_PART, TABLE_PART, SHORT_PART];
    const tableAnswers = serializeTableStudentAnswers({
      "0:1": "Stimulates follicles",
      "1:1": "Triggers ovulation",
    });

    const summary = buildCompositeExamSummary(
      parts,
      { 0: true, 1: true, 2: true },
      { 0: 1 },
      { 1: tableAnswers, 2: "Pituitary gland" },
      4
    );

    expect(summary?.marksAwarded).toBe(4);
    expect(summary?.status).toBe("correct");
    expect(summary?.strongAreas.length).toBeGreaterThan(0);
  });
});
