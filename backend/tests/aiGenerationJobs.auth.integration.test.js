/**
 * Authz for AI-generation-job routes (admin + user + /public alias).
 * Uses a focused Express app that mirrors the production middleware chains
 * (admin: auth → checkAdmin → router; user: auth inside router).
 * No provider calls; no Lesson / ExamQuestion / Candidate writes.
 */
const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const authRoutes = require("../routes/auth");
const adminAiGenerationJobs = require("../routes/adminAiGenerationJobs");
const aiGenerationJobs = require("../routes/aiGenerationJobs");
const User = require("../models/User");
const AiGenerationJob = require("../models/AiGenerationJob");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");

let ExamQuestionRationaleCandidate;
try {
  ExamQuestionRationaleCandidate = require("../models/ExamQuestionRationaleCandidate");
} catch (_) {
  ExamQuestionRationaleCandidate = null;
}

const hashedPassword = bcrypt.hashSync("password123", 10);

/** Same admin gate as backend/routes/admin.js checkAdmin */
function checkAdmin(req, res, next) {
  const userType = (req.user?.userType || req.user?.type || "").toString().toLowerCase();
  if (!req.user || userType !== "admin") {
    return res.status(403).json({ msg: "Admin access required" });
  }
  next();
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  // Specific /public alias before admin catch-all (same order as admin.js)
  app.use("/api/admin/ai-generation-jobs/public", aiGenerationJobs);
  app.use("/api/admin/ai-generation-jobs", auth, checkAdmin, adminAiGenerationJobs);
  app.use("/api/ai-generation-jobs", aiGenerationJobs);
  return app;
}

async function loginAs(app, { email, userType, staffRole, subscriptionV2 }) {
  const doc = {
    firstName: "AiJob",
    lastName: userType,
    email,
    password: hashedPassword,
    userType,
  };
  if (staffRole) doc.staffRole = staffRole;
  if (subscriptionV2 !== undefined) doc.subscriptionV2 = subscriptionV2;
  const user = await User.create(doc);
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "password123" });
  const token = login.body?.token;
  if (!token) throw new Error(`Login failed for ${email}: ${JSON.stringify(login.body)}`);
  return { user, token };
}

async function seedJob(overrides = {}) {
  return AiGenerationJob.create({
    version: 1,
    type: "LESSON_DRAFT",
    requestedByUserId: overrides.requestedByUserId,
    input: overrides.input || { prompt: "test-input" },
    output: overrides.output !== undefined ? overrides.output : null,
    status: overrides.status || "QUEUED",
    error: overrides.error || undefined,
    startedAt: overrides.startedAt || null,
    finishedAt: overrides.finishedAt || null,
  });
}

