/**
 * Security: GET /api/users/me, /api/users/profile, /api/auth/user
 * return allowlisted DTOs — never auth/recovery tokens or internal fields.
 *
 * Assertions name keys only; sentinel secret VALUES must never be logged.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { createUsersRouteTestApp } = require("./helpers/createUsersRouteTestApp");
const User = require("../models/User");

const app = createUsersRouteTestApp();

jest.setTimeout(60000);

const FORBIDDEN_TOP_LEVEL = [
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

function assertForbiddenAbsent(body) {
  for (const key of FORBIDDEN_TOP_LEVEL) {
    expect(body).not.toHaveProperty(key);
  }
  if (body.subscriptionV2) {
    expect(body.subscriptionV2).not.toHaveProperty("provider");
    expect(body.subscriptionV2).not.toHaveProperty("planId");
  }
  const json = JSON.stringify(body);
  expect(json).not.toMatch(/SENTINEL_/);
}

function assertCurrentUserShape(body) {
  expect(body).toEqual(expect.objectContaining({
    id: expect.any(String),
    _id: expect.any(String),
    email: expect.any(String),
    userType: expect.any(String),
    firstName: expect.any(String),
    lastName: expect.any(String),
    verificationStatus: expect.any(String),
    emailVerified: expect.any(Boolean),
  }));
  expect(body.id).toBe(body._id);
  expect(body).toHaveProperty("staffRole");
  expect(body).toHaveProperty("schoolName");
  expect(body).toHaveProperty("institution");
  expect(body).toHaveProperty("yearGroup");
  expect(body).toHaveProperty("stageKey");
  expect(body).toHaveProperty("referralCode");
  expect(typeof body.hasLetsReviseProAccess).toBe("boolean");
  assertForbiddenAbsent(body);
  expect(body).not.toHaveProperty("purchasedLessons");
  expect(body).not.toHaveProperty("earnings");
  expect(body).not.toHaveProperty("stripeBilling");
}

async function createUserWithSecrets(overrides = {}) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const pw = await bcrypt.hash("Pass123!", 10);
  const lessonId = new mongoose.Types.ObjectId();
  const doc = await User.create({
    email: `safe-dto-${stamp}@test.com`,
    password: pw,
    firstName: "Safe",
    lastName: "User",
    userType: "student",
    staffRole: null,
    verificationStatus: "verified",
    schoolName: "Safe School",
    institution: "Safe Institution",
    yearGroup: 10,
    stageKey: "gcse",
    referralCode: `RC${stamp.slice(-6)}`,
    emailVerificationToken: "SENTINEL_EMAIL_VERIFY_TOKEN",
    emailVerificationExpires: new Date("2030-01-01"),
    verificationEmailLastSentAt: new Date("2026-01-01"),
    passwordResetToken: "SENTINEL_PASSWORD_RESET_TOKEN",
    passwordResetExpires: new Date("2030-01-02"),
    pendingNewEmail: "pending-change@test.com",
    emailChangeToken: "SENTINEL_EMAIL_CHANGE_TOKEN",
    emailChangeExpires: new Date("2030-01-03"),
    earnings: 12.5,
    balance: 77,
    totalWithdrawn: 3,
    transactions: [{ type: "purchase", amount: 1, description: "SENTINEL_TX" }],
    children: [new mongoose.Types.ObjectId()],
    referredBy: "SENTINEL_REF",
    trialUsed: true,
    subscription: "premium",
    subscriptionEndDate: new Date("2026-12-01"),
    subscriptionV2: {
      plan: "monthly",
      planId: "SENTINEL_PLAN_ID",
      provider: "SENTINEL_PROVIDER",
      status: "active",
      expiresAt: new Date("2026-06-01"),
      cancelAtPeriodEnd: false,
    },
    purchasedLessons: [
      {
        lessonId,
        purchasedAt: new Date("2026-02-15"),
        price: 9,
      },
    ],
    ...overrides,
  });
  return { user: doc, password: "Pass123!", lessonId };
}

async function loginToken(email, password) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  expect(res.body.token).toBeTruthy();
  return res.body.token;
}

describe("Safe current-user / self-profile DTOs", () => {
  const createdIds = [];

  afterAll(async () => {
    if (createdIds.length) {
      await User.deleteMany({ _id: { $in: createdIds } });
    }
  });

  test.each([
    ["student", { userType: "student", verificationStatus: "verified" }],
    ["teacher", { userType: "teacher", verificationStatus: "verified" }],
    ["parent", { userType: "parent", verificationStatus: "verified" }],
    ["admin", { userType: "admin", verificationStatus: "verified" }],
  ])("role %s: /users/me and /auth/user return slim DTO without secrets", async (_label, overrides) => {
    const { user, password } = await createUserWithSecrets(overrides);
    createdIds.push(user._id);
    const token = await loginToken(user.email, password);

    const me = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    assertCurrentUserShape(me.body);
    expect(me.body.userType).toBe(overrides.userType);
    expect(me.body.emailVerified).toBe(true);

    const authUser = await request(app)
      .get("/api/auth/user")
      .set("Authorization", `Bearer ${token}`);
    expect(authUser.status).toBe(200);
    assertCurrentUserShape(authUser.body);
    expect(authUser.body.userType).toBe(overrides.userType);
  });

  test("unverified user: emailVerified false on /users/me", async () => {
    const { user, password } = await createUserWithSecrets({
      verificationStatus: "pending",
    });
    createdIds.push(user._id);
    const token = await loginToken(user.email, password);
    const me = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.emailVerified).toBe(false);
    expect(me.body.verificationStatus).toBe("pending");
    assertForbiddenAbsent(me.body);
  });

  test("/users/profile: self-profile DTO with purchases + earnings; secrets absent", async () => {
    const { user, password, lessonId } = await createUserWithSecrets({
      userType: "student",
      verificationStatus: "verified",
    });
    createdIds.push(user._id);
    const token = await loginToken(user.email, password);

    const res = await request(app)
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    assertForbiddenAbsent(res.body);
    expect(res.body.id).toBe(String(user._id));
    expect(res.body._id).toBe(String(user._id));
    expect(res.body.earnings).toBe(12.5);
    expect(Array.isArray(res.body.purchasedLessons)).toBe(true);
    expect(res.body.purchasedLessons[0]).toEqual({
      lessonId: String(lessonId),
      purchasedAt: expect.any(String),
    });
    expect(res.body.purchasedLessons[0]).not.toHaveProperty("price");
    expect(res.body.purchasedLessons[0]).not.toHaveProperty("title");
    expect(res.body.subscriptionV2).toEqual({
      plan: "monthly",
      status: "active",
      expiresAt: "2026-06-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    });
    expect(res.body.subscription).toBe("premium");
  });

  test("unsubscribed user: subscription fields remain safe", async () => {
    const { user, password } = await createUserWithSecrets({
      subscription: "free",
      subscriptionEndDate: undefined,
      subscriptionV2: {
        plan: "trial",
        planId: "SENTINEL_PLAN_ID",
        provider: "SENTINEL_PROVIDER",
        status: "expired",
        expiresAt: new Date("2025-01-01"),
        cancelAtPeriodEnd: false,
      },
    });
    createdIds.push(user._id);
    const token = await loginToken(user.email, password);
    const me = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.subscription).toBe("free");
    expect(me.body.subscriptionV2.status).toBe("expired");
    expect(me.body.subscriptionV2).not.toHaveProperty("provider");
    expect(me.body.subscriptionV2).not.toHaveProperty("planId");
  });

  test("LetsRevise Pro: hasLetsReviseProAccess true without exposing Stripe billing fields", async () => {
    const { user, password } = await createUserWithSecrets({
      stripeBilling: {
        planId: "letsrevise_pro",
        status: "active",
        paidThrough: new Date(Date.now() + 86400000),
        customerId: "cus_SENTINEL",
        subscriptionId: "sub_SENTINEL",
        priceId: "price_SENTINEL",
      },
    });
    createdIds.push(user._id);
    const token = await loginToken(user.email, password);
    const me = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.hasLetsReviseProAccess).toBe(true);
    expect(me.body).not.toHaveProperty("stripeBilling");
    const json = JSON.stringify(me.body);
    expect(json).not.toMatch(/cus_SENTINEL|sub_SENTINEL|price_SENTINEL/);
  });

  test("no Stripe entitlement: hasLetsReviseProAccess false", async () => {
    const { user, password } = await createUserWithSecrets({
      stripeBilling: {
        planId: "letsrevise_pro",
        status: "canceled",
        paidThrough: new Date(Date.now() + 86400000),
      },
    });
    createdIds.push(user._id);
    const token = await loginToken(user.email, password);
    const me = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.hasLetsReviseProAccess).toBe(false);
  });

  test("deleted user: /users/me returns 401 ACCOUNT_DELETED", async () => {
    const jwt = require("jsonwebtoken");
    const { getJwtSecret } = require("../utils/jwtSecret");
    const { user } = await createUserWithSecrets({
      isDeleted: true,
      deletedAt: new Date(),
      deleteReason: "test",
    });
    createdIds.push(user._id);
    // Login rejects deleted accounts; mint a token to exercise the /me gate.
    const token = jwt.sign(
      { user: { id: user._id.toString(), userType: user.userType } },
      getJwtSecret(),
      { expiresIn: "1h", algorithm: "HS256" }
    );
    const me = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(401);
    expect(me.body.code).toBe("ACCOUNT_DELETED");
  });

  test("login payload unchanged: allowlisted and free of secrets", async () => {
    const { user, password } = await createUserWithSecrets({
      userType: "teacher",
      verificationStatus: "verified",
    });
    createdIds.push(user._id);
    const res = await request(app).post("/api/auth/login").send({
      email: user.email,
      password,
    });
    expect(res.status).toBe(200);
    const u = res.body.user;
    expect(u).toEqual(
      expect.objectContaining({
        id: String(user._id),
        email: user.email,
        userType: "teacher",
        firstName: "Safe",
        lastName: "User",
        verificationStatus: "verified",
        emailVerified: true,
      })
    );
    assertForbiddenAbsent(u);
    // Login historically uses id only (no _id) — preserve that contract.
    expect(u).not.toHaveProperty("_id");
  });
});
