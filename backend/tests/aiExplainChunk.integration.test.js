/**
 * Step 1 (LLM Roadmap): POST /api/ai/explain-chunk — inbuilt tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");

jest.setTimeout(20000);

describe("POST /api/ai/explain-chunk", () => {
  let studentToken;
  let teacherToken;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash("password123", 10);
    const [student, teacher] = await Promise.all([
      User.create({
        email: "explain-student@test.com",
        password: hashedPassword,
        userType: "student",
        firstName: "S",
        lastName: "T",
      }),
      User.create({
        email: "explain-teacher@test.com",
        password: hashedPassword,
        userType: "teacher",
        firstName: "T",
        lastName: "E",
      }),
    ]);
    const studentLogin = await request(app).post("/api/auth/login").send({ email: student.email, password: "password123" });
    const teacherLogin = await request(app).post("/api/auth/login").send({ email: teacher.email, password: "password123" });
    studentToken = studentLogin.body?.token;
    teacherToken = teacherLogin.body?.token;
    if (!studentToken || !teacherToken) throw new Error("Login failed");
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ["explain-student@test.com", "explain-teacher@test.com"] } });
  });

  test("401 without auth", async () => {
    const res = await request(app).post("/api/ai/explain-chunk").send({ text: "Mitochondria produce ATP." });
    expect(res.status).toBe(401);
  });

  test("400 when text is missing", async () => {
    const res = await request(app)
      .post("/api/ai/explain-chunk")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/text is required/i);
  });

  test("400 when text is empty", async () => {
    const res = await request(app)
      .post("/api/ai/explain-chunk")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ text: "   " });
    expect(res.status).toBe(400);
  });

  test("400 when text exceeds max length", async () => {
    const long = "x".repeat(4001);
    const res = await request(app)
      .post("/api/ai/explain-chunk")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ text: long });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/4000/);
  });

  test("200 with DISABLE_OPENAI=1 returns stub (student)", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/ai/explain-chunk")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ text: "Mitochondria are the powerhouse of the cell." });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("explanation");
      expect(res.body.explanation).toBeTruthy();
      expect(res.body._disabled).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });

  test("200 with DISABLE_OPENAI=1 accepts level and subject (teacher)", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/ai/explain-chunk")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({ text: "The Krebs cycle.", level: "A-Level", subject: "Biology" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("explanation");
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });
});
