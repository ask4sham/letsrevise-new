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
  resolveAuthUserId,
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

describe("resolveAuthUserId", () => {
  test("prefers _id when both exist", () => {
    expect(resolveAuthUserId({ _id: "mongo1", id: "legacy2" })).toBe("mongo1");
  });

  test("uses id when _id is absent", () => {
    expect(resolveAuthUserId({ id: "stu-from-login" })).toBe("stu-from-login");
  });

  test("uses _id when id is absent", () => {
    expect(resolveAuthUserId({ _id: "stu-from-me" })).toBe("stu-from-me");
  });

  test("returns undefined when neither is present", () => {
    expect(resolveAuthUserId({})).toBeUndefined();
    expect(resolveAuthUserId(null)).toBeUndefined();
    expect(resolveAuthUserId({ id: "  " })).toBeUndefined();
  });
});

describe("revisionQuizCompletion", () => {
  const questions = [{ question: "A sufficiently long revision stem for signature" }];

  beforeEach(() => {
    localStorage.clear();
  });

  test("persists and clears completion for scoped key", () => {
    const scope = revisionCompletionScopeFromQuestions({
      studentId: "stu1",
      lessonId: "les1",
      pageId: "p1",
      questions,
    });
    expect(scope).not.toBeNull();
    expect(getRevisionQuizCompleted(scope!)).toBe(false);
    setRevisionQuizCompleted(scope!, true);
    expect(getRevisionQuizCompleted(scope!)).toBe(true);
    expect(buildRevisionQuizCompletionKey(scope!)).toContain("revision-quiz-complete:");
    setRevisionQuizCompleted(scope!, false);
    expect(getRevisionQuizCompleted(scope!)).toBe(false);
  });

  test("id-only student creates valid scope and write/read key match", () => {
    const studentId = resolveAuthUserId({ id: "login-user-1" });
    const scope = revisionCompletionScopeFromQuestions({
      studentId,
      lessonId: "les1",
      pageId: "END",
      questions,
    });
    expect(scope?.studentId).toBe("login-user-1");
    setRevisionQuizCompleted(scope!, true);
    const key = buildRevisionQuizCompletionKey(scope!);
    expect(key).toContain(encodeURIComponent("login-user-1"));
    expect(localStorage.getItem(key)).toBe("1");
    expect(getRevisionQuizCompleted(scope!)).toBe(true);
  });

  test("_id-only student still works", () => {
    const studentId = resolveAuthUserId({ _id: "mongo-user-1" });
    const scope = revisionCompletionScopeFromQuestions({
      studentId,
      lessonId: "les1",
      pageId: "END",
      questions,
    });
    expect(scope?.studentId).toBe("mongo-user-1");
    setRevisionQuizCompleted(scope!, true);
    expect(getRevisionQuizCompleted(scope!)).toBe(true);
  });

  test("missing student id yields null scope and no write", () => {
    const scope = revisionCompletionScopeFromQuestions({
      studentId: resolveAuthUserId({}),
      lessonId: "les1",
      pageId: "END",
      questions,
    });
    expect(scope).toBeNull();
    expect(() =>
      setRevisionQuizCompleted(
        {
          studentId: "",
          lessonId: "les1",
          pageId: "END",
          setSignature: "rq_x_1",
        },
        true
      )
    ).not.toThrow();
    expect(Object.keys(localStorage).filter((k) => k.includes("revision-quiz-complete"))).toEqual([]);
  });

  test("retry clears only the matching student/lesson key", () => {
    const a = revisionCompletionScopeFromQuestions({
      studentId: "stuA",
      lessonId: "les1",
      pageId: "END",
      questions,
    })!;
    const b = revisionCompletionScopeFromQuestions({
      studentId: "stuB",
      lessonId: "les1",
      pageId: "END",
      questions,
    })!;
    setRevisionQuizCompleted(a, true);
    setRevisionQuizCompleted(b, true);
    setRevisionQuizCompleted(a, false);
    expect(getRevisionQuizCompleted(a)).toBe(false);
    expect(getRevisionQuizCompleted(b)).toBe(true);
  });
});
