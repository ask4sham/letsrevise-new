/**
 * Unit tests for utils/quizValidation (PR-QUESTION-BROWSER-1).
 * Covers validateMcq and validateShortAnswer branches for full coverage.
 */
const { validateMcq, validateShortAnswer } = require("../utils/quizValidation");

describe("quizValidation", () => {
  describe("validateMcq", () => {
    test("throws INVALID_CHOICES when choices is not an array", () => {
      expect(() => validateMcq({ choices: null, correctChoice: "A" })).toThrow("MCQ choices must be 2-6");
      const err = (() => {
        try {
          validateMcq({ choices: "not array", correctChoice: "A" });
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeDefined();
      expect(err.code).toBe("INVALID_CHOICES");
    });

    test("throws INVALID_CHOICES when fewer than 2 or more than 6 non-empty choices", () => {
      expect(() => validateMcq({ choices: ["Only one"], correctChoice: "A" })).toThrow("MCQ choices must be 2-6");
      expect(() => validateMcq({ choices: ["A", "B", "C", "D", "E", "F", "G"], correctChoice: "A" })).toThrow(
        "MCQ choices must be 2-6"
      );
      const err = (() => {
        try {
          validateMcq({ choices: ["One"], correctChoice: "A" });
        } catch (e) {
          return e;
        }
      })();
      expect(err.code).toBe("INVALID_CHOICES");
    });

    test("throws INVALID_CORRECT_CHOICE when correctChoice is missing or empty", () => {
      expect(() => validateMcq({ choices: ["A", "B"], correctChoice: "" })).toThrow("Correct choice is required");
      expect(() => validateMcq({ choices: ["A", "B"], correctChoice: null })).toThrow("Correct choice is required");
      expect(() => validateMcq({ choices: ["A", "B"], correctChoice: "   " })).toThrow("Correct choice is required");
      const err = (() => {
        try {
          validateMcq({ choices: ["A", "B"], correctChoice: "" });
        } catch (e) {
          return e;
        }
      })();
      expect(err.code).toBe("INVALID_CORRECT_CHOICE");
    });

    test("throws INVALID_CORRECT_CHOICE when correctChoice letter is out of range", () => {
      expect(() => validateMcq({ choices: ["One", "Two"], correctChoice: "C" })).toThrow(
        "Correct choice must match an available option"
      );
      expect(() => validateMcq({ choices: ["A", "B", "C"], correctChoice: "D" })).toThrow(
        "Correct choice must match an available option"
      );
      const err = (() => {
        try {
          validateMcq({ choices: ["One", "Two"], correctChoice: "C" });
        } catch (e) {
          return e;
        }
      })();
      expect(err.code).toBe("INVALID_CORRECT_CHOICE");
    });

    test("returns cleaned choices and correctIndex for valid MCQ", () => {
      const out = validateMcq({ choices: ["  One  ", "Two", "Three"], correctChoice: "c" });
      expect(out.choices).toEqual(["One", "Two", "Three"]);
      expect(out.correctIndex).toBe(2);
      expect(out.correctChoice).toBe("C");
    });

    test("strips null/undefined choices via map trim", () => {
      const out = validateMcq({ choices: ["A", null, "B", undefined, ""], correctChoice: "B" });
      expect(out.choices).toEqual(["A", "B"]);
      expect(out.correctIndex).toBe(1);
    });
  });

  describe("validateShortAnswer", () => {
    test("throws INVALID_ACCEPTABLE_ANSWERS when no acceptable answers", () => {
      expect(() => validateShortAnswer({ acceptableAnswers: [] })).toThrow(/at least one acceptable answer/);
      expect(() => validateShortAnswer({ acceptableAnswers: ["  ", ""] })).toThrow(/at least one acceptable answer/);
      expect(() => validateShortAnswer({ acceptableAnswers: null })).toThrow(/at least one acceptable answer/);
      const err = (() => {
        try {
          validateShortAnswer({ acceptableAnswers: [] });
        } catch (e) {
          return e;
        }
      })();
      expect(err.code).toBe("INVALID_ACCEPTABLE_ANSWERS");
    });

    test("returns acceptableAnswers (capped at 20) and matchMode", () => {
      const out = validateShortAnswer({ acceptableAnswers: ["nucleus"], matchMode: "contains" });
      expect(out.acceptableAnswers).toEqual(["nucleus"]);
      expect(out.matchMode).toBe("contains");

      const exact = validateShortAnswer({ acceptableAnswers: ["exact"], matchMode: "exact" });
      expect(exact.matchMode).toBe("exact");

      const defaultMode = validateShortAnswer({ acceptableAnswers: ["a"] });
      expect(defaultMode.matchMode).toBe("contains");
    });

    test("accepts non-array acceptableAnswers by treating as empty and throwing", () => {
      expect(() => validateShortAnswer({ acceptableAnswers: "not array" })).toThrow(/at least one acceptable answer/);
    });

    test("caps acceptableAnswers at 20", () => {
      const many = Array.from({ length: 25 }, (_, i) => `ans${i}`);
      const out = validateShortAnswer({ acceptableAnswers: many });
      expect(out.acceptableAnswers).toHaveLength(20);
      expect(out.acceptableAnswers[0]).toBe("ans0");
      expect(out.acceptableAnswers[19]).toBe("ans19");
    });

    test("trims and filters null/undefined in acceptableAnswers array", () => {
      const out = validateShortAnswer({
        acceptableAnswers: ["  ok  ", null, undefined, "", "x"],
        matchMode: "exact",
      });
      expect(out.acceptableAnswers).toEqual(["ok", "x"]);
      expect(out.matchMode).toBe("exact");
    });
  });
});
