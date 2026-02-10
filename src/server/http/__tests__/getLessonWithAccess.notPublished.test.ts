import { getLessonWithAccess } from "../getLessonWithAccess";

describe("getLessonWithAccess – unpublished lesson", () => {
  const lessonId = "L_UNPUBLISHED";

  const getLessonMeta = async () => ({
    lessonId,
    isPublished: false,
    isFreePreview: false,
  });

  const getLessonPayload = async () => ({
    lessonId,
    slots: [{ id: "s1", content: "SHOULD_NOT_BE_RETURNED" }],
  });

  test("denies access when lesson is not published", async () => {
    const result = await getLessonWithAccess({
      lessonId,
      user: {
        userId: "U1",
        subscriptionActive: true,
        purchasedLessons: [lessonId],
      },
      getLessonMeta,
      getLessonPayload,
    });

    expect(result).toEqual({
      ok: false,
      error: "NOT_PUBLISHED",
    });
  });
});
