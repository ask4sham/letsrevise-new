/**
 * Step 4 (LLM Roadmap): POST /api/ai/ask (RAG) — inbuilt tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const LessonRAGChunk = require("../models/LessonRAGChunk");

jest.setTimeout(20000);

describe("POST /api/ai/ask", () => {
  let teacherToken;
  let lessonId;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash("password123", 10);
    const teacher = await User.create({
      email: "rag-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
      firstName: "T",
      lastName: "RAG",
    });
    const login = await request(app).post("/api/auth/login").send({ email: teacher.email, password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    const lesson = await Lesson.create({
      title: "RAG Test Lesson",
      description: "For RAG tests",
      content: "Photosynthesis is the process by which plants make glucose using light.\n\nChlorophyll absorbs light energy.",
      teacherId: teacher._id,
      teacherName: "T RAG",
      subject: "Biology",
      level: "GCSE",
      topic: "Bioenergetics",
      status: "draft",
      pages: [
        {
          pageId: "p1",
          title: "Intro",
          order: 0,
          blocks: [
            { type: "text", content: "Plants use sunlight to make food in the form of glucose." },
          ],
        },
      ],
    });
    lessonId = lesson._id.toString();
  });

  afterAll(async () => {
    await LessonRAGChunk.deleteMany({ lessonId: new mongoose.Types.ObjectId(lessonId) });
    await Lesson.deleteMany({ title: "RAG Test Lesson" });
    await User.deleteMany({ email: "rag-teacher@test.com" });
  });

  test("401 without auth", async () => {
    const res = await request(app).post("/api/ai/ask").send({ question: "What is photosynthesis?", lessonId });
    expect(res.status).toBe(401);
  });

  test("400 when question is missing", async () => {
    const res = await request(app)
      .post("/api/ai/ask")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ lessonId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/question is required/i);
  });

  test("400 when question is empty", async () => {
    const res = await request(app)
      .post("/api/ai/ask")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ question: "   ", lessonId });
    expect(res.status).toBe(400);
  });

  test("400 when lessonId is missing", async () => {
    const res = await request(app)
      .post("/api/ai/ask")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ question: "What is photosynthesis?" });
    expect(res.status).toBe(400);
  });

  test("404 when lesson does not exist", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post("/api/ai/ask")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ question: "What is photosynthesis?", lessonId: fakeId.toString() });
    expect(res.status).toBe(404);
  });

  test("200 with DISABLE_OPENAI=1 returns stub answer", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/ai/ask")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({ question: "What is photosynthesis?", lessonId });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("answer");
      expect(res.body.answer).toBeTruthy();
      expect(res.body._disabled).toBe(true);
      const count = await LessonRAGChunk.countDocuments({ lessonId: new mongoose.Types.ObjectId(lessonId) });
      expect(count).toBeGreaterThan(0);
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });
});
