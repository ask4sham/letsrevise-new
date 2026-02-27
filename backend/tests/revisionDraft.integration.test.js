/**
 * Phase 9E — AI revision pipeline: generate into draft, GET/PUT/apply (draft-only visibility).
 */
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const LessonRevisionDraft = require("../models/LessonRevisionDraft");
const bcrypt = require("bcryptjs");

describe("Phase 9E revision draft pipeline", () => {
  let teacherId;
  let lessonId;
  let tokenTeacher;
  let tokenStudent;
  const hashedPassword = bcrypt.hashSync("password123", 10);

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Phase9E",
      lastName: "Teacher",
      email: "phase9e-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const student = await User.create({
      firstName: "Phase9E",
      lastName: "Student",
      email: "phase9e-student@test.com",
      password: hashedPassword,
      userType: "student",
    });

    const lesson = await Lesson.create({
      title: "Phase9E Lesson",
      description: "Desc",
      content: "Content",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "draft",
      isPublished: false,
      pages: [
        { pageId: "p1", order: 0, blocks: [{ type: "text", content: "Some content here" }] },
      ],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonId = lesson._id;

    const login = (email) =>
      request(app).post("/api/auth/login").send({ email, password: "password123" }).then((r) => r.body.token);
    tokenTeacher = await login("phase9e-teacher@test.com");
    tokenStudent = await login("phase9e-student@test.com");
  });

  test("generate-revision creates draft (owner)", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/generate-revision`)
      .set("Authorization", `Bearer ${tokenTeacher}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.draft).toBeDefined();
    expect(res.body.draft.status).toBe("draft");
    expect(Array.isArray(res.body.draft.flashcards)).toBe(true);
    expect(res.body.draft.flashcards.length).toBeGreaterThanOrEqual(1);
    expect(res.body.draft.quiz).toBeDefined();
    expect(Array.isArray(res.body.draft.quiz.questions)).toBe(true);
  });

  test("Phase 9F: allowlist disabled → draft has engine telemetry (STUB/heuristic)", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/generate-revision`)
      .set("Authorization", `Bearer ${tokenTeacher}`);
    expect(res.status).toBe(200);
    expect(res.body.draft.engine).toBeDefined();
    expect(["STUB", "COMPLETED"]).toContain(res.body.draft.engine.status);
    if (res.body.draft.engine.status === "STUB") {
      expect(res.body.draft.engine.errorCode).toBeDefined();
    }
  });

  test("GET revision-draft returns draft (owner)", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}/revision-draft`)
      .set("Authorization", `Bearer ${tokenTeacher}`);
    expect(res.status).toBe(200);
    expect(res.body.lessonId).toBeDefined();
    expect(res.body.status).toBe("draft");
    expect(res.body.flashcards).toBeDefined();
    expect(res.body.quiz).toBeDefined();
  });

  test("student cannot GET revision-draft (403)", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}/revision-draft`)
      .set("Authorization", `Bearer ${tokenStudent}`);
    expect(res.status).toBe(403);
  });

  test("apply draft copies to lesson", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/revision-draft/apply`)
      .set("Authorization", `Bearer ${tokenTeacher}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.lesson.flashcardsCount).toBeGreaterThanOrEqual(1);
    const lesson = await Lesson.findById(lessonId).lean();
    expect(lesson.flashcards.length).toBeGreaterThanOrEqual(1);
    const draft = await LessonRevisionDraft.findOne({ lessonId }).lean();
    expect(draft.status).toBe("applied");
  });

  test("apply again returns 409 DRAFT_ALREADY_APPLIED", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/revision-draft/apply`)
      .set("Authorization", `Bearer ${tokenTeacher}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DRAFT_ALREADY_APPLIED");
  });
});

describe("Phase 9E apply to published lesson", () => {
  let teacherId;
  let publishedLessonId;
  let tokenTeacher;
  const hashedPassword = bcrypt.hashSync("password123", 10);

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Pub",
      lastName: "Teacher",
      email: "phase9e-pub@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const lesson = await Lesson.create({
      title: "Published Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Bio",
      level: "GCSE",
      topic: "T",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "x" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    publishedLessonId = lesson._id;
    const res = await request(app).post("/api/auth/login").send({ email: "phase9e-pub@test.com", password: "password123" });
    tokenTeacher = res.body.token;
  });

  test("apply to published lesson returns 409 EDIT_PUBLISHED", async () => {
    await request(app)
      .post(`/api/lessons/${publishedLessonId}/generate-revision`)
      .set("Authorization", `Bearer ${tokenTeacher}`);
    const res = await request(app)
      .post(`/api/lessons/${publishedLessonId}/revision-draft/apply`)
      .set("Authorization", `Bearer ${tokenTeacher}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EDIT_PUBLISHED");
  });
});

