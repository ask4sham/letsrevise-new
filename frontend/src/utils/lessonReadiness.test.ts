import {
  countLessonCheckpoints,
  evaluateLessonReadiness,
  pageHasValidCheckpoint,
} from "./lessonReadiness";

describe("evaluateLessonReadiness", () => {
  it("returns minimumPublishable false when no pages", () => {
    const r = evaluateLessonReadiness({ pages: [] });
    expect(r.minimumPublishable).toBe(false);
    expect(r.counts.pages).toBe(0);
  });

  it("returns minimumPublishable false when quiz < 3", () => {
    const r = evaluateLessonReadiness({
      pages: [{ blocks: [{ type: "text", content: "Hello" }] }],
      quiz: { questions: [{ id: "1" }, { id: "2" }] },
      flashcards: Array(10).fill({ id: "f", front: "a", back: "b" }),
      topicKey: "bio-cell",
      reviewedAt: "2025-01-01",
    });
    expect(r.minimumPublishable).toBe(false);
    expect(r.checks.find((c) => c.key === "quiz")?.pass).toBe(false);
  });

  it("returns minimumPublishable false when flashcards < 10", () => {
    const r = evaluateLessonReadiness({
      pages: [{ blocks: [{ type: "text", content: "Hi" }] }],
      quiz: { questions: [{ id: "1" }, { id: "2" }, { id: "3" }] },
      flashcards: Array(5).fill({ id: "f", front: "a", back: "b" }),
      topicKey: "bio-cell",
      reviewedAt: "2025-01-01",
    });
    expect(r.minimumPublishable).toBe(false);
    expect(r.checks.find((c) => c.key === "flashcards")?.pass).toBe(false);
  });

  it("returns minimumPublishable false when not reviewed", () => {
    const r = evaluateLessonReadiness({
      pages: [{ blocks: [{ type: "text", content: "Hi" }] }],
      quiz: { questions: [{ id: "1" }, { id: "2" }, { id: "3" }] },
      flashcards: Array(10).fill({ id: "f", front: "a", back: "b" }),
      topicKey: "bio-cell",
    });
    expect(r.minimumPublishable).toBe(false);
    expect(r.checks.find((c) => c.key === "reviewed")?.pass).toBe(false);
  });

  it("returns minimumPublishable true when all min criteria met", () => {
    const r = evaluateLessonReadiness({
      pages: [{ blocks: [{ type: "text", content: "Content" }] }],
      quiz: { questions: [{ id: "1" }, { id: "2" }, { id: "3" }] },
      flashcards: Array(10).fill({ id: "f", front: "a", back: "b" }),
      topicKey: "bio-cell",
      reviewedAt: "2025-01-01",
    });
    expect(r.minimumPublishable).toBe(true);
    expect(r.classroomReady).toBe(false);
  });

  it("returns classroomReady true when all criteria met", () => {
    const r = evaluateLessonReadiness({
      pages: [
        {
          blocks: [
            { type: "text", content: "Content" },
            { type: "checkpoint", prompt: "Q?", correctAnswer: "A" },
            { type: "misconception", content: "Common mistake" },
            { type: "diagram", content: "![img](x.png)" },
          ],
        },
      ],
      quiz: { questions: [{ id: "1" }, { id: "2" }, { id: "3" }] },
      flashcards: Array(10).fill({ id: "f", front: "a", back: "b" }),
      topicKey: "bio-cell",
      reviewedAt: "2025-01-01",
      practiceQuestionsAttachedCount: 12,
    });
    expect(r.minimumPublishable).toBe(true);
    expect(r.classroomReady).toBe(true);
    expect(r.counts.checkpoints).toBe(1);
    expect(r.counts.misconceptions).toBe(1);
    expect(r.counts.diagrams).toBe(1);
  });

  it("uses revision.flashcards fallback", () => {
    const r = evaluateLessonReadiness({
      pages: [{ blocks: [{ type: "text", content: "Hi" }] }],
      quiz: { questions: [{ id: "1" }, { id: "2" }, { id: "3" }] },
      revision: { flashcards: Array(10).fill({ id: "f", front: "a", back: "b" }) },
      topicKey: "bio-cell",
      reviewedAt: "2025-01-01",
    });
    expect(r.counts.flashcards).toBe(10);
    expect(r.minimumPublishable).toBe(true);
  });

  it("passes topic check when resolvedTopicKey is valid namespaced key", () => {
    const r = evaluateLessonReadiness(
      { pages: [{ blocks: [{ type: "text", content: "Hi" }] }], topicKey: "stale-title-slug-aqa-gcse-biology-higher-tier" },
      { resolvedTopicKey: "aqa-gcse-biology:response-to-exercise" }
    );
    expect(r.checks.find((c) => c.key === "topic")?.pass).toBe(true);
  });

  it("fails topic check when resolvedTopicKey missing and stored slug invalid", () => {
    const r = evaluateLessonReadiness({
      pages: [{ blocks: [{ type: "text", content: "Hi" }] }],
      topicKey: "response-to-exercise-bioenergetics-aqa-gcse-higher-tier",
    });
    expect(r.checks.find((c) => c.key === "topic")?.pass).toBe(false);
  });

  it("counts page.checkpoint when no block checkpoint exists", () => {
    const lesson = {
      pages: [
        {
          blocks: [{ type: "text", content: "Intro" }],
          checkpoint: {
            question: "How is respiration defined?",
            options: ["A", "B", "C", "D"],
            answer: "B",
          },
        },
      ],
    };
    expect(countLessonCheckpoints(lesson)).toBe(1);
    expect(evaluateLessonReadiness(lesson).counts.checkpoints).toBe(1);
  });

  it("does not count selfCheck as checkpoint", () => {
    const lesson = {
      pages: [
        {
          blocks: [
            {
              type: "selfCheck",
              prompt: "Which is correct?",
              questionType: "mcq",
              options: ["A", "B", "C", "D"],
              correctAnswer: "A",
            },
          ],
        },
      ],
    };
    expect(countLessonCheckpoints(lesson)).toBe(0);
  });

  it("counts at most one checkpoint per page when block and page.checkpoint both exist", () => {
    const page = {
      blocks: [{ type: "checkpoint", prompt: "Block Q?", correctAnswer: "A" }],
      checkpoint: {
        question: "Page Q?",
        options: ["1", "2", "3", "4"],
        answer: "2",
      },
    };
    expect(pageHasValidCheckpoint(page)).toBe(true);
    expect(countLessonCheckpoints({ pages: [page] })).toBe(1);
  });

  it("counts practiceAttached from readiness.signals.practiceCount", () => {
    const r = evaluateLessonReadiness({
      pages: [{ blocks: [{ type: "text", content: "Hi" }] }],
      quiz: { questions: [{ id: "1" }, { id: "2" }, { id: "3" }] },
      flashcards: Array(10).fill({ id: "f", front: "a", back: "b" }),
      topicKey: "bio-cell",
      reviewedAt: "2025-01-01",
      readiness: { signals: { practiceCount: 15 } },
    });
    expect(r.counts.practiceAttached).toBe(15);
  });
});
