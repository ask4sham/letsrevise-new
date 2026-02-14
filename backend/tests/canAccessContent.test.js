/**
 * Unit tests for canAccessContent (Phase 9 — backend content access policy).
 * Run from repo root: npx jest backend/tests/canAccessContent.test.js --testPathIgnorePatterns=''
 */
const { canAccessContent } = require("../utils/canAccessContent");

describe("canAccessContent", () => {
  const lesson = {
    id: "lesson-1",
    _id: "lesson-1",
    isFreePreview: false,
    isPublished: true,
  };

  test("unauthenticated → deny (UNAUTHENTICATED)", () => {
    const decision = canAccessContent(null, lesson);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("UNAUTHENTICATED");
  });

  test("undefined user → deny (UNAUTHENTICATED)", () => {
    const decision = canAccessContent(undefined, lesson);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("UNAUTHENTICATED");
  });

  test("admin → allow (ADMIN)", () => {
    const decision = canAccessContent(
      { userType: "admin", subscriptionV2: null, purchasedLessons: [] },
      lesson
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("ADMIN");
  });

  test("admin via role → allow (ADMIN)", () => {
    const decision = canAccessContent(
      { role: "admin", subscription: null },
      lesson
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("ADMIN");
  });

  test("active subscription (expiresAt future) → allow (SUB_ACTIVE)", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const decision = canAccessContent(
      {
        userType: "student",
        subscriptionV2: { status: "active", expiresAt: future },
        purchasedLessons: [],
      },
      lesson
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("SUB_ACTIVE");
  });

  test("purchased lesson → allow (PURCHASED)", () => {
    const decision = canAccessContent(
      {
        userType: "student",
        subscriptionV2: null,
        purchasedLessons: [{ lessonId: "lesson-1" }],
      },
      { ...lesson, isFreePreview: false }
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("PURCHASED");
  });

  test("purchased lesson (raw id in array) → allow (PURCHASED)", () => {
    const decision = canAccessContent(
      {
        userType: "student",
        purchasedLessons: ["lesson-1"],
      },
      lesson
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("PURCHASED");
  });

  test("free preview only → allow (FREE_PREVIEW)", () => {
    const decision = canAccessContent(
      {
        userType: "student",
        subscriptionV2: null,
        purchasedLessons: [],
      },
      { ...lesson, isFreePreview: true }
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("FREE_PREVIEW");
  });

  test("none (no sub, no purchase, no preview) → deny (NOT_ENTITLED)", () => {
    const decision = canAccessContent(
      {
        userType: "student",
        subscriptionV2: null,
        purchasedLessons: [],
      },
      lesson
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NOT_ENTITLED");
  });

  test("lesson not published → deny (NOT_PUBLISHED)", () => {
    const decision = canAccessContent(
      {
        userType: "student",
        subscriptionV2: { expiresAt: new Date(Date.now() + 86400000).toISOString() },
        purchasedLessons: [],
      },
      { ...lesson, isPublished: false }
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NOT_PUBLISHED");
  });

  test("Phase 9D: lesson.status draft → deny (NOT_PUBLISHED)", () => {
    const decision = canAccessContent(
      {
        userType: "student",
        subscriptionV2: { status: "active", expiresAt: new Date(Date.now() + 86400000).toISOString() },
        purchasedLessons: [],
      },
      { ...lesson, status: "draft", isPublished: false }
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NOT_PUBLISHED");
  });

  test("Phase 9D: lesson.status in_review → deny (NOT_PUBLISHED)", () => {
    const decision = canAccessContent(
      {
        userType: "student",
        subscriptionV2: { status: "active", expiresAt: new Date(Date.now() + 86400000).toISOString() },
        purchasedLessons: [],
      },
      { ...lesson, status: "in_review", isPublished: false }
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NOT_PUBLISHED");
  });

  test("Phase 9D: lesson.status published → allow when entitled", () => {
    const decision = canAccessContent(
      {
        userType: "student",
        subscriptionV2: { status: "active", expiresAt: new Date(Date.now() + 86400000).toISOString() },
        purchasedLessons: [],
      },
      { ...lesson, status: "published", isPublished: true }
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("SUB_ACTIVE");
  });

  test("legacy call style { user, lesson } works", () => {
    const user = {
      userType: "student",
      purchasedLessons: ["lesson-1"],
    };
    const decision = canAccessContent({ user, lesson });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("PURCHASED");
  });
});
