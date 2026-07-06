import {
  embeddedExamQuestionIdsKey,
  isSameLessonRouteRefresh,
  lessonMatchesRoute,
  shouldClearEmbeddedExamCache,
} from "./lessonViewEmbeddedExamLifecycle";

describe("lessonViewEmbeddedExamLifecycle", () => {
  test("embeddedExamQuestionIdsKey is order-independent", () => {
    expect(embeddedExamQuestionIdsKey(["b", "a"])).toBe("a|b");
    expect(embeddedExamQuestionIdsKey(["a", "b"])).toBe("a|b");
  });

  test("isSameLessonRouteRefresh", () => {
    expect(isSameLessonRouteRefresh("abc", "abc")).toBe(true);
    expect(isSameLessonRouteRefresh("abc", "def")).toBe(false);
    expect(isSameLessonRouteRefresh(undefined, "abc")).toBe(false);
    expect(isSameLessonRouteRefresh("abc", null)).toBe(false);
  });

  test("lessonMatchesRoute", () => {
    expect(lessonMatchesRoute("1", { id: "1" })).toBe(true);
    expect(lessonMatchesRoute("1", { id: "2" })).toBe(false);
    expect(lessonMatchesRoute("1", null)).toBe(false);
  });

  test("shouldClearEmbeddedExamCache when route id missing", () => {
    expect(
      shouldClearEmbeddedExamCache({
        routeLessonId: undefined,
        previousExamIdsKey: "a",
        nextExamIds: ["a"],
      })
    ).toBe(true);
  });

  test("shouldClearEmbeddedExamCache when exam ids change", () => {
    expect(
      shouldClearEmbeddedExamCache({
        routeLessonId: "lesson-1",
        previousExamIdsKey: "a|b",
        nextExamIds: ["a", "c"],
      })
    ).toBe(true);
  });

  test("should not clear when exam ids unchanged", () => {
    expect(
      shouldClearEmbeddedExamCache({
        routeLessonId: "lesson-1",
        previousExamIdsKey: "a|b",
        nextExamIds: ["b", "a"],
      })
    ).toBe(false);
  });

  test("should not clear on first population", () => {
    expect(
      shouldClearEmbeddedExamCache({
        routeLessonId: "lesson-1",
        previousExamIdsKey: "",
        nextExamIds: ["a"],
      })
    ).toBe(false);
  });

  test("should clear when embedded ids removed from lesson", () => {
    expect(
      shouldClearEmbeddedExamCache({
        routeLessonId: "lesson-1",
        previousExamIdsKey: "a",
        nextExamIds: [],
      })
    ).toBe(true);
  });
});
