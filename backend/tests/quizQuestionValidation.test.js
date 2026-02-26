/**
 * Unit tests for utils/quizQuestionValidation (PR-QUIZ-BANK-TYPES-1).
 * Covers normalizeQuizType, validateMcq, validateShortAnswer, normalizeQuizQuestionItem.
 */
const {
  normalizeQuizType,
  validateMcq,
  validateShortAnswer,
  normalizeQuizQuestionItem,
  MIN_CHOICES,
  MAX_CHOICES,
  MIN_ACCEPTABLE,
  MAX_ACCEPTABLE,
  MATCH_MODES,
} = require("../utils/quizQuestionValidation");

describe("quizQuestionValidation", () => {
  describe("normalizeQuizType", () => {
    test("returns mcq for empty/null/non-string", () => {
      expect(normalizeQuizType("")).toBe("mcq");
      expect(normalizeQuizType(null)).toBe("mcq");
      expect(normalizeQuizType(undefined)).toBe("mcq");
      expect(normalizeQuizType(42)).toBe("mcq");
    });

    test("returns short-answer for short variants", () => {
      expect(normalizeQuizType("shortanswer")).toBe("short-answer");
      expect(normalizeQuizType("short-answer")).toBe("short-answer");
      expect(normalizeQuizType("  short-answer  ")).toBe("short-answer");
    });

    test("returns mcq for mcq", () => {
      expect(normalizeQuizType("mcq")).toBe("mcq");
      expect(normalizeQuizType("MCQ")).toBe("mcq");
    });

    test("throws INVALID_QUIZ_TYPE for unknown type", () => {
      expect(() => normalizeQuizType("other")).toThrow("type must be mcq or short-answer");
      const err = (() => {
        try {
          normalizeQuizType("essay");
        } catch (e) {
          return e;
        }
      })();
      expect(err.code).toBe("INVALID_QUIZ_TYPE");
    });
  });

  describe("validateMcq", () => {
    test("throws INVALID_MCQ_CHOICES when choices not 2-6", () => {
      expect(() => validateMcq({ choices: [], correctIndex: 0 })).toThrow("MCQ choices must be 2-6");
      expect(() => validateMcq({ choices: ["One"], correctIndex: 0 })).toThrow("MCQ choices must be 2-6");
      expect(() => validateMcq({ choices: ["A", "B", "C", "D", "E", "F", "G"], correctIndex: 0 })).toThrow("MCQ choices must be 2-6");
      const err = (() => {
        try {
          validateMcq({ choices: ["A"], correctIndex: 0 });
        } catch (e) {
          return e;
        }
      })();
      expect(err.code).toBe("INVALID_MCQ_CHOICES");
    });

    test("throws INVALID_CORRECT_INDEX when out of range", () => {
      expect(() => validateMcq({ choices: ["A", "B"], correctIndex: 2 })).toThrow("correctIndex must be 0..(choices.length-1)");
      expect(() => validateMcq({ choices: ["A", "B"], correctIndex: -1 })).toThrow("correctIndex must be 0..(choices.length-1)");
      const err = (() => {
        try {
          validateMcq({ choices: ["A", "B"], correctIndex: 5 });
        } catch (e) {
          return e;
        }
      })();
      expect(err.code).toBe("INVALID_CORRECT_INDEX");
    });

    test("returns trimmed choices and correctIndex for valid MCQ", () => {
      const out = validateMcq({ choices: ["  A  ", "B", "C"], correctIndex: 1 });
      expect(out.choices).toEqual(["A", "B", "C"]);
      expect(out.correctIndex).toBe(1);
    });

    test("defaults correctIndex to 0 when not finite", () => {
      const out = validateMcq({ choices: ["A", "B"], correctIndex: null });
      expect(out.correctIndex).toBe(0);
    });

    test("floors correctIndex", () => {
      const out = validateMcq({ choices: ["A", "B", "C"], correctIndex: 2.7 });
      expect(out.correctIndex).toBe(2);
    });
  });

  describe("validateShortAnswer", () => {
    test("throws when acceptableAnswers not 1-10", () => {
      expect(() => validateShortAnswer({ acceptableAnswers: [] })).toThrow(/acceptableAnswers must have 1-10/);
      expect(() => validateShortAnswer({ acceptableAnswers: Array(11).fill("x") })).toThrow(/acceptableAnswers must have 1-10/);
      const err = (() => {
        try {
          validateShortAnswer({ acceptableAnswers: [] });
        } catch (e) {
          return e;
        }
      })();
      expect(err.code).toBe("INVALID_ACCEPTABLE_ANSWERS");
    });

    test("accepts string acceptableAnswers (pipe-separated)", () => {
      const out = validateShortAnswer({ acceptableAnswers: "a|b|c" });
      expect(out.acceptableAnswers).toEqual(["a", "b", "c"]);
      expect(out.matchMode).toBe("contains");
    });

    test("returns matchMode exact when provided", () => {
      const out = validateShortAnswer({ acceptableAnswers: ["one"], matchMode: "exact" });
      expect(out.matchMode).toBe("exact");
    });

    test("defaults matchMode to contains for invalid mode", () => {
      const out = validateShortAnswer({ acceptableAnswers: ["one"], matchMode: "invalid" });
      expect(out.matchMode).toBe("contains");
    });
  });

  describe("normalizeQuizQuestionItem", () => {
    test("throws when input not object", () => {
      expect(() => normalizeQuizQuestionItem(null)).toThrow("Item must be an object");
      expect(() => normalizeQuizQuestionItem("x")).toThrow("Item must be an object");
    });

    test("throws when question/questionText missing or empty", () => {
      expect(() => normalizeQuizQuestionItem({ type: "mcq" })).toThrow("question is required");
      expect(() => normalizeQuizQuestionItem({ type: "mcq", question: "  " })).toThrow("question is required");
      expect(() => normalizeQuizQuestionItem({ type: "mcq", questionText: "" })).toThrow("question is required");
    });

    test("accepts question or questionText", () => {
      const out = normalizeQuizQuestionItem({
        question: "  What is it?  ",
        type: "mcq",
        choices: ["A", "B"],
        correctIndex: 0,
      });
      expect(out.questionText).toBe("What is it?");
    });

    test("normalizes MCQ item", () => {
      const out = normalizeQuizQuestionItem({
        questionText: "Pick one",
        type: "mcq",
        choices: ["One", "Two"],
        correctIndex: 1,
      });
      expect(out).toMatchObject({
        type: "mcq",
        questionText: "Pick one",
        choices: ["One", "Two"],
        correctIndex: 1,
      });
    });

    test("normalizes short-answer item", () => {
      const out = normalizeQuizQuestionItem({
        questionText: "Name it",
        type: "short-answer",
        acceptableAnswers: ["a", "b"],
        matchMode: "contains",
      });
      expect(out).toMatchObject({
        type: "short-answer",
        questionText: "Name it",
        acceptableAnswers: ["a", "b"],
        matchMode: "contains",
      });
    });

    test("throws INVALID_QUIZ_TYPE for bad type", () => {
      expect(() => normalizeQuizQuestionItem({
        questionText: "Q?",
        type: "essay",
      })).toThrow("type must be mcq or short-answer");
    });

    test("includes difficulty, skill, estimatedTimeSec when provided", () => {
      const out = normalizeQuizQuestionItem({
        questionText: "Q?",
        type: "mcq",
        choices: ["A", "B"],
        correctIndex: 0,
        difficulty: 3,
        skill: "recall",
        estimatedTimeSec: 60,
      });
      expect(out.difficulty).toBe(3);
      expect(out.skill).toBe("recall");
      expect(out.estimatedTimeSec).toBe(60);
    });

    test("rethrows metadata validation errors", () => {
      expect(() => normalizeQuizQuestionItem({
        questionText: "Q?",
        type: "mcq",
        choices: ["A", "B"],
        correctIndex: 0,
        difficulty: 99,
      })).toThrow();
    });
  });

  describe("constants", () => {
    test("exports expected constants", () => {
      expect(MIN_CHOICES).toBe(2);
      expect(MAX_CHOICES).toBe(6);
      expect(MIN_ACCEPTABLE).toBe(1);
      expect(MAX_ACCEPTABLE).toBe(10);
      expect(MATCH_MODES).toContain("exact");
      expect(MATCH_MODES).toContain("contains");
    });
  });
});
