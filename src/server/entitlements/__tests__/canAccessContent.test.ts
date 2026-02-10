import { canAccessContent } from "../canAccessContent";

describe("canAccessContent", () => {
  const lesson = { lessonId: "L1", isFreePreview: false };

  test("denies when not authenticated", () => {
    expect(canAccessContent(null, lesson)).toEqual({
      allow: false,
      reason: "NOT_AUTHENTICATED",
    });
  });

  test("allows full access for active subscription", () => {
    const user = {
      userId: "U1",
      subscriptionActive: true,
      purchasedLessons: [],
    };
    expect(canAccessContent(user, lesson)).toEqual({
      allow: true,
      mode: "full",
    });
  });

  test("allows full access for purchased lesson", () => {
    const user = {
      userId: "U1",
      subscriptionActive: false,
      purchasedLessons: ["L1"],
    };
    expect(canAccessContent(user, lesson)).toEqual({
      allow: true,
      mode: "full",
    });
  });

  test("allows preview when lesson is free preview", () => {
    const user = {
      userId: "U1",
      subscriptionActive: false,
      purchasedLessons: [],
    };
    expect(
      canAccessContent(user, { lessonId: "L1", isFreePreview: true })
    ).toEqual({
      allow: true,
      mode: "preview",
    });
  });

  test("denies when no entitlement and no preview", () => {
    const user = {
      userId: "U1",
      subscriptionActive: false,
      purchasedLessons: [],
    };
    expect(canAccessContent(user, lesson)).toEqual({
      allow: false,
      reason: "NOT_ENTITLED",
    });
  });
});
