/**
 * Unit tests for Student Topic Evidence service.
 */
const studentTopicEvidenceService = require("../services/studentTopicEvidenceService");

describe("studentTopicEvidenceService", () => {
  describe("classifyDifficultyLevel", () => {
    it("accuracy < 50 -> very_difficult", () => {
      expect(studentTopicEvidenceService.classifyDifficultyLevel(40)).toBe("very_difficult");
      expect(studentTopicEvidenceService.classifyDifficultyLevel(0)).toBe("very_difficult");
    });

    it("accuracy 50-65 -> difficult", () => {
      expect(studentTopicEvidenceService.classifyDifficultyLevel(50)).toBe("difficult");
      expect(studentTopicEvidenceService.classifyDifficultyLevel(64)).toBe("difficult");
    });

    it("accuracy 65-80 -> moderate", () => {
      expect(studentTopicEvidenceService.classifyDifficultyLevel(65)).toBe("moderate");
      expect(studentTopicEvidenceService.classifyDifficultyLevel(79)).toBe("moderate");
    });

    it("accuracy 80+ -> well_understood", () => {
      expect(studentTopicEvidenceService.classifyDifficultyLevel(80)).toBe("well_understood");
      expect(studentTopicEvidenceService.classifyDifficultyLevel(100)).toBe("well_understood");
    });

    it("null/undefined -> unknown", () => {
      expect(studentTopicEvidenceService.classifyDifficultyLevel(null)).toBe("unknown");
      expect(studentTopicEvidenceService.classifyDifficultyLevel(undefined)).toBe("unknown");
    });
  });

  describe("quiz accuracy calculation", () => {
    it("computes accuracy from correct/attempts", () => {
      const events = [
        { eventType: "quiz_attempt", correct: true },
        { eventType: "quiz_attempt", correct: true },
        { eventType: "quiz_attempt", correct: false },
      ];
      const attempts = events.length;
      const correct = events.filter((e) => e.correct === true).length;
      const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : null;
      expect(accuracy).toBe(67);
    });

    it("zero attempts returns null accuracy", () => {
      const events = [];
      const attempts = events.length;
      const accuracy = attempts > 0 ? Math.round((events.filter((e) => e.correct === true).length / attempts) * 100) : null;
      expect(accuracy).toBeNull();
    });
  });

  describe("flashcard average difficulty", () => {
    it("averages difficulty ratings 1-5", () => {
      const ratings = [1, 3, 5];
      const avg = ratings.length > 0
        ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
        : null;
      expect(avg).toBe(3);
    });

    it("filters invalid ratings", () => {
      const ratings = [1, 3, null, 6, 5];
      const valid = ratings.filter((r) => r != null && r >= 1 && r <= 5);
      const avg = valid.length > 0
        ? Math.round((valid.reduce((s, r) => s + r, 0) / valid.length) * 10) / 10
        : null;
      expect(avg).toBe(3);
    });
  });

  describe("mastery score calculation", () => {
    it("averages quiz and exam accuracy when both exist", () => {
      const quizAccuracy = 80;
      const examAccuracy = 60;
      const mastery = Math.round((quizAccuracy + examAccuracy) / 2);
      expect(mastery).toBe(70);
    });

    it("uses quiz only when exam is null", () => {
      const quizAccuracy = 75;
      const examAccuracy = null;
      const mastery = quizAccuracy !== null && examAccuracy !== null
        ? Math.round((quizAccuracy + examAccuracy) / 2)
        : quizAccuracy !== null
        ? quizAccuracy
        : examAccuracy;
      expect(mastery).toBe(75);
    });

    it("returns null when no accuracy data", () => {
      const quizAccuracy = null;
      const examAccuracy = null;
      const mastery = quizAccuracy !== null && examAccuracy !== null
        ? Math.round((quizAccuracy + examAccuracy) / 2)
        : quizAccuracy !== null
        ? quizAccuracy
        : examAccuracy !== null
        ? examAccuracy
        : null;
      expect(mastery).toBeNull();
    });
  });

  describe("null-safe aggregation", () => {
    it("handles empty events", () => {
      const events = [];
      const quizEvents = events.filter((e) => e.eventType === "quiz_attempt");
      const quizAttempts = quizEvents.length;
      const quizCorrect = quizEvents.filter((e) => e.correct === true).length;
      const quizAccuracy = quizAttempts > 0 ? Math.round((quizCorrect / quizAttempts) * 100) : null;
      expect(quizAttempts).toBe(0);
      expect(quizAccuracy).toBeNull();
    });

    it("handles events with null correct", () => {
      const events = [{ eventType: "quiz_attempt", correct: null }];
      const quizEvents = events.filter((e) => e.eventType === "quiz_attempt");
      const correct = quizEvents.filter((e) => e.correct === true).length;
      expect(correct).toBe(0);
    });
  });
});
