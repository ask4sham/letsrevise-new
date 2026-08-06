/**
 * Prove auth email routes treat Resend resolved `{ error }` the same as SDK rejection.
 * Mocks the `resend` package — no real network or email.
 */
jest.mock("resend", () => {
  const send = jest.fn();
  const Resend = jest.fn(function MockResend() {
    return { emails: { send } };
  });
  return { Resend, __mockSend: send };
});

const request = require("supertest");
const bcrypt = require("bcryptjs");
const { __mockSend: mockSend } = require("resend");
const app = require("../app");
const User = require("../models/User");
const ParentLinkRequest = require("../models/ParentLinkRequest");

const STRONG_PASSWORD = "SecurePass1!";
const PROVIDER_ERROR = {
  data: null,
  error: {
    statusCode: 400,
    message: "Controlled provider failure",
    name: "validation_error",
  },
};

function envSnapshot(keys) {
  const snap = {};
  for (const k of keys) snap[k] = process.env[k];
  return snap;
}

function restoreEnv(snap) {
  for (const [k, v] of Object.entries(snap)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function setResendEnv() {
  process.env.RESEND_API_KEY = "re_test_dummy_key_not_real";
  process.env.RESEND_FROM_EMAIL = "noreply@example.invalid";
  process.env.APP_BASE_URL = "http://localhost:3000";
}

function assertNoSecretLeak(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  expect(text).not.toMatch(/re_test_dummy_key/);
  expect(text).not.toMatch(/Controlled provider failure.*token=/i);
  expect(text).not.toMatch(/passwordResetToken|emailVerificationToken|emailChangeToken/i);
}

describe("auth Resend returned-{error} equivalence", () => {
  const envKeys = [
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "APP_BASE_URL",
    "NODE_ENV",
    "PARENT_LINK_TOKEN_SECRET",
  ];
  let snap;
  let originalFetch;
  let ipCounter = 0;

  beforeAll(() => {
    snap = envSnapshot(envKeys);
    process.env.NODE_ENV = "test";
  });

  afterAll(() => {
    restoreEnv(snap);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setResendEnv();
    process.env.PARENT_LINK_TOKEN_SECRET = "test-parent-link-secret-not-production";
    originalFetch = global.fetch;
    global.fetch = jest.fn(async () => {
      throw new Error("NETWORK_VIOLATION: fetch must not be called");
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    restoreEnv(snap);
    process.env.NODE_ENV = "test";
  });

  function nextIp() {
    ipCounter += 1;
    return `203.0.113.${(ipCounter % 250) + 1}`;
  }

  async function createUser(overrides = {}) {
    const email = overrides.email || `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.invalid`;
    const user = await User.create({
      firstName: overrides.firstName || "Test",
      lastName: overrides.lastName || "User",
      email,
      password: await bcrypt.hash(STRONG_PASSWORD, 10),
      userType: overrides.userType || "student",
      verificationStatus: overrides.verificationStatus || "verified",
      ...overrides,
      email,
    });
    return user;
  }

  async function loginToken(email) {
    const res = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", nextIp())
      .send({ email, password: STRONG_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    return res.body.token;
  }

  describe("1. registration verification", () => {
    async function registerWithSend(mode) {
      if (mode === "reject") {
        mockSend.mockRejectedValue(new Error("SDK rejected"));
      } else if (mode === "returned") {
        mockSend.mockResolvedValue(PROVIDER_ERROR);
      } else {
        mockSend.mockResolvedValue({ data: { id: "email_ok" }, error: null });
      }
      const email = `reg-${mode}-${Date.now()}@example.invalid`;
      const res = await request(app)
        .post("/api/auth/register")
        .set("X-Forwarded-For", nextIp())
        .send({
          email,
          password: STRONG_PASSWORD,
          firstName: "Reg",
          lastName: "Student",
          userType: "student",
          yearGroup: 10,
        });
      const user = await User.findOne({ email });
      return { res, user, email };
    }

    test("reject and returned {error} match", async () => {
      const a = await registerWithSend("reject");
      const b = await registerWithSend("returned");

      expect(a.res.status).toBe(b.res.status);
      expect(a.res.status).toBe(201);
      expect(a.res.body.verificationEmailSent).toBe(false);
      expect(b.res.body.verificationEmailSent).toBe(false);
      expect(a.res.body.verificationEmailWarning).toBeTruthy();
      expect(b.res.body.verificationEmailWarning).toBe(a.res.body.verificationEmailWarning);
      expect(a.user).toBeTruthy();
      expect(b.user).toBeTruthy();
      expect(a.user.emailVerificationToken).toBeTruthy();
      expect(b.user.emailVerificationToken).toBeTruthy();
      expect(mockSend).toHaveBeenCalledTimes(2);
      assertNoSecretLeak(a.res.body);
      assertNoSecretLeak(b.res.body);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("successful provider result remains sent=true", async () => {
      const { res, user } = await registerWithSend("success");
      expect(res.status).toBe(201);
      expect(res.body.verificationEmailSent).toBe(true);
      expect(user.verificationEmailLastSentAt).toBeTruthy();
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test("missing RESEND_API_KEY behaviour unchanged (no send)", async () => {
      delete process.env.RESEND_API_KEY;
      const email = `reg-missing-key-${Date.now()}@example.invalid`;
      const res = await request(app)
        .post("/api/auth/register")
        .set("X-Forwarded-For", nextIp())
        .send({
          email,
          password: STRONG_PASSWORD,
          firstName: "Reg",
          lastName: "Student",
          userType: "student",
          yearGroup: 10,
        });
      expect(res.status).toBe(201);
      expect(res.body.verificationEmailSent).toBe(false);
      expect(String(res.body.verificationEmailWarning || "")).toMatch(/not configured/i);
      expect(mockSend).not.toHaveBeenCalled();
    });

    test("missing RESEND_FROM_EMAIL behaviour unchanged (no send)", async () => {
      delete process.env.RESEND_FROM_EMAIL;
      const email = `reg-missing-from-${Date.now()}@example.invalid`;
      const res = await request(app)
        .post("/api/auth/register")
        .set("X-Forwarded-For", nextIp())
        .send({
          email,
          password: STRONG_PASSWORD,
          firstName: "Reg",
          lastName: "Student",
          userType: "student",
          yearGroup: 10,
        });
      expect(res.status).toBe(201);
      expect(res.body.verificationEmailSent).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe("2. resend-verification", () => {
    async function resendWithSend(mode) {
      const user = await createUser({
        verificationStatus: "pending",
        verificationEmailLastSentAt: new Date(Date.now() - 60_000),
      });
      if (mode === "reject") {
        mockSend.mockRejectedValue(new Error("SDK rejected"));
      } else {
        mockSend.mockResolvedValue(PROVIDER_ERROR);
      }
      const res = await request(app)
        .post("/api/auth/resend-verification")
        .set("X-Forwarded-For", nextIp())
        .send({ email: user.email });
      const after = await User.findById(user._id);
      return { res, after };
    }

    test("reject and returned {error} match", async () => {
      const a = await resendWithSend("reject");
      const b = await resendWithSend("returned");

      expect(a.res.status).toBe(b.res.status);
      expect(a.res.status).toBe(503);
      expect(a.res.body).toMatchObject({ ok: false, code: "EMAIL_SEND_FAILED" });
      expect(b.res.body).toMatchObject({ ok: false, code: "EMAIL_SEND_FAILED" });
      expect(a.after.emailVerificationToken).toBeTruthy();
      expect(b.after.emailVerificationToken).toBeTruthy();
      expect(mockSend).toHaveBeenCalledTimes(2);
      assertNoSecretLeak(a.res.body);
      assertNoSecretLeak(b.res.body);
    });
  });

  describe("3. password reset", () => {
    async function forgotWithSend(mode) {
      const user = await createUser({ verificationStatus: "verified" });
      if (mode === "reject") {
        mockSend.mockRejectedValue(new Error("SDK rejected"));
      } else if (mode === "returned") {
        mockSend.mockResolvedValue(PROVIDER_ERROR);
      } else {
        mockSend.mockResolvedValue({ data: { id: "email_ok" }, error: null });
      }
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .set("X-Forwarded-For", nextIp())
        .send({ email: user.email });
      const after = await User.findById(user._id);
      return { res, after, user };
    }

    test("reject and returned {error} match", async () => {
      const a = await forgotWithSend("reject");
      const b = await forgotWithSend("returned");

      expect(a.res.status).toBe(b.res.status);
      expect(a.res.body).toEqual(b.res.body);
      expect(a.res.body).toMatchObject({
        ok: true,
        msg: "If an account exists with that email, you will receive a password reset link shortly.",
      });
      expect(a.after.passwordResetToken).toBeTruthy();
      expect(b.after.passwordResetToken).toBeTruthy();
      expect(mockSend).toHaveBeenCalledTimes(2);
      assertNoSecretLeak(a.res.body);
    });

    test("successful send still returns generic success once", async () => {
      const { res, after } = await forgotWithSend("success");
      expect(res.body.ok).toBe(true);
      expect(after.passwordResetToken).toBeTruthy();
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("4. email-change verification", () => {
    async function changeEmailWithSend(mode) {
      const user = await createUser({ verificationStatus: "verified", userType: "teacher" });
      const token = await loginToken(user.email);
      if (mode === "reject") {
        mockSend.mockRejectedValue(new Error("SDK rejected"));
      } else {
        mockSend.mockResolvedValue(PROVIDER_ERROR);
      }
      const newEmail = `new-${mode}-${Date.now()}@example.invalid`;
      const res = await request(app)
        .put("/api/auth/me/email")
        .set("X-Forwarded-For", nextIp())
        .set("x-auth-token", token)
        .send({ currentPassword: STRONG_PASSWORD, newEmail });
      const after = await User.findById(user._id);
      return { res, after, newEmail };
    }

    test("reject and returned {error} match", async () => {
      const a = await changeEmailWithSend("reject");
      const b = await changeEmailWithSend("returned");

      expect(a.res.status).toBe(b.res.status);
      expect(a.res.status).toBe(500);
      expect(a.res.body.code).toBe("INTERNAL_ERROR");
      expect(b.res.body.code).toBe("INTERNAL_ERROR");
      expect(a.after.pendingNewEmail).toBe(a.newEmail);
      expect(b.after.pendingNewEmail).toBe(b.newEmail);
      expect(a.after.emailChangeToken).toBeTruthy();
      expect(b.after.emailChangeToken).toBeTruthy();
      expect(mockSend).toHaveBeenCalledTimes(2);
      assertNoSecretLeak(a.res.body);
      assertNoSecretLeak(b.res.body);
    });
  });

  describe("5. parent-link invitation", () => {
    async function parentRegisterWithSend(mode) {
      const student = await createUser({
        userType: "student",
        verificationStatus: "verified",
        yearGroup: 10,
      });
      if (mode === "reject") {
        mockSend.mockRejectedValue(new Error("SDK rejected"));
      } else {
        mockSend.mockResolvedValue(PROVIDER_ERROR);
      }
      const parentEmail = `parent-${mode}-${Date.now()}@example.invalid`;
      const res = await request(app)
        .post("/api/auth/register")
        .set("X-Forwarded-For", nextIp())
        .send({
          email: parentEmail,
          password: STRONG_PASSWORD,
          firstName: "Parent",
          lastName: "One",
          userType: "parent",
          linkedStudentEmail: student.email,
        });
      const parent = await User.findOne({ email: parentEmail });
      const link = parent
        ? await ParentLinkRequest.findOne({ parentId: parent._id, studentId: student._id })
        : null;
      return { res, parent, link, student };
    }

    test("reject and returned {error} match", async () => {
      const a = await parentRegisterWithSend("reject");
      const b = await parentRegisterWithSend("returned");

      expect(a.res.status).toBe(b.res.status);
      expect(a.res.status).toBe(500);
      expect(a.res.body.code).toBe("INTERNAL_ERROR");
      expect(b.res.body.code).toBe("INTERNAL_ERROR");
      // Verification send is caught; parent-link send is not — account + pending request remain.
      expect(a.parent).toBeTruthy();
      expect(b.parent).toBeTruthy();
      expect(a.link).toBeTruthy();
      expect(b.link).toBeTruthy();
      expect(a.link.status).toBe("pending");
      expect(b.link.status).toBe("pending");
      // Two sends per registration: verification (caught) then parent-link (uncaught → 500).
      expect(mockSend).toHaveBeenCalledTimes(4);
      assertNoSecretLeak(a.res.body);
      assertNoSecretLeak(b.res.body);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
