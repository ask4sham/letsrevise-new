/**
 * @jest-environment jsdom
 */
import {
  collectRevisionQuizSessionExclusions,
  revisionQuizSetSignature,
} from "./revisionQuizFreshExclusions";
import {
  buildRevisionQuizCompletionKey,
  buildRevisionQuizCompletionPayload,
  getRevisionQuizCompleted,
  getRevisionQuizCompletion,
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

  test("persists scored JSON and clears completion for scoped key", () => {
    const scope = revisionCompletionScopeFromQuestions({
      studentId: "stu1",
      lessonId: "les1",
      pageId: "p1",
      questions,
    });
    expect(scope).not.toBeNull();
    expect(getRevisionQuizCompleted(scope!)).toBe(false);
    const payload = buildRevisionQuizCompletionPayload({
      score: 4,
      questionCount: 4,
      setSignature: scope!.setSignature,
    });
    setRevisionQuizCompleted(scope!, payload);
    expect(getRevisionQuizCompleted(scope!)).toBe(true);
    const stored = getRevisionQuizCompletion(scope!);
    expect(stored?.score).toBe(4);
    expect(stored?.questionCount).toBe(4);
    expect(stored?.version).toBe(1);
    const raw = localStorage.getItem(buildRevisionQuizCompletionKey(scope!));
    expect(raw).toContain('"score":4');
    expect(raw).not.toBe("1");
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
    setRevisionQuizCompleted(
      scope!,
      buildRevisionQuizCompletionPayload({
        score: 2,
        questionCount: 4,
        setSignature: scope!.setSignature,
      })
    );
    const key = buildRevisionQuizCompletionKey(scope!);
    expect(key).toContain(encodeURIComponent("login-user-1"));
    expect(getRevisionQuizCompletion(scope!)?.score).toBe(2);
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
    setRevisionQuizCompleted(
      scope!,
      buildRevisionQuizCompletionPayload({
        score: 3,
        questionCount: 4,
        setSignature: scope!.setSignature,
      })
    );
    expect(getRevisionQuizCompletion(scope!)?.score).toBe(3);
  });

  test("legacy \"1\" restores completed with unknown score", () => {
    const scope = revisionCompletionScopeFromQuestions({
      studentId: "stu1",
      lessonId: "les1",
      pageId: "END",
      questions,
    })!;
    localStorage.setItem(buildRevisionQuizCompletionKey(scope), "1");
    const stored = getRevisionQuizCompletion(scope, 4);
    expect(stored?.completed).toBe(true);
    expect(stored?.score).toBeNull();
    expect(stored?.questionCount).toBe(4);
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
        buildRevisionQuizCompletionPayload({
          score: 1,
          questionCount: 1,
          setSignature: "rq_x_1",
        })
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
    setRevisionQuizCompleted(
      a,
      buildRevisionQuizCompletionPayload({ score: 4, questionCount: 4, setSignature: a.setSignature })
    );
    setRevisionQuizCompleted(
      b,
      buildRevisionQuizCompletionPayload({ score: 2, questionCount: 4, setSignature: b.setSignature })
    );
    setRevisionQuizCompleted(a, false);
    expect(getRevisionQuizCompleted(a)).toBe(false);
    expect(getRevisionQuizCompletion(b)?.score).toBe(2);
  });
});
