/**
 * Integration tests for POST /api/visual-explanations/generate
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");

jest.setTimeout(15000);

describe("POST /api/visual-explanations/generate", () => {
  let teacherToken;
  let studentToken;
  let prevFlag;
  let prevDisableOpenAi;

  beforeAll(async () => {
    prevFlag = process.env.VISUAL_EXPLANATION_ENABLED;
    prevDisableOpenAi = process.env.DISABLE_OPENAI;
    process.env.VISUAL_EXPLANATION_ENABLED = "1";

    const hashedPassword = await bcrypt.hash("password123", 10);

    const teacher = await User.create({
      email: "visual-explain-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
      firstName: "V",
      lastName: "Teacher",
    });
    const teacherLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: teacher.email, password: "password123" });
    teacherToken = teacherLogin.body?.token;
    if (!teacherToken) throw new Error("Teacher login failed");

    const student = await User.create({
      email: "visual-explain-student@test.com",
      password: hashedPassword,
      userType: "student",
      firstName: "V",
      lastName: "Student",
    });
    const studentLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: student.email, password: "password123" });
    studentToken = studentLogin.body?.token;
    if (!studentToken) throw new Error("Student login failed");
  });

  afterAll(async () => {
    await User.deleteMany({
      email: { $in: ["visual-explain-teacher@test.com", "visual-explain-student@test.com"] },
    });
    if (prevFlag === undefined) delete process.env.VISUAL_EXPLANATION_ENABLED;
    else process.env.VISUAL_EXPLANATION_ENABLED = prevFlag;
    if (prevDisableOpenAi === undefined) delete process.env.DISABLE_OPENAI;
    else process.env.DISABLE_OPENAI = prevDisableOpenAi;
  });

  test("401 without auth", async () => {
    const res = await request(app)
      .post("/api/visual-explanations/generate")
      .send({ topic: "The eye" });
    expect(res.status).toBe(401);
  });

  test("401 with invalid bearer", async () => {
    const res = await request(app)
      .post("/api/visual-explanations/generate")
      .set("Authorization", "Bearer obviously-broken")
      .send({ topic: "The eye" });
    expect(res.status).toBe(401);
  });

  test("403 for student user", async () => {
    const res = await request(app)
      .post("/api/visual-explanations/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ topic: "The eye" });
    expect(res.status).toBe(403);
  });

  test("422 for empty topic (teacher)", async () => {
    const res = await request(app)
      .post("/api/visual-explanations/generate")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "" });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("INVALID_VISUAL_EXPLANATION");
  });

  test("404 when feature flag is off", async () => {
    const prev = process.env.VISUAL_EXPLANATION_ENABLED;
    process.env.VISUAL_EXPLANATION_ENABLED = "0";
    try {
      const res = await request(app)
        .post("/api/visual-explanations/generate")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({ topic: "The eye" });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("FEATURE_DISABLED");
    } finally {
      process.env.VISUAL_EXPLANATION_ENABLED = prev;
    }
  });

  test("503 when DISABLE_OPENAI=1", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/visual-explanations/generate")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({ topic: "The eye" });
      expect(res.status).toBe(503);
      expect(res.body._disabled).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });

  test("GET /api/feature-flags/visual-explanation returns enabled state", async () => {
    const res = await request(app)
      .get("/api/feature-flags/visual-explanation")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.enabled).toBe("boolean");
    expect(res.body.enabled).toBe(true);
  });
});
