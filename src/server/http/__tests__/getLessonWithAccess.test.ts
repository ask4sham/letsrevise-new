import { getLessonWithAccess } from "../getLessonWithAccess";

describe("getLessonWithAccess", () => {
  const lessonId = "L1";

  const getLessonMeta = async () => ({
    lessonId,
    isFreePreview: false,
  });

  const getLessonPayload = async () => ({
    lessonId,
    slots: [{ id: "s1", content: "FULL_CONTENT" }],
  });

  test("denies when user is not authenticated", async () => {
    const result = await getLessonWithAccess({
      lessonId,
      user: null,
      getLessonMeta,
      getLessonPayload,
    });

    expect(result).toEqual({
      ok: false,
      error: "NOT_AUTHENTICATED",
    });
  });

  test("returns full content for active subscription", async () => {
    const result = await getLessonWithAccess({
      lessonId,
      user: {
        userId: "U1",
        subscriptionActive: true,
        purchasedLessons: [],
      },
      getLessonMeta,
      getLessonPayload,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mode).toBe("full");
      expect(result.data.slots[0].content).toBe("FULL_CONTENT");
    }
  });

  test("returns preview content when free preview", async () => {
    const result = await getLessonWithAccess({
      lessonId,
      user: {
        userId: "U1",
        subscriptionActive: false,
        purchasedLessons: [],
      },
      getLessonMeta: async () => ({ lessonId, isFreePreview: true }),
      getLessonPayload,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mode).toBe("preview");
      expect(result.data.metadata.preview).toBe(true);
    }
  });
});
