/**
 * Unit tests for canAccessContent (Phase 9 — backend content access policy).
 * Run from repo root: npx jest backend/tests/canAccessContent.test.js --testPathIgnorePatterns=''
 */
jest.mock("../models/LessonUnlock", () => ({
  exists: jest.fn().mockResolvedValue(false),
}));

const { canAccessContent } = require("../utils/canAccessContent");
const LessonUnlock = require("../models/LessonUnlock");

describe("canAccessContent", () => {
  const lesson = {
    id: "lesson-1",
    _id: "lesson-1",
    isFreePreview: false,
    isPublished: true,
  };

  test("unauthenticated → deny (UNAUTHENTICATED)", async () => {
    const decision = await canAccessContent(null, lesson);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("UNAUTHENTICATED");
  });

  test("undefined user → deny (UNAUTHENTICATED)", async () => {
    const decision = await canAccessContent(undefined, lesson);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("UNAUTHENTICATED");
  });

  test("admin → allow (ADMIN)", async () => {
    const decision = await canAccessContent(
      { userType: "admin", subscriptionV2: null, purchasedLessons: [] },
      lesson
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("ADMIN");
  });

  test("admin via role → allow (ADMIN)", async () => {
    const decision = await canAccessContent(
      { role: "admin", subscription: null },
      lesson
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("ADMIN");
  });

  test("active subscription (expiresAt future) → allow (SUB_ACTIVE)", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const decision = await canAccessContent(
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

  test("stripe letsrevise pro (paidThrough future) → allow (STRIPE_LETSREVISE_PRO)", async () => {
    const decision = await canAccessContent(
      {
        userType: "student",
        subscriptionV2: null,
        stripeBilling: {
          planId: "letsrevise_pro",
          paidThrough: new Date(Date.now() + 86400000),
          status: "active",
        },
        purchasedLessons: [],
      },
      { ...lesson, subject: "Biology" }
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("STRIPE_LETSREVISE_PRO");
  });

  test("stripe letsrevise pro unlocks physics (universal premium)", async () => {
    const decision = await canAccessContent(
      {
        userType: "student",
        stripeBilling: {
          planId: "letsrevise_pro",
          status: "active",
          paidThrough: new Date(Date.now() + 86400000),
        },
        purchasedLessons: [],
      },
      { ...lesson, subject: "Physics" }
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("STRIPE_LETSREVISE_PRO");
  });

  test("stripe letsrevise pro unpaid → deny", async () => {
    const decision = await canAccessContent(
      {
        userType: "student",
        stripeBilling: {
          planId: "letsrevise_pro",
          status: "incomplete",
        },
        purchasedLessons: [],
      },
      { ...lesson, subject: "Biology" }
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NOT_ENTITLED");
  });

  test("admin grant survives alongside canceled stripe billing", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const decision = await canAccessContent(
      {
        userType: "student",
        subscriptionV2: { status: "trialing", provider: "admin", expiresAt: future },
        stripeBilling: {
          planId: "letsrevise_pro",
          status: "canceled",
          paidThrough: new Date(Date.now() - 1000),
        },
        purchasedLessons: [],
      },
      { ...lesson, subject: "Biology" }
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("SUB_ACTIVE");
  });

  test("single-lesson unlock (no sub, no purchase) → allow (LESSON_UNLOCK)", async () => {
    LessonUnlock.exists.mockResolvedValueOnce(true);
    const decision = await canAccessContent(
      {
        _id: "user-1",
        userType: "student",
        subscriptionV2: null,
        purchasedLessons: [],
      },
      lesson
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("LESSON_UNLOCK");
  });

  test("purchased lesson → allow (PURCHASED)", async () => {
    const decision = await canAccessContent(
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

  test("purchased lesson (raw id in array) → allow (PURCHASED)", async () => {
    const decision = await canAccessContent(
      {
        userType: "student",
        purchasedLessons: ["lesson-1"],
      },
      lesson
    );
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("PURCHASED");
  });

  test("free preview (no sub/unlock) -> not allowed but FREE_PREVIEW", async () => {
    LessonUnlock.exists.mockResolvedValueOnce(false);

    const user = { _id: "64b000000000000000000001", subscriptionV2: null };
    const lessonWithPreview = { _id: "64b000000000000000000002", isFreePreview: true, isPublished: true };

    const decision = await canAccessContent(user, lessonWithPreview);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("FREE_PREVIEW");
  });

  test("none (no sub, no purchase, no preview) → deny (NOT_ENTITLED)", async () => {
    const decision = await canAccessContent(
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

  test("lesson not published → deny (NOT_PUBLISHED)", async () => {
    const decision = await canAccessContent(
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

  test("Phase 9D: lesson.status draft → deny (NOT_PUBLISHED)", async () => {
    const decision = await canAccessContent(
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

  test("Phase 9D: lesson.status in_review → deny (NOT_PUBLISHED)", async () => {
    const decision = await canAccessContent(
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

  test("Phase 9D: lesson.status published → allow when entitled", async () => {
    const decision = await canAccessContent(
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

  test("legacy call style { user, lesson } works", async () => {
    const user = {
      userType: "student",
      purchasedLessons: ["lesson-1"],
    };
    const decision = await canAccessContent({ user, lesson });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("PURCHASED");
  });
});
