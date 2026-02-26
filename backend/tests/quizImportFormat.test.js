/**
 * Unit tests for utils/quizImportFormat (PR-QUIZ-TYPES-1).
 * Covers normalizeQuizType, parseCsvToQuizItems, parseCsvRowToItem, validateQuizItem.
 */
const {
  normalizeQuizType,
  parseCsvToQuizItems,
  validateQuizItem,
} = require("../utils/quizImportFormat");

describe("quizImportFormat", () => {
  describe("normalizeQuizType", () => {
    test("returns mcq for null/undefined/non-string", () => {
      expect(normalizeQuizType(null)).toBe("mcq");
      expect(normalizeQuizType(undefined)).toBe("mcq");
      expect(normalizeQuizType(42)).toBe("mcq");
    });

    test("returns mcq for 'mcq' variants", () => {
      expect(normalizeQuizType("mcq")).toBe("mcq");
      expect(normalizeQuizType("MCQ")).toBe("mcq");
      expect(normalizeQuizType("  mcq  ")).toBe("mcq");
    });

    test("returns short-answer for short variants", () => {
      expect(normalizeQuizType("short")).toBe("short-answer");
      expect(normalizeQuizType("short-answer")).toBe("short-answer");
      expect(normalizeQuizType("short_answer")).toBe("short-answer");
      expect(normalizeQuizType("Short Answer")).toBe("short-answer");
      expect(normalizeQuizType("shortanswer")).toBe("short-answer");
    });

    test("returns mcq for unknown type", () => {
      expect(normalizeQuizType("other")).toBe("mcq");
      expect(normalizeQuizType("")).toBe("mcq");
    });
  });

  describe("validateQuizItem", () => {
    test("returns error for null/non-object", () => {
      expect(validateQuizItem(null)).toEqual({ message: "Invalid item", code: "INVALID_ITEM" });
      expect(validateQuizItem(undefined)).toEqual({ message: "Invalid item", code: "INVALID_ITEM" });
      expect(validateQuizItem("string")).toEqual({ message: "Invalid item", code: "INVALID_ITEM" });
    });

    test("MCQ: invalid when choices not 2-6", () => {
      expect(validateQuizItem({ type: "mcq", questionText: "Q?", choices: ["Only one"], correctIndex: 0 }))
        .toMatchObject({ code: "INVALID_MCQ_CHOICES" });
      expect(validateQuizItem({ type: "mcq", questionText: "Q?", choices: ["A", "B", "C", "D", "E", "F", "G"], correctIndex: 0 }))
        .toMatchObject({ code: "INVALID_MCQ_CHOICES" });
    });

    test("MCQ: invalid when correctIndex out of range", () => {
      expect(validateQuizItem({ type: "mcq", questionText: "Q?", choices: ["A", "B"], correctIndex: 2 }))
        .toMatchObject({ code: "INVALID_CORRECT_INDEX" });
      expect(validateQuizItem({ type: "mcq", questionText: "Q?", choices: ["A", "B"], correctIndex: -1 }))
        .toMatchObject({ code: "INVALID_CORRECT_INDEX" });
    });

    test("MCQ: valid item returns null", () => {
      expect(validateQuizItem({
        type: "mcq",
        questionText: "What is 2+2?",
        choices: ["3", "4", "5"],
        correctIndex: 1,
      })).toBeNull();
    });

    test("short-answer: invalid when acceptableAnswers empty or too many", () => {
      expect(validateQuizItem({
        type: "short-answer",
        questionText: "Q?",
        acceptableAnswers: [],
      })).toMatchObject({ code: "INVALID_ACCEPTABLE_ANSWERS" });
    });

    test("short-answer: valid item returns null", () => {
      expect(validateQuizItem({
        type: "short-answer",
        questionText: "Name the organelle.",
        acceptableAnswers: ["mitochondria", "Mitochondria"],
        matchMode: "contains",
      })).toBeNull();
    });

    test("validation throw is caught and returned as error", () => {
      const result = validateQuizItem({
        type: "short-answer",
        questionText: "Q?",
        acceptableAnswers: Array(12).fill("x"),
      });
      expect(result).toMatchObject({ code: "INVALID_ACCEPTABLE_ANSWERS" });
    });
  });

  describe("parseCsvToQuizItems", () => {
    test("returns empty items and errors when csvText empty or missing", () => {
      expect(parseCsvToQuizItems({ csvText: "", type: "mcq" })).toEqual({ items: [], errors: [] });
      expect(parseCsvToQuizItems({ csvText: "   ", type: "mcq" })).toEqual({ items: [], errors: [] });
      expect(parseCsvToQuizItems({ csvText: null, type: "mcq" })).toEqual({ items: [], errors: [] });
    });

    test("returns empty when fewer than 2 lines", () => {
      expect(parseCsvToQuizItems({ csvText: "only one line", type: "mcq" })).toEqual({ items: [], errors: [] });
    });

    test("parses comma-delimited MCQ CSV", () => {
      const csv = [
        "question,choicea,choiceb,choicec,correct",
        "What is 2+2?,3,4,5,B",
      ].join("\n");
      const { items, errors } = parseCsvToQuizItems({ csvText: csv, type: "mcq" });
      expect(errors).toHaveLength(0);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        type: "mcq",
        questionText: "What is 2+2?",
        choices: ["3", "4", "5"],
        correctIndex: 1,
      });
    });

    test("parses tab-delimited when tab present", () => {
      const csv = [
        "question\tchoicea\tchoiceb\tcorrect",
        "Q?\tA\tB\tA",
      ].join("\n");
      const { items, errors } = parseCsvToQuizItems({ csvText: csv, type: "mcq" });
      expect(errors).toHaveLength(0);
      expect(items).toHaveLength(1);
      expect(items[0].choices).toEqual(["A", "B"]);
      expect(items[0].correctIndex).toBe(0);
    });

    test("correct column: letter A-F maps to index", () => {
      const csv = [
        "question,choicea,choiceb,choicec,choiced,correct",
        "Which is D?,First,Second,Third,Fourth,D",
      ].join("\n");
      const { items } = parseCsvToQuizItems({ csvText: csv, type: "mcq" });
      expect(items[0].correctIndex).toBe(3);
    });

    test("correct column: numeric index", () => {
      const csv = [
        "question,choicea,choiceb,correct",
        "Pick 2?,A,B,2",
      ].join("\n");
      const { items } = parseCsvToQuizItems({ csvText: csv, type: "mcq" });
      expect(items[0].correctIndex).toBe(1);
    });

    test("adds error for missing question", () => {
      const csv = [
        "question,choicea,choiceb,correct",
        ",A,B,A",
      ].join("\n");
      const { items, errors } = parseCsvToQuizItems({ csvText: csv, type: "mcq" });
      expect(items).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({ message: "Missing question", code: "MISSING_QUESTION" });
    });

    test("parses short-answer CSV with acceptable column", () => {
      const csv = [
        "question,acceptable,explanation",
        "Name it,ans1|ans2,Short explanation",
      ].join("\n");
      const { items, errors } = parseCsvToQuizItems({ csvText: csv, type: "short-answer" });
      expect(errors).toHaveLength(0);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        type: "short-answer",
        questionText: "Name it",
        acceptableAnswers: ["ans1", "ans2"],
        explanation: "Short explanation",
      });
    });

    test("handles quoted CSV cells", () => {
      const csv = [
        "question,choicea,choiceb,correct",
        '"What, is it?",A,B,B',
      ].join("\n");
      const { items } = parseCsvToQuizItems({ csvText: csv, type: "mcq" });
      expect(items[0].questionText).toBe("What, is it?");
    });

    test("topic_key column is parsed", () => {
      const csv = [
        "topic_key,question,choicea,choiceb,correct",
        "cell-structure,Nucleus?,A,B,A",
      ].join("\n");
      const { items } = parseCsvToQuizItems({ csvText: csv, type: "mcq" });
      expect(items[0].topicKey).toBe("cell-structure");
    });

    test("normalizes type from option (SHORT -> short-answer)", () => {
      const csv = [
        "question,acceptable",
        "Name the process,photosynthesis|respiration",
      ].join("\n");
      const { items } = parseCsvToQuizItems({ csvText: csv, type: " SHORT " });
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("short-answer");
    });
  });
});
