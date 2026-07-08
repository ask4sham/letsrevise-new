import {
  gradeTablePart,
  tableHasStudentInput,
  validateTablePartData,
} from "./markTable";
import { serializeTableStudentAnswers } from "./tableTypes";

const SAMPLE_TABLE = {
  headers: ["Component", "Increase (%)"],
  rows: [
    {
      cells: [
        { value: "Calcium", blank: false },
        { blank: true, correctAnswer: "12" },
      ],
    },
    {
      cells: [
        { value: "Iron", blank: false },
        { blank: true, correctAnswer: "8" },
      ],
    },
  ],
};

describe("table interaction marking", () => {
  test("validates complete table partData", () => {
    expect(validateTablePartData(SAMPLE_TABLE).ok).toBe(true);
  });

  test("rejects table without blanks", () => {
    const result = validateTablePartData({
      headers: ["A"],
      rows: [{ cells: [{ value: "x" }] }],
    });
    expect(result.ok).toBe(false);
  });

  test("awards full marks for correct cells", () => {
    const answers = serializeTableStudentAnswers({ "0:1": "12", "1:1": "8" });
    const grade = gradeTablePart({ partData: SAMPLE_TABLE, studentAnswerJson: answers, marks: 2 });
    expect(grade?.status).toBe("correct");
    expect(grade?.marksAwarded).toBe(2);
  });

  test("awards partial marks for one correct cell", () => {
    const answers = serializeTableStudentAnswers({ "0:1": "12", "1:1": "wrong" });
    const grade = gradeTablePart({ partData: SAMPLE_TABLE, studentAnswerJson: answers, marks: 2 });
    expect(grade?.status).toBe("partial");
    expect(grade?.marksAwarded).toBe(1);
  });

  test("detects student input", () => {
    expect(tableHasStudentInput(undefined)).toBe(false);
    expect(tableHasStudentInput(serializeTableStudentAnswers({ "0:1": "12" }))).toBe(true);
  });
});
