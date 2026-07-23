/**
 * @jest-environment jsdom
 */
import {
  collectRevisionQuizSessionExclusions,
  revisionQuizSetSignature,
} from "./revisionQuizFreshExclusions";
import {
  buildRevisionQuizCompletionKey,
  getRevisionQuizCompleted,
  setRevisionQuizCompleted,
  revisionCompletionScopeFromQuestions,
} from "./revisionQuizCompletion";

describe("revisionQuizFreshExclusions", () => {
  const oid = "507f1f77bcf86cd799439011";

  test("maps sourceQuestionId to content keys and keeps stem texts", () => {
    const out = collectRevisionQuizSessionExclusions([
      {
        id: "rev-bank-0",
        question: "How does sexual reproduction produce variation in offspring?",
        sourceQuestionId: oid,
        sourceType: "quiz_mcq",
      },
      {
        id: "derived-1",
        question: "A short stem",
      },
    ]);
    expect(out.contentKeys).toContain(`quiz_mcq:${oid}`);
    expect(out.contentKeys.some((k) => k.includes("rev-bank"))).toBe(false);
    expect(out.contentKeys.some((k) => k.includes("derived"))).toBe(false);
    expect(out.stemTexts.some((s) => /sexual reproduction/i.test(s))).toBe(true);
  });

  test("ignores unsafe display ids as bank content ids", () => {
    const out = collectRevisionQuizSessionExclusions([
      { id: "rev-bank-3", question: "Enough characters for a stem fingerprint here" },
      { id: "variant-9", question: "Another long enough revision question stem text" },
    ]);
    expect(out.contentKeys).toEqual([]);
    expect(out.stemTexts.length).toBe(2);
  });

  test("set signature is stable for same questions", () => {
    const qs = [
      { id: "a", question: "Stem one about mitosis and meiosis comparison" },
      { id: "b", sourceQuestionId: oid, question: "Stem two about fertilisation process" },
    ];
    expect(revisionQuizSetSignature(qs)).toBe(revisionQuizSetSignature([...qs].reverse()));
  });
});

describe("revisionQuizCompletion", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("persists and clears completion for scoped key", () => {
    const scope = revisionCompletionScopeFromQuestions({
      studentId: "stu1",
      lessonId: "les1",
      pageId: "p1",
      questions: [{ question: "A sufficiently long revision stem for signature" }],
    });
    expect(scope).not.toBeNull();
    expect(getRevisionQuizCompleted(scope!)).toBe(false);
    setRevisionQuizCompleted(scope!, true);
    expect(getRevisionQuizCompleted(scope!)).toBe(true);
    expect(buildRevisionQuizCompletionKey(scope!)).toContain("revision-quiz-complete:");
    setRevisionQuizCompleted(scope!, false);
    expect(getRevisionQuizCompleted(scope!)).toBe(false);
  });
});
