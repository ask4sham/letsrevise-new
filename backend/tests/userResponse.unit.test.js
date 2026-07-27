/**
 * Unit: allowlisted current-user / self-profile DTOs.
 * Never logs field values for secrets — asserts key absence only.
 */
const mongoose = require("mongoose");
const {
  toCurrentUserDto,
  toSelfProfileDto,
  toPurchasedLessonsDto,
  toSafeSubscriptionV2,
} = require("../utils/userResponse");

const FORBIDDEN_KEYS = [
  "password",
  "__v",
  "emailVerificationToken",
  "emailVerificationExpires",
  "passwordResetToken",
  "passwordResetExpires",
  "emailChangeToken",
  "emailChangeExpires",
  "pendingNewEmail",
  "verificationEmailLastSentAt",
  "isDeleted",
  "deletedAt",
  "deletedBy",
  "deleteReason",
  "balance",
  "totalWithdrawn",
  "transactions",
  "children",
  "referredBy",
  "trialUsed",
];

function assertNoForbiddenKeys(obj, path = "") {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    const here = path ? `${path}.${key}` : key;
    expect(FORBIDDEN_KEYS).not.toContain(key);
    if (key === "subscriptionV2" && obj[key] && typeof obj[key] === "object") {
      expect(obj[key]).not.toHaveProperty("provider");
      expect(obj[key]).not.toHaveProperty("planId");
    }
    if (key !== "purchasedLessons" && obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      assertNoForbiddenKeys(obj[key], here);
    }
  }
}

describe("userResponse DTOs", () => {
  const oid = new mongoose.Types.ObjectId();
  const lessonOid = new mongoose.Types.ObjectId();

  const seeded = {
    _id: oid,
    email: "dto-user@test.com",
    password: "SENTINEL_PASSWORD_HASH",
    userType: "student",
    staffRole: null,
    firstName: "Ada",
    lastName: "Lovelace",
    schoolName: "Test School",
    institution: "Test Institution",
    verificationStatus: "verified",
    emailVerificationToken: "SENTINEL_EMAIL_VERIFY_TOKEN",
    emailVerificationExpires: new Date("2030-01-01"),
    verificationEmailLastSentAt: new Date("2026-01-01"),
    passwordResetToken: "SENTINEL_PASSWORD_RESET_TOKEN",
    passwordResetExpires: new Date("2030-01-02"),
    pendingNewEmail: "pending@test.com",
    emailChangeToken: "SENTINEL_EMAIL_CHANGE_TOKEN",
    emailChangeExpires: new Date("2030-01-03"),
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
    earnings: 42.5,
    balance: 99,
    totalWithdrawn: 10,
    transactions: [{ type: "credit", amount: 1 }],
    children: [new mongoose.Types.ObjectId()],
    referredBy: "REF123",
    trialUsed: true,
    subscription: "premium",
    subscriptionEndDate: new Date("2026-12-01"),
    subscriptionV2: {
      plan: "monthly",
      planId: "SENTINEL_PLAN_ID",
      provider: "SENTINEL_PROVIDER",
      status: "active",
      expiresAt: new Date("2026-06-01"),
      cancelAtPeriodEnd: true,
    },
    referralCode: "ADA01",
    yearGroup: 11,
    stageKey: "gcse",
    purchasedLessons: [
      {
        lessonId: lessonOid,
        purchasedAt: new Date("2026-02-01"),
        price: 5,
        completed: false,
      },
    ],
    studentStats: { totalLessonsPurchased: 1 },
    __v: 3,
  };

  test("toCurrentUserDto emits required safe fields and dual ids", () => {
    const dto = toCurrentUserDto(seeded);
    expect(dto.id).toBe(String(oid));
    expect(dto._id).toBe(String(oid));
    expect(dto.email).toBe("dto-user@test.com");
    expect(dto.userType).toBe("student");
    expect(dto.staffRole).toBeNull();
    expect(dto.firstName).toBe("Ada");
    expect(dto.lastName).toBe("Lovelace");
    expect(dto.verificationStatus).toBe("verified");
    expect(dto.emailVerified).toBe(true);
    expect(dto.schoolName).toBe("Test School");
    expect(dto.institution).toBe("Test Institution");
    expect(dto.yearGroup).toBe(11);
    expect(dto.stageKey).toBe("gcse");
    expect(dto.referralCode).toBe("ADA01");
    expect(dto.subscription).toBe("premium");
    expect(dto.subscriptionV2).toEqual({
      plan: "monthly",
      status: "active",
      expiresAt: "2026-06-01T00:00:00.000Z",
      cancelAtPeriodEnd: true,
    });
    expect(dto).not.toHaveProperty("purchasedLessons");
    expect(dto).not.toHaveProperty("earnings");
    assertNoForbiddenKeys(dto);
  });

  test("toCurrentUserDto derives emailVerified false for pending", () => {
    const dto = toCurrentUserDto({ ...seeded, verificationStatus: "pending" });
    expect(dto.emailVerified).toBe(false);
  });

  test("toSelfProfileDto adds earnings and purchasedLessons id shape", () => {
    const dto = toSelfProfileDto(seeded);
    expect(dto.earnings).toBe(42.5);
    expect(dto.purchasedLessons).toEqual([
      {
        lessonId: String(lessonOid),
        purchasedAt: "2026-02-01T00:00:00.000Z",
      },
    ]);
    assertNoForbiddenKeys(dto);
  });

  test("toPurchasedLessonsDto unwraps populated lesson docs", () => {
    const mapped = toPurchasedLessonsDto([
      {
        lessonId: { _id: lessonOid, title: "Secret lesson title", content: "…" },
        purchasedAt: new Date("2026-03-01"),
      },
    ]);
    expect(mapped).toEqual([
      { lessonId: String(lessonOid), purchasedAt: "2026-03-01T00:00:00.000Z" },
    ]);
    expect(JSON.stringify(mapped)).not.toMatch(/Secret lesson/);
  });

  test("toSafeSubscriptionV2 strips provider and planId", () => {
    const safe = toSafeSubscriptionV2({
      plan: "annual",
      planId: "X",
      provider: "Y",
      status: "trialing",
      expiresAt: null,
      cancelAtPeriodEnd: false,
    });
    expect(safe).toEqual({
      plan: "annual",
      status: "trialing",
      expiresAt: null,
      cancelAtPeriodEnd: false,
    });
    expect(safe).not.toHaveProperty("provider");
    expect(safe).not.toHaveProperty("planId");
  });
});
