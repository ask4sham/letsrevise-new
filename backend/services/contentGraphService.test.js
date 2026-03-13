/**
 * Unit tests for content graph service (pure logic, no DB).
 */
const {
  taxonomyCanonicalKey,
  lessonCanonicalKey,
  flashcardCanonicalKey,
  examQuestionCanonicalKey,
  quizQuestionCanonicalKey,
} = require("../utils/contentCanonicalKey");

describe("contentGraphService canonical behavior", () => {
  describe("taxonomyCanonicalKey deterministic", () => {
    it("same inputs produce same output", () => {
      const a = taxonomyCanonicalKey("aqa-gcse-biology", "cell-structure");
      const b = taxonomyCanonicalKey("aqa-gcse-biology", "cell-structure");
      expect(a).toBe(b);
      expect(a).toBe("taxonomy:aqa-gcse-biology:cell-structure");
    });
  });

  describe("lessonCanonicalKey deterministic", () => {
    it("same id produces same output", () => {
      const id = "507f1f77bcf86cd799439011";
      expect(lessonCanonicalKey(id)).toBe(lessonCanonicalKey(id));
    });
  });

  describe("flashcardCanonicalKey deterministic", () => {
    it("same id produces same output", () => {
      const id = "507f1f77bcf86cd799439012";
      expect(flashcardCanonicalKey(id)).toBe(flashcardCanonicalKey(id));
    });
  });

  describe("examQuestionCanonicalKey deterministic", () => {
    it("same id produces same output", () => {
      const id = "507f1f77bcf86cd799439013";
      expect(examQuestionCanonicalKey(id)).toBe(examQuestionCanonicalKey(id));
    });
  });

  describe("quizQuestionCanonicalKey deterministic", () => {
    it("same id produces same output", () => {
      const id = "507f1f77bcf86cd799439014";
      expect(quizQuestionCanonicalKey(id)).toBe(quizQuestionCanonicalKey(id));
    });
  });
});
