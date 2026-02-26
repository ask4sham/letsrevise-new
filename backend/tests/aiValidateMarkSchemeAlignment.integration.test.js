/**
 * Integration tests for POST /api/ai/validate-mark-scheme-alignment (Algorithm 2).
 * With DISABLE_OPENAI=1 validator returns alignmentScore 100 and empty lists.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

jest.setTimeout(15000);

describe("POST /api/ai/validate-mark-scheme-alignment", () => {
  let teacherToken;
  let teacherId;
  let lessonId;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash("password123", 10);
    const teacher = await User.create({
      email: "ms-align-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
      firstName: "MS",
      lastName: "Align",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: teacher.email, password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    const lesson = await Lesson.create({
      title: "Mark scheme alignment test lesson",
      description: "For validator tests",
      content: "Structured lesson (see pages)",
      teacherId: teacher._id,
      teacherName: "MS Align",
      subject: "Biology",
      level: "GCSE",
      topic: "Cell structure",
      board: "AQA",
      status: "draft",
      pages: [
        {
          pageId: "p1",
          title: "Intro",
          order: 1,
          blocks: [{ type: "text", content: "Eukaryotic cells have a nucleus and mitochondria." }],
        },
      ],
    });
    lessonId = lesson._id.toString();
  });

  afterAll(async () => {
    await Lesson.deleteMany({ title: "Mark scheme alignment test lesson" });
    await User.deleteMany({ email: "ms-align-teacher@test.com" });
  });

  test("401 without auth", async () => {
    const res = await request(app)
      .post("/api/ai/validate-mark-scheme-alignment")
      .send({ lessonId });
    expect(res.status).toBe(401);
  });

  test("400 when neither lessonId nor (content, specKey, topicKey) provided", async () => {
    const res = await request(app)
      .post("/api/ai/validate-mark-scheme-alignment")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lessonId|content.*specKey.*topicKey/i);
  });

  test("400 when only content without specKey/topicKey", async () => {
    const res = await request(app)
      .post("/api/ai/validate-mark-scheme-alignment")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ content: "Some text", specKey: "aqa-gcse-biology" });
    expect(res.status).toBe(400);
  });

  test("404 when lessonId is not found", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post("/api/ai/validate-mark-scheme-alignment")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ lessonId: fakeId.toString() });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test("200 with lessonId when DISABLE_OPENAI=1 returns alignment result", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/ai/validate-mark-scheme-alignment")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({ lessonId });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.alignmentScore).toBeDefined();
      expect(res.body.missingPoints).toBeDefined();
      expect(res.body.suggestions).toBeDefined();
      expect(Array.isArray(res.body.missingPoints)).toBe(true);
      expect(Array.isArray(res.body.suggestions)).toBe(true);
      expect(res.body.alignmentScore).toBe(100);
      expect(res.body.missingPoints).toEqual([]);
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });

  test("200 with content + specKey + topicKey (teacher) when DISABLE_OPENAI=1", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/ai/validate-mark-scheme-alignment")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          content: "Photosynthesis is the process by which plants make glucose using light.",
          specKey: "aqa-gcse-biology",
          topicKey: "photosynthesis",
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.alignmentScore).toBeDefined();
      expect(res.body.missingPoints).toBeDefined();
      expect(res.body.suggestions).toBeDefined();
      expect(res.body.alignmentScore).toBe(100);
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });
});
