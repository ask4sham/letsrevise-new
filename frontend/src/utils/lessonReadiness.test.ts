import { evaluateLessonReadiness } from "./lessonReadiness";

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
