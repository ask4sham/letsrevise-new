import {
  lessonPersistPutPath,
  shouldUseTeacherLessonPutForPersistPayload,
} from "./lessonSaveRoute";

describe("lessonSaveRoute", () => {
  const lessonId = "6a9198c765e15e080aee9ad9";

  test("payload with quiz uses teacher PUT even for admin", () => {
    const payload = {
      title: "Mutation",
      quiz: { timeSeconds: 600, questions: [{ id: "quiz1", question: "Q?" }] },
    };
    expect(shouldUseTeacherLessonPutForPersistPayload(payload)).toBe(true);
    expect(lessonPersistPutPath(lessonId, payload, true)).toBe(`/lessons/${lessonId}`);
    expect(lessonPersistPutPath(lessonId, payload, false)).toBe(`/lessons/${lessonId}`);
  });

  test("payload without quiz may use admin PUT for admin users", () => {
    const payload = { title: "Mutation only" };
    expect(shouldUseTeacherLessonPutForPersistPayload(payload)).toBe(false);
    expect(lessonPersistPutPath(lessonId, payload, true)).toBe(`/admin/lessons/${lessonId}`);
    expect(lessonPersistPutPath(lessonId, payload, false)).toBe(`/lessons/${lessonId}`);
  });
});
