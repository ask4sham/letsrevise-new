/**
 * PR-PRACTICE-LOOP-1 Slice 1: GET /api/teacher/analytics/topic-performance — grouping, accuracy, sort by lowest first.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const PracticeAttempt = require("../models/PracticeAttempt");

jest.setTimeout(20000);

describe("GET /api/teacher/analytics/topic-performance", () => {
  let teacherToken;
  let teacherId;
  let studentId;

  beforeAll(async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    const [teacher, student] = await Promise.all([
      User.create({
        email: "analytics-teacher@test.com",
        password: pw,
        firstName: "T",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: "analytics-student@test.com",
        password: pw,
        firstName: "S",
        lastName: "Student",
        userType: "student",
      }),
    ]);
    teacherId = teacher._id;
    studentId = student._id;

    const login = await request(app).post("/api/auth/login").send({
      email: "analytics-teacher@test.com",
      password: "Pass123!",
    });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Teacher login failed");
  });

  afterAll(async () => {
    await PracticeAttempt.deleteMany({ teacherId });
  });

  test("returns 400 when specKey missing", async () => {
    const res = await request(app)
      .get("/api/teacher/analytics/topic-performance")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/specKey/i);
  });

  test("returns 403 when not teacher", async () => {
    const studentLogin = await request(app).post("/api/auth/login").send({
      email: "analytics-student@test.com",
      password: "Pass123!",
    });
    const studentToken = studentLogin.body?.token;
    const res = await request(app)
      .get("/api/teacher/analytics/topic-performance?specKey=aqa-gcse-biology")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/teacher|only/i);
  });

  test("groups by topicKey, computes accuracy, sorts by lowest accuracy first", async () => {
    const topicA = "aqa-gcse-biology:cell-structure";
    const topicB = "aqa-gcse-biology:diffusion";

    await PracticeAttempt.create([
      { studentId, teacherId, specKey: "aqa-gcse-biology", topicKey: topicA, contentType: "quiz_mcq", contentId: new mongoose.Types.ObjectId(), isCorrect: true },
      { studentId, teacherId, specKey: "aqa-gcse-biology", topicKey: topicA, contentType: "quiz_mcq", contentId: new mongoose.Types.ObjectId(), isCorrect: true },
      { studentId, teacherId, specKey: "aqa-gcse-biology", topicKey: topicA, contentType: "quiz_mcq", contentId: new mongoose.Types.ObjectId(), isCorrect: false },
      { studentId, teacherId, specKey: "aqa-gcse-biology", topicKey: topicB, contentType: "quiz_mcq", contentId: new mongoose.Types.ObjectId(), isCorrect: false },
      { studentId, teacherId, specKey: "aqa-gcse-biology", topicKey: topicB, contentType: "quiz_mcq", contentId: new mongoose.Types.ObjectId(), isCorrect: false },
    ]);

    const res = await request(app)
      .get("/api/teacher/analytics/topic-performance?specKey=aqa-gcse-biology")
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const byTopic = Object.fromEntries(res.body.map((r) => [r.topicKey, r]));

    expect(byTopic[topicA]).toBeDefined();
    expect(byTopic[topicA].attempts).toBe(3);
    expect(byTopic[topicA].correct).toBe(2);
    expect(byTopic[topicA].accuracy).toBeCloseTo(2 / 3);

    expect(byTopic[topicB]).toBeDefined();
    expect(byTopic[topicB].attempts).toBe(2);
    expect(byTopic[topicB].correct).toBe(0);
    expect(byTopic[topicB].accuracy).toBe(0);

    expect(res.body[0].topicKey).toBe(topicB);
    expect(res.body[1].topicKey).toBe(topicA);
  });

  test("each row has topicKey, attempts, correct, accuracy, lastAttemptAt", async () => {
    const res = await request(app)
      .get("/api/teacher/analytics/topic-performance?specKey=aqa-gcse-biology")
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(0);
    for (const row of res.body) {
      expect(row).toHaveProperty("topicKey");
      expect(row).toHaveProperty("attempts");
      expect(row).toHaveProperty("correct");
      expect(row).toHaveProperty("accuracy");
      expect(row).toHaveProperty("lastAttemptAt");
    }
  });
});
