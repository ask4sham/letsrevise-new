/**
 * Frontend compatibility for slim /users/me DTO + auth storage.
 */
import { isEmailVerified } from "../emailVerification";
import { clearAuth, readAuth, setAuth, updateUser } from "../authStorage";

/** Mirrors EmailVerificationBanner.mergeMeIntoStoredUser (keep in sync). */
function mergeMeIntoStoredUser(data: Record<string, unknown>) {
  const id = String(
    (data._id as { toString?: () => string })?.toString?.() ?? data.id ?? ""
  );
  return {
    ...data,
    id: id || data.id,
    verificationStatus: data.verificationStatus,
    emailVerified:
      typeof data.emailVerified === "boolean"
        ? data.emailVerified
        : String(data.verificationStatus || "").toLowerCase() === "verified",
  };
}

describe("slim current-user DTO frontend compatibility", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const slimMe = {
    id: "507f1f77bcf86cd799439011",
    _id: "507f1f77bcf86cd799439011",
    email: "student@example.com",
    firstName: "Sam",
    lastName: "Student",
    userType: "student",
    staffRole: null,
    verificationStatus: "pending",
    emailVerified: false,
    schoolName: null,
    institution: null,
    yearGroup: 11,
    stageKey: "gcse",
    referralCode: null,
    subscription: "free",
    subscriptionEndDate: null,
  };

  test("mergeMeIntoStoredUser preserves dual ids and verification flags", () => {
    const merged = mergeMeIntoStoredUser(slimMe as unknown as Record<string, unknown>) as Record<
      string,
      unknown
    >;
    expect(merged.id).toBe(slimMe.id);
    expect(merged._id).toBe(slimMe._id);
    expect(merged.emailVerified).toBe(false);
    expect(merged.verificationStatus).toBe("pending");
    expect(isEmailVerified(merged as any)).toBe(false);
  });

  test("verified slim DTO enables isEmailVerified", () => {
    const merged = mergeMeIntoStoredUser({
      ...slimMe,
      verificationStatus: "verified",
      emailVerified: true,
    } as unknown as Record<string, unknown>);
    expect(isEmailVerified(merged as any)).toBe(true);
  });

  test("authStorage setAuth / updateUser / clearAuth round-trip", () => {
    setAuth("tok-1", slimMe);
    expect(readAuth().token).toBe("tok-1");
    expect((readAuth().user as any).userType).toBe("student");

    updateUser({
      ...slimMe,
      verificationStatus: "verified",
      emailVerified: true,
      firstName: "Samantha",
    });
    expect((readAuth().user as any).firstName).toBe("Samantha");
    expect((readAuth().user as any).emailVerified).toBe(true);

    clearAuth();
    expect(readAuth()).toEqual({ token: null, user: null });
  });

  test("role and staffRole fields remain available for routing", () => {
    const teacher = {
      ...slimMe,
      userType: "teacher",
      staffRole: "content_manager",
      firstName: "Chris",
    };
    setAuth("tok-2", teacher);
    const user = readAuth().user as any;
    expect(user.userType).toBe("teacher");
    expect(user.staffRole).toBe("content_manager");
    expect(`${user.firstName} ${user.lastName}`.trim().length).toBeGreaterThan(0);
  });

  test("subscriptionV2 safe subset supports gating helpers", () => {
    const withSub = {
      ...slimMe,
      subscriptionV2: {
        plan: "monthly",
        status: "active",
        expiresAt: "2026-06-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      },
    };
    expect(withSub.subscriptionV2).not.toHaveProperty("provider");
    expect(withSub.subscriptionV2).not.toHaveProperty("planId");
    expect(withSub.subscriptionV2.status).toBe("active");
  });

  test("purchasedLessons id shape supports fallback checks", () => {
    const profile = {
      ...slimMe,
      earnings: 12.5,
      purchasedLessons: [
        { lessonId: "aaaaaaaaaaaaaaaaaaaaaaaa", purchasedAt: "2026-02-15T00:00:00.000Z" },
      ],
    };
    const lessonId = "aaaaaaaaaaaaaaaaaaaaaaaa";
    const has = profile.purchasedLessons.some(
      (p) => String(p.lessonId) === String(lessonId)
    );
    expect(has).toBe(true);
    expect(profile.purchasedLessons[0]).not.toHaveProperty("price");
  });
});