describe("Phase 9F REVISION_NO_FALLBACK", () => {
  let tokenTeacher;
  let lessonId;
  const hashedPassword = bcrypt.hashSync("password123", 10);

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "NoFallback",
      lastName: "Teacher",
      email: "phase9f-nofallback@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const lesson = await Lesson.create({
      title: "No Fallback Lesson",
      description: "D",
      content: "C",
      teacherId: teacher._id,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "T",
      status: "draft",
      isPublished: false,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "x" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonId = lesson._id;
    const res = await request(app).post("/api/auth/login").send({ email: "phase9f-nofallback@test.com", password: "password123" });
    tokenTeacher = res.body.token;
  });

  test("REVISION_NO_FALLBACK=1 and allowlist disabled → 503 REVISION_ENGINE_UNAVAILABLE with errorCode", async () => {
    const prev = process.env.REVISION_NO_FALLBACK;
    process.env.REVISION_NO_FALLBACK = "1";
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/generate-revision`)
      .set("Authorization", `Bearer ${tokenTeacher}`);
    if (prev !== undefined) process.env.REVISION_NO_FALLBACK = prev;
    else delete process.env.REVISION_NO_FALLBACK;
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("REVISION_ENGINE_UNAVAILABLE");
    expect(res.body.errorCode).toBeDefined();
  });
});

describe("Phase 9E kill-switch", () => {
  let tokenTeacher;
  let lessonId;
  const hashedPassword = bcrypt.hashSync("password123", 10);

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Kill",
      lastName: "Switch",
      email: "phase9e-kill@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const lesson = await Lesson.create({
      title: "Kill Switch Lesson",
      description: "D",
      content: "C",
      teacherId: teacher._id,
      teacherName: "T",
      subject: "Bio",
      level: "GCSE",
      topic: "T",
      status: "draft",
      isPublished: false,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "x" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonId = lesson._id;
    const res = await request(app).post("/api/auth/login").send({ email: "phase9e-kill@test.com", password: "password123" });
    tokenTeacher = res.body.token;
  });

  test("DISABLE_AI_REVISION_GENERATION=1 returns 503", async () => {
    const prev = process.env.DISABLE_AI_REVISION_GENERATION;
    process.env.DISABLE_AI_REVISION_GENERATION = "1";
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/generate-revision`)
      .set("Authorization", `Bearer ${tokenTeacher}`);
    if (prev !== undefined) process.env.DISABLE_AI_REVISION_GENERATION = prev;
    else delete process.env.DISABLE_AI_REVISION_GENERATION;
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("REVISION_GENERATION_DISABLED");
  });
});

describe("PR-CONTENT-TARGETING-1: generate-revision requires valid topicKey", () => {
  let teacherId;
  let lessonNoTopicId;
  let tokenTeacher;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "ContentTarget",
      lastName: "Teacher",
      email: "content-target-teacher@test.com",
      password: bcrypt.hashSync("password123", 10),
      userType: "teacher",
    });
    teacherId = teacher._id;
    const lesson = await Lesson.create({
      title: "Lesson without topic",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: null,
      topicKey: null,
      status: "draft",
      isPublished: false,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "x" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonNoTopicId = lesson._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "content-target-teacher@test.com", password: "password123" });
    tokenTeacher = login.body.token;
  });

  test("generate-revision returns 400 when lesson has no topicKey", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonNoTopicId}/generate-revision`)
      .set("Authorization", `Bearer ${tokenTeacher}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(String(res.body.error)).toMatch(/topicKey|syllabus topic/i);
  });
});

describe("PR-CONTENT-TARGETING-1: generate-revision rejects wrong topicKey prefix", () => {
  let lessonId;
  let tokenTeacher;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Bio",
      lastName: "Teacher",
      email: "content-target-bio@test.com",
      password: bcrypt.hashSync("password123", 10),
      userType: "teacher",
    });
    const lesson = await Lesson.create({
      title: "Biology lesson",
      description: "D",
      content: "C",
      teacherId: teacher._id,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Cell structure",
      topicKey: "aqa-gcse-biology:cell-structure",
      status: "draft",
      isPublished: false,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "x" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonId = lesson._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "content-target-bio@test.com", password: "password123" });
    tokenTeacher = login.body.token;
  });

  test("generate-revision returns 400 when body topicKey has wrong spec prefix", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/generate-revision`)
      .set("Authorization", `Bearer ${tokenTeacher}`)
      .send({ topicKey: "other-spec:cell-structure" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
