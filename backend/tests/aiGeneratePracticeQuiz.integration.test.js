/**
 * Step 3 (LLM Roadmap): POST /api/ai/generate-practice-quiz — inbuilt tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");

jest.setTimeout(20000);

describe("POST /api/ai/generate-practice-quiz", () => {
  let studentToken;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash("password123", 10);
    const student = await User.create({
      email: "generate-quiz-student@test.com",
      password: hashedPassword,
      userType: "student",
      firstName: "S",
      lastName: "T",
    });
    const login = await request(app).post("/api/auth/login").send({ email: student.email, password: "password123" });
    studentToken = login.body?.token;
    if (!studentToken) throw new Error("Login failed");
  });

  afterAll(async () => {
    await User.deleteMany({ email: "generate-quiz-student@test.com" });
  });

  test("401 without auth", async () => {
    const res = await request(app).post("/api/ai/generate-practice-quiz").send({ topic: "Cell structure" });
    expect(res.status).toBe(401);
  });

  test("400 when topic is missing", async () => {
    const res = await request(app)
      .post("/api/ai/generate-practice-quiz")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/topic is required/i);
  });

  test("400 when topic is empty string", async () => {
    const res = await request(app)
      .post("/api/ai/generate-practice-quiz")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ topic: "   " });
    expect(res.status).toBe(400);
  });

  test("400 when topic exceeds max length", async () => {
    const long = "x".repeat(201);
    const res = await request(app)
      .post("/api/ai/generate-practice-quiz")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ topic: long });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/200/);
  });

  test("200 with DISABLE_OPENAI=1 returns stub questions", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/ai/generate-practice-quiz")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ topic: "Photosynthesis" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("questions");
      expect(Array.isArray(res.body.questions)).toBe(true);
      expect(res.body.questions.length).toBeGreaterThanOrEqual(1);
      expect(res.body._disabled).toBe(true);
      const q = res.body.questions[0];
      expect(q).toHaveProperty("id");
      expect(q).toHaveProperty("type");
      expect(["mcq", "short"]).toContain(q.type);
      expect(q).toHaveProperty("question");
      expect(q).toHaveProperty("correctAnswer");
      expect(q).toHaveProperty("marks");
      if (q.type === "mcq") expect(Array.isArray(q.options)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });

  test("200 with numQuestions returns that many stub questions", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/ai/generate-practice-quiz")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ topic: "Enzymes", numQuestions: 3 });
      expect(res.status).toBe(200);
      expect(res.body.questions.length).toBe(3);
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });

  test("200 accepts subject and level", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/ai/generate-practice-quiz")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ topic: "Respiration", subject: "Biology", level: "A-Level" });
      expect(res.status).toBe(200);
      expect(res.body.questions.length).toBeGreaterThanOrEqual(1);
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });
});
