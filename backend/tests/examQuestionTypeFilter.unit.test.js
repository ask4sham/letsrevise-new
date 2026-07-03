const {
  buildExamQuestionTypeQuery,
  applyExamQuestionTypeFilter,
} = require("../utils/examQuestionTypeFilter");

describe("examQuestionTypeFilter", () => {
  test("empty type returns null", () => {
    expect(buildExamQuestionTypeQuery("")).toBeNull();
    expect(buildExamQuestionTypeQuery(undefined)).toBeNull();
  });

  test("mcq includes single MCQs and composites with MCQ parts", () => {
    expect(buildExamQuestionTypeQuery("mcq")).toEqual({
      $or: [{ type: "mcq" }, { type: "composite", "parts.type": "mcq" }],
    });
  });

  test("composite filter matches top-level composite only", () => {
    expect(buildExamQuestionTypeQuery("composite")).toEqual({ type: "composite" });
  });

  test("short filter is exact", () => {
    expect(buildExamQuestionTypeQuery("short")).toEqual({ type: "short" });
  });

  test("applyExamQuestionTypeFilter pushes mcq $or into $and", () => {
    const query = { status: "published" };
    applyExamQuestionTypeFilter(query, "mcq");
    expect(query).toEqual({
      status: "published",
      $and: [{ $or: [{ type: "mcq" }, { type: "composite", "parts.type": "mcq" }] }],
    });
  });

  test("applyExamQuestionTypeFilter sets type for composite", () => {
    const query = {};
    applyExamQuestionTypeFilter(query, "composite");
    expect(query).toEqual({ type: "composite" });
  });
});
