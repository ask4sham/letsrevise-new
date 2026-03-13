/**
 * Unit tests for content coverage scoring.
 */
const { computeCoverageScore, normalizeCoverageResponse } = require("./contentCoverageService");

describe("contentCoverageService", () => {
  describe("computeCoverageScore", () => {
    it("score weak when no lesson", () => {
      const { score, status, weakAreas } = computeCoverageScore({
        lessonCount: 0,
        flashcardCount: 0,
        quizCount: 0,
        examQuestionCount: 0,
      });
      expect(score).toBe(0);
      expect(status).toBe("weak");
      expect(weakAreas).toContain("lessons");
    });

    it("score partial with lesson + low content", () => {
      const { score, status, weakAreas } = computeCoverageScore({
        lessonCount: 1,
        flashcardCount: 2,
        quizCount: 1,
        examQuestionCount: 0,
      });
      expect(score).toBe(30);
      expect(status).toBe("weak");
      expect(weakAreas).toContain("flashcards");
      expect(weakAreas).toContain("quiz");
      expect(weakAreas).toContain("exam");
    });

    it("score partial with lesson + 5 flashcards + 3 quiz", () => {
      const { score, status } = computeCoverageScore({
        lessonCount: 1,
        flashcardCount: 5,
        quizCount: 3,
        examQuestionCount: 0,
      });
      expect(score).toBe(70);
      expect(status).toBe("strong");
    });

    it("score strong with sufficient linked content", () => {
      const { score, status, weakAreas } = computeCoverageScore({
        lessonCount: 1,
        flashcardCount: 10,
        quizCount: 5,
        examQuestionCount: 5,
      });
      expect(score).toBe(90);
      expect(status).toBe("strong");
      expect(weakAreas).not.toContain("lessons");
      expect(weakAreas).not.toContain("flashcards");
      expect(weakAreas).not.toContain("quiz");
      expect(weakAreas).not.toContain("exam");
    });

    it("issue penalty applied correctly", () => {
      const { score, status, weakAreas } = computeCoverageScore(
        {
          lessonCount: 1,
          flashcardCount: 5,
          quizCount: 3,
          examQuestionCount: 2,
        },
        10
      );
      expect(score).toBe(80); // 90 - 10
      expect(status).toBe("strong");
      expect(weakAreas).toContain("issues");
    });

    it("issue penalty capped at 10", () => {
      const { score } = computeCoverageScore(
        {
          lessonCount: 1,
          flashcardCount: 5,
          quizCount: 3,
          examQuestionCount: 2,
        },
        50
      );
      expect(score).toBe(80);
    });

    it("weakAreas generated correctly", () => {
      const { weakAreas } = computeCoverageScore({
        lessonCount: 0,
        flashcardCount: 2,
        quizCount: 0,
        examQuestionCount: 0,
      });
      expect(weakAreas).toContain("lessons");
      expect(weakAreas).toContain("flashcards");
      expect(weakAreas).toContain("quiz");
      expect(weakAreas).toContain("exam");
    });
  });

  describe("normalizeCoverageResponse", () => {
    it("returns stable shape with counts object", () => {
      const cov = {
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        lessonCount: 1,
        flashcardCount: 5,
        quizCount: 3,
        examQuestionCount: 2,
        issueCount: 1,
        coverageScore: 80,
        status: "strong",
        weakAreas: ["issues"],
      };
      const out = normalizeCoverageResponse(cov);
      expect(out).toEqual({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        counts: {
          lessons: 1,
          flashcards: 5,
          quizzes: 3,
          examQuestions: 2,
          openIssues: 1,
        },
        score: 80,
        status: "strong",
        weakAreas: ["issues"],
      });
    });

    it("deduplicates weakAreas", () => {
      const cov = {
        specKey: "a",
        topicKey: "b",
        lessonCount: 0,
        flashcardCount: 0,
        quizCount: 0,
        examQuestionCount: 0,
        issueCount: 0,
        coverageScore: 0,
        status: "weak",
        weakAreas: ["lessons", "lessons"],
      };
      const out = normalizeCoverageResponse(cov);
      expect(out.weakAreas).toEqual(["lessons"]);
    });

    it("returns null for null input", () => {
      expect(normalizeCoverageResponse(null)).toBeNull();
    });
  });
});
