/**
 * PR-TRUST: Regression tests for short-answer marking with negation-aware contradiction detection.
 * Ensures we do NOT award marks when the student answer contradicts the expected concept.
 */
const { markShortAnswer, checkContradiction } = require("../utils/shortAnswerMarking");

describe("shortAnswerMarking", () => {
  describe("Eukaryotic cell definition", () => {
    const question = "What is the definition of a eukaryotic cell?";
    const acceptableAnswers = [
      "A cell with a nucleus enclosed by a membrane",
      "A cell with a nucleus",
      "A cell that has a nucleus and membrane-bound organelles",
    ];

    test("should score 1: A cell with a nucleus", () => {
      const result = markShortAnswer("A cell with a nucleus", acceptableAnswers);
      expect(result.correct).toBe(true);
    });

    test("should score 1: A cell with a nucleus enclosed by a membrane", () => {
      const result = markShortAnswer("A cell with a nucleus enclosed by a membrane", acceptableAnswers);
      expect(result.correct).toBe(true);
    });

    test("should score 1: A cell that has a nucleus and membrane-bound organelles", () => {
      const result = markShortAnswer("A cell that has a nucleus and membrane-bound organelles", acceptableAnswers);
      expect(result.correct).toBe(true);
    });

    test("should score 0: It does not have a nucleus", () => {
      const result = markShortAnswer("It does not have a nucleus", acceptableAnswers);
      expect(result.correct).toBe(false);
      expect(result.reason).toBe("contradiction");
    });

    test("should score 0: A cell without a nucleus", () => {
      const result = markShortAnswer("A cell without a nucleus", acceptableAnswers);
      expect(result.correct).toBe(false);
      expect(result.reason).toBe("contradiction");
    });

    test("should score 0: It has no nucleus", () => {
      const result = markShortAnswer("It has no nucleus", acceptableAnswers);
      expect(result.correct).toBe(false);
      expect(result.reason).toBe("contradiction");
    });

    test("should score 0: A prokaryotic cell", () => {
      const result = markShortAnswer("A prokaryotic cell", acceptableAnswers);
      expect(result.correct).toBe(false);
    });

    test("should score 0: A cell without membrane-bound organelles", () => {
      const result = markShortAnswer("A cell without membrane-bound organelles", acceptableAnswers);
      expect(result.correct).toBe(false);
      expect(result.reason).toBe("contradiction");
    });
  });

  describe("Cell membrane function", () => {
    const acceptableAnswers = ["Controls what enters and leaves the cell", "Controls the movement of substances in and out of the cell"];

    test("should score 1: It controls what enters and leaves the cell", () => {
      const result = markShortAnswer("It controls what enters and leaves the cell", acceptableAnswers);
      expect(result.correct).toBe(true);
    });

    test("should score 0: It does not control what enters and leaves the cell", () => {
      const result = markShortAnswer("It does not control what enters and leaves the cell", acceptableAnswers);
      expect(result.correct).toBe(false);
      expect(result.reason).toBe("contradiction");
    });
  });

  describe("checkContradiction", () => {
    test("detects contradiction when student negates key concept", () => {
      const result = checkContradiction("It does not have a nucleus", ["A cell with a nucleus"]);
      expect(result.isContradiction).toBe(true);
      expect(result.negatedConcept).toBe("nucleus");
    });

    test("no contradiction when student affirms key concept", () => {
      const result = checkContradiction("A cell with a nucleus", ["A cell with a nucleus"]);
      expect(result.isContradiction).toBe(false);
    });

    test("detects 'without' as negation", () => {
      const result = checkContradiction("A cell without a nucleus", ["A cell with a nucleus"]);
      expect(result.isContradiction).toBe(true);
    });

    test("detects 'has no' as negation", () => {
      const result = checkContradiction("It has no nucleus", ["nucleus"]);
      expect(result.isContradiction).toBe(true);
    });
  });

  describe("no_concept_match", () => {
    test("generic overlap without key concept scores 0", () => {
      const result = markShortAnswer(
        "Keeps the cell together",
        ["Controls what enters and leaves the cell"]
      );
      expect(result.correct).toBe(false);
      expect(result.reason).toBe("no_concept_match");
    });
  });
});
