/**
 * Step 2 (LLM Roadmap): POST /api/ai/explain-mistake — inbuilt tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");

jest.setTimeout(20000);

describe("POST /api/ai/explain-mistake", () => {
  let studentToken;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash("password123", 10);
    const student = await User.create({
      email: "explain-mistake-student@test.com",
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
    await User.deleteMany({ email: "explain-mistake-student@test.com" });
  });

  test("401 without auth", async () => {
    const res = await request(app).post("/api/ai/explain-mistake").send({
      questionText: "What is the function of mitochondria?",
      userAnswer: "To make protein",
      correctAnswer: "To produce ATP (energy).",
    });
    expect(res.status).toBe(401);
  });

  test("400 when questionText is missing", async () => {
    const res = await request(app)
      .post("/api/ai/explain-mistake")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ userAnswer: "X", correctAnswer: "Y" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/questionText is required/i);
  });

  test("400 when correctAnswer is missing", async () => {
    const res = await request(app)
      .post("/api/ai/explain-mistake")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ questionText: "What is X?", userAnswer: "Y" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/correctAnswer is required/i);
  });

  test("400 when questionText exceeds max length", async () => {
    const long = "x".repeat(2001);
    const res = await request(app)
      .post("/api/ai/explain-mistake")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ questionText: long, userAnswer: "A", correctAnswer: "B" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2000/);
  });

  test("200 with DISABLE_OPENAI=1 returns stub", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/ai/explain-mistake")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          questionText: "What is the function of mitochondria?",
          userAnswer: "To make protein",
          correctAnswer: "To produce ATP (energy).",
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("explanation");
      expect(res.body.explanation).toBeTruthy();
      expect(res.body._disabled).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });

  test("200 with DISABLE_OPENAI=1 accepts topic, level, subject, markScheme", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/ai/explain-mistake")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          questionText: "Describe photosynthesis.",
          userAnswer: "Plants eat soil.",
          correctAnswer: "Plants use light to make glucose and oxygen.",
          topic: "Bioenergetics",
          level: "A-Level",
          subject: "Biology",
          markScheme: ["Light energy", "Chlorophyll", "Glucose and O2"],
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("explanation");
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });
});
