/**
 * Step 5 (LLM Roadmap): POST /api/ai/summarise — inbuilt tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

jest.setTimeout(20000);

describe("POST /api/ai/summarise", () => {
  let teacherToken;
  let lessonId;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash("password123", 10);
    const teacher = await User.create({
      email: "summarise-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
      firstName: "T",
      lastName: "Sum",
    });
    const login = await request(app).post("/api/auth/login").send({ email: teacher.email, password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    const lesson = await Lesson.create({
      title: "Summarise Test Lesson",
      description: "For summarise tests",
      content: "Photosynthesis is the process by which plants use light energy to make glucose and oxygen. Chlorophyll in the chloroplasts absorbs light. This is essential for life on Earth.",
      teacherId: teacher._id,
      teacherName: "T Sum",
      subject: "Biology",
      level: "GCSE",
      topic: "Bioenergetics",
      status: "draft",
      pages: [{ pageId: "p1", title: "Intro", order: 0, blocks: [{ type: "text", content: "Plants need light to make their food." }] }],
    });
    lessonId = lesson._id.toString();
  });

  afterAll(async () => {
    await Lesson.deleteMany({ title: "Summarise Test Lesson" });
    await User.deleteMany({ email: "summarise-teacher@test.com" });
  });

  test("401 without auth", async () => {
    const res = await request(app).post("/api/ai/summarise").send({ lessonId });
    expect(res.status).toBe(401);
  });

  test("400 when lessonId is missing", async () => {
    const res = await request(app)
      .post("/api/ai/summarise")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test("404 when lesson does not exist", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post("/api/ai/summarise")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ lessonId: fakeId.toString() });
    expect(res.status).toBe(404);
  });

  test("200 with DISABLE_OPENAI=1 returns stub summary and keyPoints", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/ai/summarise")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({ lessonId });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("summary");
      expect(res.body).toHaveProperty("keyPoints");
      expect(Array.isArray(res.body.keyPoints)).toBe(true);
      expect(res.body._disabled).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });
});
