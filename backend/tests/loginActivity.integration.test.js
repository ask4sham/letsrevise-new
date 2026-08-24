/**
 * Login Activity V1 — auth write path, admin read API, fail-open semantics.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const LoginEvent = require("../models/LoginEvent");
const { recordLoginSuccess, performLoginSuccessWrites } = require("../utils/recordLoginSuccess");

const hashedPassword = bcrypt.hashSync("password123", 10);
const ts = Date.now();

async function waitForLoginEvent(userId, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const event = await LoginEvent.findOne({ userId }).sort({ loggedInAt: -1 });
    if (event) return event;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

async function waitForLastLoginAt(userId, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const user = await User.findById(userId).select("lastLoginAt").lean();
    if (user?.lastLoginAt) return user.lastLoginAt;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

describe("Login Activity V1", () => {
  let adminToken;
  let teacherToken;
  let adminId;
  let teacherId;
  let unverifiedId;
  let legacyUserId;

  beforeAll(async () => {
    const admin = await User.create({
      firstName: "Login",
      lastName: "Admin",
      email: `login-admin-${ts}@test.com`,
      password: hashedPassword,
      userType: "admin",
      verificationStatus: "verified",
    });
    adminId = admin._id;

    const teacher = await User.create({
      firstName: "Login",
      lastName: "Teacher",
      email: `login-teacher-${ts}@test.com`,
      password: hashedPassword,
      userType: "teacher",
      verificationStatus: "verified",
    });
    teacherId = teacher._id;

    const unverified = await User.create({
      firstName: "Unverified",
      lastName: "User",
      email: `login-unverified-${ts}@test.com`,
      password: hashedPassword,
      userType: "student",
      verificationStatus: "pending",
    });
    unverifiedId = unverified._id;

    const legacy = await User.create({
      firstName: "Legacy",
      lastName: "User",
      email: `login-legacy-${ts}@test.com`,
      password: hashedPassword,
      userType: "student",
      verificationStatus: "verified",
    });
    legacyUserId = legacy._id;

    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: admin.email, password: "password123" });
    adminToken = adminLogin.body?.token;

    const teacherLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: teacher.email, password: "password123" });
    teacherToken = teacherLogin.body?.token;

    if (!adminToken || !teacherToken) throw new Error("Setup login failed");
  }, 20000);

  afterAll(async () => {
    await LoginEvent.deleteMany({
      userId: { $in: [adminId, teacherId, unverifiedId, legacyUserId] },
    });
  });

  describe("auth write path", () => {
    test("successful login creates LoginEvent with snapshots and updates lastLoginAt", async () => {
      const email = `login-success-${ts}@test.com`;
      const user = await User.create({
        firstName: "Success",
        lastName: "Login",
        email,
        password: hashedPassword,
        userType: "student",
      });

      const beforeEvents = await LoginEvent.countDocuments({ userId: user._id });

      const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user).toMatchObject({
        email,
        userType: "student",
      });

      const event = await waitForLoginEvent(user._id);
      expect(event).toBeTruthy();
      expect(event.emailSnapshot).toBe(email);
      expect(event.firstNameSnapshot).toBe("Success");
      expect(event.userTypeSnapshot).toBe("student");
      expect(event.loggedInAt).toBeInstanceOf(Date);

      const lastLoginAt = await waitForLastLoginAt(user._id);
      expect(lastLoginAt).toBeTruthy();

      const afterEvents = await LoginEvent.countDocuments({ userId: user._id });
      expect(afterEvents).toBe(beforeEvents + 1);

      await LoginEvent.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
    });

    test("unverified successful login still records activity", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: `login-unverified-${ts}@test.com`, password: "password123" });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();

      const event = await waitForLoginEvent(unverifiedId);
      expect(event).toBeTruthy();
      expect(event.userTypeSnapshot).toBe("student");
    });

    test("failed password does not write login activity", async () => {
      const email = `login-fail-${ts}@test.com`;
      const user = await User.create({
        firstName: "Fail",
        lastName: "Password",
        email,
        password: hashedPassword,
        userType: "student",
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "wrong-password" });
      expect(res.status).toBe(400);

      await new Promise((r) => setTimeout(r, 200));
      const events = await LoginEvent.countDocuments({ userId: user._id });
      expect(events).toBe(0);

      const refreshed = await User.findById(user._id).select("lastLoginAt").lean();
      expect(refreshed?.lastLoginAt).toBeFalsy();

      await User.deleteOne({ _id: user._id });
    });

    test("unknown user does not write login activity", async () => {
      const before = await LoginEvent.countDocuments({});
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: `nobody-${ts}@test.com`, password: "password123" });
      expect(res.status).toBe(400);
      await new Promise((r) => setTimeout(r, 100));
      const after = await LoginEvent.countDocuments({});
      expect(after).toBe(before);
    });

    test("register does not create login activity event", async () => {
      const email = `login-register-${ts}@test.com`;
      const before = await LoginEvent.countDocuments({ emailSnapshot: email });

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email,
          password: "Password123!",
          firstName: "Reg",
          userType: "student",
        });
      expect(res.status).toBe(201);
      expect(res.body.token).toBeTruthy();

      await new Promise((r) => setTimeout(r, 200));
      const after = await LoginEvent.countDocuments({ emailSnapshot: email });
      expect(after).toBe(before);

      const created = await User.findOne({ email });
      if (created) {
        await LoginEvent.deleteMany({ userId: created._id });
        await User.deleteOne({ _id: created._id });
      }
    });

    test("audit write failure does not break valid login", async () => {
      const email = `login-failopen-${ts}@test.com`;
      await User.create({
        firstName: "Fail",
        lastName: "Open",
        email,
        password: hashedPassword,
        userType: "student",
      });

      const createSpy = jest.spyOn(LoginEvent, "create").mockRejectedValueOnce(new Error("db down"));

      const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.email).toBe(email);

      createSpy.mockRestore();

      const created = await User.findOne({ email });
      await LoginEvent.deleteMany({ userId: created._id });
      await User.deleteOne({ email });
    });

    test("Promise.allSettled allows lastLoginAt when LoginEvent.create fails", async () => {
      const user = await User.create({
        firstName: "Partial",
        lastName: "Write",
        email: `login-partial-${ts}@test.com`,
        password: hashedPassword,
        userType: "student",
      });

      const createSpy = jest.spyOn(LoginEvent, "create").mockRejectedValueOnce(new Error("event fail"));
      await performLoginSuccessWrites(user, new Date());
      createSpy.mockRestore();

      const refreshed = await User.findById(user._id).select("lastLoginAt").lean();
      expect(refreshed?.lastLoginAt).toBeTruthy();

      await User.deleteOne({ _id: user._id });
    });

    test("recordLoginSuccess returns immediately without awaiting writes", async () => {
      const user = await User.create({
        firstName: "Async",
        lastName: "Return",
        email: `login-async-${ts}@test.com`,
        password: hashedPassword,
        userType: "student",
      });

      let resolveBlock;
      const blockPromise = new Promise((resolve) => {
        resolveBlock = resolve;
      });

      const updateSpy = jest.spyOn(User, "updateOne").mockImplementationOnce(async () => {
        await blockPromise;
        return { acknowledged: true, modifiedCount: 1, matchedCount: 1, upsertedCount: 0, upsertedId: null };
      });

      recordLoginSuccess({ user, loggedInAt: new Date() });
      expect(updateSpy).toHaveBeenCalled();

      resolveBlock();
      updateSpy.mockRestore();

      await User.deleteOne({ _id: user._id });
    });
  });

  describe("admin read API", () => {
    test("unauthenticated returns 401", async () => {
      const res = await request(app).get("/api/admin/login-activity");
      expect(res.status).toBe(401);
    });

    test("non-admin returns 403", async () => {
      const res = await request(app)
        .get("/api/admin/login-activity")
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(res.status).toBe(403);
    });

    test("admin returns 200 with snapshot fields only", async () => {
      const res = await request(app)
        .get("/api/admin/login-activity")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.events)).toBe(true);

      if (res.body.events.length > 0) {
        const event = res.body.events[0];
        expect(event).toHaveProperty("emailSnapshot");
        expect(event).toHaveProperty("userTypeSnapshot");
        expect(event).toHaveProperty("loggedInAt");
        expect(event).not.toHaveProperty("password");
        expect(event).not.toHaveProperty("ip");
        expect(event).not.toHaveProperty("userAgent");
      }
    });

    test("limit is capped at 200", async () => {
      const res = await request(app)
        .get("/api/admin/login-activity?limit=999")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBeLessThanOrEqual(200);
    });

    test("events are sorted by loggedInAt descending", async () => {
      const res = await request(app)
        .get("/api/admin/login-activity?limit=50")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const times = (res.body.events || []).map((e) => new Date(e.loggedInAt).getTime());
      for (let i = 1; i < times.length; i++) {
        expect(times[i - 1]).toBeGreaterThanOrEqual(times[i]);
      }
    });
  });

  describe("last login on users list", () => {
    test("GET /api/admin/users includes lastLoginAt (null for legacy)", async () => {
      const res = await request(app)
        .get("/api/admin/users?search=login-legacy")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const legacy = (res.body.users || []).find((u) => String(u.id) === String(legacyUserId));
      expect(legacy).toBeTruthy();
      expect(legacy).toHaveProperty("lastLoginAt");
      expect(legacy.lastLoginAt).toBeNull();
    });

    test("GET /api/admin/users preserves lastActive semantics unchanged", async () => {
      const activeDate = new Date("2026-07-01T12:00:00.000Z");
      const student = await User.create({
        firstName: "Active",
        lastName: "Student",
        email: `login-lastactive-${ts}@test.com`,
        password: hashedPassword,
        userType: "student",
        verificationStatus: "verified",
        studentStats: { lastActiveDate: activeDate },
      });

      const res = await request(app)
        .get("/api/admin/users?search=login-lastactive")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      const row = (res.body.users || []).find((u) => String(u.id) === String(student._id));
      expect(row).toBeTruthy();
      expect(row).toHaveProperty("lastActive");
      expect(new Date(row.lastActive).toISOString()).toBe(activeDate.toISOString());
      expect(row).toHaveProperty("lastLoginAt");
      expect(row.lastLoginAt).toBeNull();

      await User.deleteOne({ _id: student._id });
    });
  });
});