describe("AI generation job route security", () => {
  const app = buildApp();
  let adminToken;
  let teacherToken;
  let teacherId;
  let studentToken;
  let studentId;
  let parentToken;
  let cmToken;
  let otherTeacherToken;
  let otherTeacherId;
  let studentNoSubToken;

  let lessonCreateSpy;
  let examCreateSpy;
  let candidateCreateSpy;
  let openaiCreateSpy;

  beforeAll(async () => {
    const admin = await loginAs(app, {
      email: "aijob-admin@test.com",
      userType: "admin",
    });
    adminToken = admin.token;

    const teacher = await loginAs(app, {
      email: "aijob-teacher@test.com",
      userType: "teacher",
    });
    teacherToken = teacher.token;
    teacherId = teacher.user._id;

    const other = await loginAs(app, {
      email: "aijob-other-teacher@test.com",
      userType: "teacher",
    });
    otherTeacherToken = other.token;
    otherTeacherId = other.user._id;

    const student = await loginAs(app, {
      email: "aijob-student@test.com",
      userType: "student",
      subscriptionV2: {
        status: "active",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    studentToken = student.token;
    studentId = student.user._id;

    const studentNoSub = await loginAs(app, {
      email: "aijob-student-nosub@test.com",
      userType: "student",
      subscriptionV2: null,
    });
    studentNoSubToken = studentNoSub.token;

    const parent = await loginAs(app, {
      email: "aijob-parent@test.com",
      userType: "parent",
    });
    parentToken = parent.token;

    const cm = await loginAs(app, {
      email: "aijob-cm@test.com",
      userType: "teacher",
      staffRole: "content_manager",
    });
    cmToken = cm.token;
  }, 60000);

  beforeEach(() => {
    lessonCreateSpy = jest.spyOn(Lesson, "create");
    examCreateSpy = jest.spyOn(ExamQuestion, "create");
    if (ExamQuestionRationaleCandidate) {
      candidateCreateSpy = jest.spyOn(ExamQuestionRationaleCandidate, "create");
    }
    try {
      // eslint-disable-next-line global-require
      const OpenAI = require("openai");
      if (OpenAI?.prototype?.chat?.completions?.create) {
        openaiCreateSpy = jest
          .spyOn(OpenAI.prototype.chat.completions, "create")
          .mockRejectedValue(new Error("provider must not be called"));
      }
    } catch (_) {
      openaiCreateSpy = null;
    }
  });

  afterEach(async () => {
    await AiGenerationJob.deleteMany({});
    lessonCreateSpy.mockRestore();
    examCreateSpy.mockRestore();
    if (candidateCreateSpy) candidateCreateSpy.mockRestore();
    if (openaiCreateSpy) openaiCreateSpy.mockRestore();
  });

  afterAll(async () => {
    await User.deleteMany({ email: /aijob-.*@test\.com$/ });
    await AiGenerationJob.deleteMany({});
  });

  describe("admin routes — anonymous → 401", () => {
    test("GET list", async () => {
      await request(app).get("/api/admin/ai-generation-jobs/").expect(401);
    });
    test("GET detail", async () => {
      await request(app)
        .get(`/api/admin/ai-generation-jobs/${new mongoose.Types.ObjectId()}`)
        .expect(401);
    });
    test("POST cancel", async () => {
      await request(app)
        .post(`/api/admin/ai-generation-jobs/${new mongoose.Types.ObjectId()}/cancel`)
        .expect(401);
    });
    test("POST retry", async () => {
      await request(app)
        .post(`/api/admin/ai-generation-jobs/${new mongoose.Types.ObjectId()}/retry`)
        .expect(401);
    });
  });

  describe("admin routes — non-admin → 403", () => {
    test.each([
      ["student", () => studentToken],
      ["teacher", () => teacherToken],
      ["parent", () => parentToken],
      ["content_manager", () => cmToken],
    ])("%s denied", async (_label, tokenFn) => {
      const res = await request(app)
        .get("/api/admin/ai-generation-jobs/")
        .set("Authorization", `Bearer ${tokenFn()}`);
      expect(res.status).toBe(403);
    });
  });

  describe("admin routes — admin behaviour", () => {
    test("list and detail across users", async () => {
      const job = await seedJob({ requestedByUserId: teacherId, status: "QUEUED" });
      const list = await request(app)
        .get("/api/admin/ai-generation-jobs/")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(list.body.jobs)).toBe(true);
      expect(list.body.jobs.some((j) => String(j._id) === String(job._id))).toBe(true);

      const detail = await request(app)
        .get(`/api/admin/ai-generation-jobs/${job._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(detail.body.job.input).toEqual({ prompt: "test-input" });
    });

    test("cancel QUEUED and RUNNING", async () => {
      const queued = await seedJob({ requestedByUserId: teacherId, status: "QUEUED" });
      const running = await seedJob({
        requestedByUserId: teacherId,
        status: "RUNNING",
        startedAt: new Date(),
      });

      const c1 = await request(app)
        .post(`/api/admin/ai-generation-jobs/${queued._id}/cancel`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(c1.body.status).toBe("CANCELLED");

      const c2 = await request(app)
        .post(`/api/admin/ai-generation-jobs/${running._id}/cancel`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(c2.body.status).toBe("CANCELLED");
    });

    test("cancel terminal → 400", async () => {
      const failed = await seedJob({ requestedByUserId: teacherId, status: "FAILED" });
      const res = await request(app)
        .post(`/api/admin/ai-generation-jobs/${failed._id}/cancel`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);
      expect(res.body.error).toMatch(/cannot be cancelled/i);
    });

    test("retry FAILED → QUEUED and clears fields", async () => {
      const failed = await seedJob({
        requestedByUserId: teacherId,
        status: "FAILED",
        output: { text: "partial" },
        error: { code: "X", message: "boom" },
        startedAt: new Date(),
        finishedAt: new Date(),
      });
      const res = await request(app)
        .post(`/api/admin/ai-generation-jobs/${failed._id}/retry`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.status).toBe("QUEUED");
      const reloaded = await AiGenerationJob.findById(failed._id).lean();
      expect(reloaded.output).toBeNull();
      expect(reloaded.error?.code == null || reloaded.error?.code === null).toBe(true);
      expect(reloaded.startedAt).toBeNull();
      expect(reloaded.finishedAt).toBeNull();
    });

    test("retry non-FAILED → 400", async () => {
      const queued = await seedJob({ requestedByUserId: teacherId, status: "QUEUED" });
      await request(app)
        .post(`/api/admin/ai-generation-jobs/${queued._id}/retry`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);
    });

    test("missing job → 404", async () => {
      await request(app)
        .get(`/api/admin/ai-generation-jobs/${new mongoose.Types.ObjectId()}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);
    });

    test("malformed ID → 404", async () => {
      await request(app)
        .get("/api/admin/ai-generation-jobs/not-a-valid-objectid")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe("user routes — anonymous → 401", () => {
    test("POST create", async () => {
      await request(app)
        .post("/api/ai-generation-jobs/")
        .send({ type: "LESSON_DRAFT", input: {} })
        .expect(401);
    });
    test("GET list", async () => {
      await request(app).get("/api/ai-generation-jobs/").expect(401);
    });
    test("GET detail", async () => {
      await request(app)
        .get(`/api/ai-generation-jobs/${new mongoose.Types.ObjectId()}`)
        .expect(401);
    });
    test("POST cancel", async () => {
      await request(app)
        .post(`/api/ai-generation-jobs/${new mongoose.Types.ObjectId()}/cancel`)
        .expect(401);
    });
  });

  describe("user routes — ownership and subscription", () => {
    test("list only own jobs; no cross-user leak", async () => {
      const mine = await seedJob({ requestedByUserId: teacherId, status: "QUEUED" });
      await seedJob({ requestedByUserId: otherTeacherId, status: "QUEUED" });

      const res = await request(app)
        .get("/api/ai-generation-jobs/")
        .set("Authorization", `Bearer ${teacherToken}`)
        .expect(200);
      expect(res.body.jobs).toHaveLength(1);
      expect(String(res.body.jobs[0]._id)).toBe(String(mine._id));
    });

    test("owner can read; other user gets 404", async () => {
      const job = await seedJob({ requestedByUserId: teacherId, status: "QUEUED" });
      await request(app)
        .get(`/api/ai-generation-jobs/${job._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .expect(200);
      await request(app)
        .get(`/api/ai-generation-jobs/${job._id}`)
        .set("Authorization", `Bearer ${otherTeacherToken}`)
        .expect(404);
    });

    test("owner cancel eligible; other user 404; terminal blocked", async () => {
      const queued = await seedJob({ requestedByUserId: teacherId, status: "QUEUED" });
      await request(app)
        .post(`/api/ai-generation-jobs/${queued._id}/cancel`)
        .set("Authorization", `Bearer ${otherTeacherToken}`)
        .expect(404);

      const ok = await request(app)
        .post(`/api/ai-generation-jobs/${queued._id}/cancel`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .expect(200);
      expect(ok.body.status).toBe("CANCELLED");

      const terminal = await seedJob({
        requestedByUserId: teacherId,
        status: "SUCCEEDED",
      });
      await request(app)
        .post(`/api/ai-generation-jobs/${terminal._id}/cancel`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .expect(400);
    });

    test("malformed ID → 404", async () => {
      await request(app)
        .get("/api/ai-generation-jobs/not-a-valid-objectid")
        .set("Authorization", `Bearer ${teacherToken}`)
        .expect(404);
    });

    test("teacher create bypasses subscription; owner from auth not body", async () => {
      const res = await request(app)
        .post("/api/ai-generation-jobs/")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          type: "LESSON_DRAFT",
          input: { x: 1 },
          requestedByUserId: otherTeacherId,
        })
        .expect(201);
      const created = await AiGenerationJob.findById(res.body.jobId).lean();
      expect(String(created.requestedByUserId)).toBe(String(teacherId));
      expect(String(created.requestedByUserId)).not.toBe(String(otherTeacherId));
    });

    test("student without subscription → 403; with subscription → 201", async () => {
      await request(app)
        .post("/api/ai-generation-jobs/")
        .set("Authorization", `Bearer ${studentNoSubToken}`)
        .send({ type: "LESSON_DRAFT", input: {} })
        .expect(403);

      const res = await request(app)
        .post("/api/ai-generation-jobs/")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ type: "LESSON_DRAFT", input: {} })
        .expect(201);
      const created = await AiGenerationJob.findById(res.body.jobId).lean();
      expect(String(created.requestedByUserId)).toBe(String(studentId));
    });
  });

  describe("public alias under /api/admin/ai-generation-jobs/public", () => {
    test("anonymous → 401", async () => {
      await request(app).get("/api/admin/ai-generation-jobs/public/").expect(401);
    });

    test("authenticated owner rules — not admin-all visibility", async () => {
      const mine = await seedJob({ requestedByUserId: teacherId, status: "QUEUED" });
      await seedJob({ requestedByUserId: otherTeacherId, status: "QUEUED" });

      const list = await request(app)
        .get("/api/admin/ai-generation-jobs/public/")
        .set("Authorization", `Bearer ${teacherToken}`)
        .expect(200);
      expect(list.body.jobs).toHaveLength(1);
      expect(String(list.body.jobs[0]._id)).toBe(String(mine._id));

      await request(app)
        .get(`/api/admin/ai-generation-jobs/public/${mine._id}`)
        .set("Authorization", `Bearer ${otherTeacherToken}`)
        .expect(404);
    });
  });

  describe("no unrelated mutations / provider", () => {
    test("admin cancel does not write Lesson/ExamQuestion/Candidate or call OpenAI", async () => {
      const job = await seedJob({ requestedByUserId: teacherId, status: "QUEUED" });
      await request(app)
        .post(`/api/admin/ai-generation-jobs/${job._id}/cancel`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(lessonCreateSpy).not.toHaveBeenCalled();
      expect(examCreateSpy).not.toHaveBeenCalled();
      if (candidateCreateSpy) expect(candidateCreateSpy).not.toHaveBeenCalled();
      if (openaiCreateSpy) expect(openaiCreateSpy).not.toHaveBeenCalled();
    });
  });
});
