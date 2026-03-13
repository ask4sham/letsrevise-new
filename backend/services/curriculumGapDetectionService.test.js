/**
 * Unit tests for curriculum gap detection service.
 */
const {
  computeGapFlags,
  computePriorityScore,
  buildGapRecommendations,
  rankTopicGaps,
  generateTopicGapSummary,
} = require("./curriculumGapDetectionService");

describe("curriculumGapDetectionService", () => {
  describe("computeGapFlags", () => {
    it("missingLesson when no lessons", () => {
      const flags = computeGapFlags({ lessons: 0, flashcards: 5, quizzes: 3, examQuestions: 2, openIssues: 0 });
      expect(flags.missingLesson).toBe(true);
    });

    it("lowFlashcards when < 5", () => {
      const flags = computeGapFlags({ lessons: 1, flashcards: 3, quizzes: 3, examQuestions: 2, openIssues: 0 });
      expect(flags.lowFlashcards).toBe(true);
    });

    it("lowExamQuestions when < 2", () => {
      const flags = computeGapFlags({ lessons: 1, flashcards: 5, quizzes: 3, examQuestions: 1, openIssues: 0 });
      expect(flags.lowExamQuestions).toBe(true);
    });

    it("highIssueRate when >= 3 open issues", () => {
      const flags = computeGapFlags({ lessons: 1, flashcards: 5, quizzes: 3, examQuestions: 2, openIssues: 4 });
      expect(flags.highIssueRate).toBe(true);
    });

    it("no flags when content sufficient and no issues", () => {
      const flags = computeGapFlags({ lessons: 1, flashcards: 5, quizzes: 3, examQuestions: 2, openIssues: 0 });
      expect(flags.missingLesson).toBe(false);
      expect(flags.lowFlashcards).toBe(false);
      expect(flags.lowQuizzes).toBe(false);
      expect(flags.lowExamQuestions).toBe(false);
      expect(flags.highIssueRate).toBe(false);
    });
  });

  describe("computePriorityScore", () => {
    it("topic with no lesson gets high priority", () => {
      const flags = { missingLesson: true, lowFlashcards: false, lowQuizzes: false, lowExamQuestions: false, highIssueRate: false, unresolvedMappings: false };
      const score = computePriorityScore(flags, 0);
      expect(score).toBeGreaterThanOrEqual(40);
    });

    it("topic with missing exam questions gets recommendation contribution", () => {
      const flags = { missingLesson: false, lowFlashcards: false, lowQuizzes: false, lowExamQuestions: true, highIssueRate: false, unresolvedMappings: false };
      const score = computePriorityScore(flags, 30);
      expect(score).toBeGreaterThan(0);
    });

    it("high open issues adds to priority", () => {
      const flags = { missingLesson: false, lowFlashcards: false, lowQuizzes: false, lowExamQuestions: false, highIssueRate: true, unresolvedMappings: false };
      const score = computePriorityScore(flags, 50);
      expect(score).toBeGreaterThan(0);
    });

    it("weak coverage score adds bonus", () => {
      const flags = { missingLesson: false, lowFlashcards: true, lowQuizzes: false, lowExamQuestions: false, highIssueRate: false, unresolvedMappings: false };
      const score = computePriorityScore(flags, 35);
      expect(score).toBeGreaterThan(15);
    });
  });

  describe("buildGapRecommendations", () => {
    it("no duplicate recommendations", () => {
      const gap = {
        gapFlags: { missingLesson: true, lowFlashcards: true, lowQuizzes: false, lowExamQuestions: false, highIssueRate: false, unresolvedMappings: false },
        counts: {},
      };
      const recs = buildGapRecommendations(gap);
      const set = new Set(recs);
      expect(recs.length).toBe(set.size);
    });

    it("high open issues triggers review_content style recommendation", () => {
      const gap = {
        gapFlags: { missingLesson: false, lowFlashcards: false, lowQuizzes: false, lowExamQuestions: false, highIssueRate: true, unresolvedMappings: false },
        counts: {},
      };
      const recs = buildGapRecommendations(gap);
      expect(recs.some((r) => r.toLowerCase().includes("issue"))).toBe(true);
    });

    it("missing lesson gets create lesson recommendation", () => {
      const gap = {
        gapFlags: { missingLesson: true, lowFlashcards: false, lowQuizzes: false, lowExamQuestions: false, highIssueRate: false, unresolvedMappings: false },
        counts: {},
      };
      const recs = buildGapRecommendations(gap);
      expect(recs.some((r) => r.toLowerCase().includes("lesson"))).toBe(true);
    });
  });

  describe("rankTopicGaps", () => {
    it("sorts highest priority first", () => {
      const gaps = [
        { priorityScore: 10, topicKey: "a" },
        { priorityScore: 50, topicKey: "b" },
        { priorityScore: 30, topicKey: "c" },
      ];
      const ranked = rankTopicGaps(gaps);
      expect(ranked[0].priorityScore).toBe(50);
      expect(ranked[1].priorityScore).toBe(30);
      expect(ranked[2].priorityScore).toBe(10);
    });

    it("returns empty array for null/undefined", () => {
      expect(rankTopicGaps(null)).toEqual([]);
      expect(rankTopicGaps(undefined)).toEqual([]);
    });
  });

  describe("generateTopicGapSummary", () => {
    it("produces deterministic summary paragraph", () => {
      const gap = {
        coverageStatus: "partial",
        coverageScore: 50,
        counts: { lessons: 1, flashcards: 3, quizzes: 2, examQuestions: 0, openIssues: 1 },
        recommendations: ["Generate at least 5 flashcards to improve recall coverage."],
      };
      const summary = generateTopicGapSummary(gap);
      expect(typeof summary).toBe("string");
      expect(summary.length).toBeGreaterThan(20);
      expect(summary.toLowerCase()).toContain("partial");
    });

    it("handles weak status", () => {
      const gap = {
        coverageStatus: "weak",
        coverageScore: 0,
        counts: { lessons: 0, flashcards: 0, quizzes: 0, examQuestions: 0, openIssues: 0 },
        recommendations: [],
      };
      const summary = generateTopicGapSummary(gap);
      expect(summary.toLowerCase()).toContain("weak");
    });
  });
});
