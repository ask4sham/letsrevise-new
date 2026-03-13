/**
 * Unit tests for content canonical key generation.
 */
const {
  taxonomyCanonicalKey,
  lessonCanonicalKey,
  flashcardCanonicalKey,
  examQuestionCanonicalKey,
  quizQuestionCanonicalKey,
  toIdStr,
} = require("./contentCanonicalKey");

describe("contentCanonicalKey", () => {
  describe("taxonomyCanonicalKey", () => {
    it("returns taxonomy:specKey:topicKey", () => {
      expect(taxonomyCanonicalKey("aqa-gcse-biology", "cell-structure")).toBe(
        "taxonomy:aqa-gcse-biology:cell-structure"
      );
    });
    it("returns empty when specKey is missing", () => {
      expect(taxonomyCanonicalKey("", "cell-structure")).toBe("");
    });
    it("returns empty when topicKey is missing", () => {
      expect(taxonomyCanonicalKey("aqa-gcse-biology", "")).toBe("");
    });
    it("trims whitespace", () => {
      expect(taxonomyCanonicalKey("  aqa-gcse-biology  ", "  cell-structure  ")).toBe(
        "taxonomy:aqa-gcse-biology:cell-structure"
      );
    });
  });

  describe("lessonCanonicalKey", () => {
    it("returns lesson:<id> for ObjectId", () => {
      const id = "507f1f77bcf86cd799439011";
      expect(lessonCanonicalKey(id)).toBe(`lesson:${id}`);
    });
    it("returns empty for null/empty", () => {
      expect(lessonCanonicalKey(null)).toBe("");
      expect(lessonCanonicalKey("")).toBe("");
    });
  });

  describe("flashcardCanonicalKey", () => {
    it("returns flashcard:<id>", () => {
      const id = "507f1f77bcf86cd799439012";
      expect(flashcardCanonicalKey(id)).toBe(`flashcard:${id}`);
    });
    it("returns empty for null", () => {
      expect(flashcardCanonicalKey(null)).toBe("");
    });
  });

  describe("examQuestionCanonicalKey", () => {
    it("returns examQuestion:<id>", () => {
      const id = "507f1f77bcf86cd799439013";
      expect(examQuestionCanonicalKey(id)).toBe(`examQuestion:${id}`);
    });
    it("returns empty for empty string", () => {
      expect(examQuestionCanonicalKey("")).toBe("");
    });
  });

  describe("quizQuestionCanonicalKey", () => {
    it("returns quizQuestion:<id>", () => {
      const id = "507f1f77bcf86cd799439014";
      expect(quizQuestionCanonicalKey(id)).toBe(`quizQuestion:${id}`);
    });
  });

  describe("toIdStr", () => {
    it("returns string for valid ObjectId", () => {
      const id = "507f1f77bcf86cd799439011";
      expect(toIdStr(id)).toBe(id);
    });
    it("returns empty for null", () => {
      expect(toIdStr(null)).toBe("");
    });
  });
});
