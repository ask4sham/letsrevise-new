/**
 * Integration tests for POST /api/ai/generate-diagram (context-aware diagram generation).
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

jest.setTimeout(15000);

describe("POST /api/ai/generate-diagram", () => {
  let teacherToken;
  let teacherId;
  let lessonId;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash("password123", 10);
    const teacher = await User.create({
      email: "diagram-gen-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
      firstName: "D",
      lastName: "Gen",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: teacher.email, password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    const lesson = await Lesson.create({
      title: "Diagram gen test lesson",
      description: "For generate-diagram tests",
      content: "Structured lesson (see pages)",
      teacherId: teacher._id,
      teacherName: "D Gen",
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
          blocks: [
            { type: "text", content: "Eukaryotic cells have a nucleus and mitochondria." },
            { type: "diagram", caption: "" },
          ],
        },
      ],
    });
    lessonId = lesson._id.toString();
  });

  afterAll(async () => {
    await Lesson.deleteMany({ title: "Diagram gen test lesson" });
    await User.deleteMany({ email: "diagram-gen-teacher@test.com" });
  });

  test("401 without auth", async () => {
    const res = await request(app)
      .post("/api/ai/generate-diagram")
      .send({ lessonId, pageIndex: 0, blockIndex: 1 });
    expect(res.status).toBe(401);
  });

  test("503 when DISABLE_OPENAI=1", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/ai/generate-diagram")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({ lessonId, pageIndex: 0, blockIndex: 1 });
      expect(res.status).toBe(503);
      expect(res.body._disabled).toBe(true);
      expect(res.body.error).toMatch(/disabled/i);
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });

  test("400 when lessonId invalid", async () => {
    if (process.env.DISABLE_OPENAI === "1") return;
    const res = await request(app)
      .post("/api/ai/generate-diagram")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ lessonId: "invalid", pageIndex: 0, blockIndex: 0 });
    expect(res.status).toBe(400);
  });

  test("404 when lesson not found", async () => {
    if (process.env.DISABLE_OPENAI === "1") return;
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post("/api/ai/generate-diagram")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ lessonId: fakeId.toString(), pageIndex: 0, blockIndex: 0 });
    expect(res.status).toBe(404);
  });
});
