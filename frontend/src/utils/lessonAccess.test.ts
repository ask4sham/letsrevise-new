import { hasFullLessonAccess } from "./lessonAccess";

describe("hasFullLessonAccess", () => {
  it("allowed=true → hasFullLessonAccess true", () => {
    expect(hasFullLessonAccess({ allowed: true, reason: "SUB_ACTIVE" }, null)).toBe(true);
    expect(hasFullLessonAccess({ allowed: true, reason: "OWNER" }, { userType: "student" })).toBe(true);
    expect(hasFullLessonAccess({ allowed: true, reason: "ADMIN_PASS" }, null)).toBe(true);
    expect(hasFullLessonAccess({ allowed: true, reason: "PURCHASED" }, null)).toBe(true);
  });

  it("FREE_PREVIEW + allowed=false → false", () => {
    expect(hasFullLessonAccess({ allowed: false, reason: "FREE_PREVIEW" }, null)).toBe(false);
    expect(hasFullLessonAccess({ allowed: false, reason: "FREE_PREVIEW" }, { userType: "student" })).toBe(false);
  });

  it("teacher/admin → true (fallback)", () => {
    expect(hasFullLessonAccess(null, { userType: "teacher" })).toBe(true);
    expect(hasFullLessonAccess(null, { userType: "admin" })).toBe(true);
    expect(hasFullLessonAccess({ allowed: false, reason: "FREE_PREVIEW" }, { userType: "admin" })).toBe(true);
    expect(hasFullLessonAccess(undefined, { isAdmin: true })).toBe(true);
  });

  it("adminPassActive true → true (fallback)", () => {
    expect(hasFullLessonAccess(null, { userType: "student", adminPassActive: true })).toBe(true);
    expect(hasFullLessonAccess({ allowed: false, reason: "FREE_PREVIEW" }, { adminPassActive: true })).toBe(true);
  });

  it("subscriptionActive true → true (fallback)", () => {
    expect(hasFullLessonAccess(null, { subscriptionActive: true })).toBe(true);
  });

  it("no access when allowed false and no fallbacks", () => {
    expect(hasFullLessonAccess({ allowed: false, reason: "NOT_ENTITLED" }, { userType: "student" })).toBe(false);
    expect(hasFullLessonAccess(null, { userType: "student" })).toBe(false);
  });
});
