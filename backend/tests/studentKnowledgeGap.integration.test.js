/**
 * Step 6 (LLM Roadmap): GET /api/student/knowledge-gap — weak areas + revision focus summary.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const PracticeAttempt = require("../models/PracticeAttempt");

jest.setTimeout(20000);

describe("GET /api/student/knowledge-gap", () => {
  let studentToken;
  let teacherId;
  let studentId;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash("password123", 10);
    const [teacher, student] = await Promise.all([
      User.create({
        email: "kg-teacher@test.com",
        password: hashedPassword,
        userType: "teacher",
        firstName: "T",
        lastName: "K",
      }),
      User.create({
        email: "kg-student@test.com",
        password: hashedPassword,
        userType: "student",
        firstName: "S",
        lastName: "K",
      }),
    ]);
    teacherId = teacher._id;
    studentId = student._id;
    const login = await request(app).post("/api/auth/login").send({ email: student.email, password: "password123" });
    studentToken = login.body?.token;
    if (!studentToken) throw new Error("Login failed");
  });

  afterAll(async () => {
    await PracticeAttempt.deleteMany({ studentId });
    await User.deleteMany({ email: { $in: ["kg-teacher@test.com", "kg-student@test.com"] } });
  });

  test("401 without auth", async () => {
    const res = await request(app).get("/api/student/knowledge-gap");
    expect(res.status).toBe(401);
  });

  test("403 when not a student", async () => {
    const teacherLogin = await request(app).post("/api/auth/login").send({
      email: "kg-teacher@test.com",
      password: "password123",
    });
    const token = teacherLogin.body?.token;
    const res = await request(app).get("/api/student/knowledge-gap").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("200 returns summary and weakAreas (no data)", async () => {
    const res = await request(app)
      .get("/api/student/knowledge-gap")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summary");
    expect(res.body).toHaveProperty("weakAreas");
    expect(Array.isArray(res.body.weakAreas)).toBe(true);
  });

  test("200 with DISABLE_OPENAI=1 and weak practice data returns stub summary", async () => {
    const dummyId = new mongoose.Types.ObjectId();
    await PracticeAttempt.create([
      { studentId, teacherId, specKey: "aqa-gcse-biology", topicKey: "cell-structure", sourceType: "examQuestion", sourceId: dummyId, outcome: "wrong" },
      { studentId, teacherId, specKey: "aqa-gcse-biology", topicKey: "cell-structure", sourceType: "examQuestion", sourceId: dummyId, outcome: "correct" },
      { studentId, teacherId, specKey: "aqa-gcse-biology", topicKey: "cell-structure", sourceType: "examQuestion", sourceId: dummyId, outcome: "wrong" },
    ]);
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .get("/api/student/knowledge-gap")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.summary).toBeTruthy();
      expect(Array.isArray(res.body.weakAreas)).toBe(true);
      expect(res.body._disabled).toBe(true);
      const cell = res.body.weakAreas.find((w) => w.topicKey === "cell-structure");
      expect(cell).toBeDefined();
      expect(cell.total).toBe(3);
      expect(cell.correct).toBe(1);
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
      await PracticeAttempt.deleteMany({ studentId, topicKey: "cell-structure" });
    }
  });
});
