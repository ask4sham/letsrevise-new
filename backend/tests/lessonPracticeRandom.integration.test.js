/**
 * PR-PRACTICE-1: GET /api/lessons/:id/practice — limit, seed, deterministic shuffle
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/lessons/:id/practice (PR-PRACTICE-1)", () => {
  let teacherId;
  let lessonId;
  let token;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "P",
      lastName: "Teacher",
      email: "practice-random-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const lesson = await Lesson.create({
      title: "Random Practice Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cell structure",
      status: "published",
      isFreePreview: false,
    });
    lessonId = lesson._id;

    for (let i = 0; i < 15; i++) {
      await ExamQuestion.create({
        teacherId,
        subject: "Biology",
        type: "mcq",
        question: `Bank Q${i + 1}?`,
        options: ["A", "B", "C"],
        correctIndex: 0,
        marks: 1,
        topicKey: "cell-structure",
        topic: "Cell structure",
        status: "published",
      });
    }

    const login = await request(app).post("/api/auth/login").send({
      email: "practice-random-teacher@test.com",
      password: "password123",
    });
    token = login.body?.token;
    if (!token) {
      const res = await request(app).post("/api/users/login").send({
        email: "practice-random-teacher@test.com",
        password: "password123",
      });
      token = res.body?.token;
    }
  });

  afterAll(async () => {
    await User.deleteMany({ email: /practice-random-teacher@test.com/ });
    await Lesson.deleteMany({ title: "Random Practice Lesson" });
    await ExamQuestion.deleteMany({ topicKey: "cell-structure", question: /Bank Q/ });
  });

  it("default limit = 10", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}/practice`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.questions).toBeDefined();
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBeLessThanOrEqual(10);
    expect(res.body.limit).toBe(10);
    expect(res.body.source).toBe("bank");
  });

  it("limit clamped to 25 max", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}/practice?limit=100`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.limit).toBe(25);
    expect(res.body.questions.length).toBeLessThanOrEqual(25);
  });

  it("invalid limit returns 400", async () => {
    await request(app)
      .get(`/api/lessons/${lessonId}/practice?limit=0`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
  });

  it("same seed returns same order", async () => {
    const seed = "test-seed-123";
    const r1 = await request(app)
      .get(`/api/lessons/${lessonId}/practice?limit=5&seed=${seed}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const r2 = await request(app)
      .get(`/api/lessons/${lessonId}/practice?limit=5&seed=${seed}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const ids1 = r1.body.questions.map((q) => q.id);
    const ids2 = r2.body.questions.map((q) => q.id);
    expect(ids1).toEqual(ids2);
  });

  it("different seed can return different order", async () => {
    const r1 = await request(app)
      .get(`/api/lessons/${lessonId}/practice?limit=5&seed=seed-a`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const r2 = await request(app)
      .get(`/api/lessons/${lessonId}/practice?limit=5&seed=seed-b`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const ids1 = r1.body.questions.map((q) => q.id);
    const ids2 = r2.body.questions.map((q) => q.id);
    expect(ids1.length).toBe(5);
    expect(ids2.length).toBe(5);
    const sameOrder = ids1.every((id, i) => id === ids2[i]);
    expect(sameOrder).toBe(false);
  });

  it("returns published-only bank questions", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}/practice?limit=5`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.source).toBe("bank");
    expect(res.body.questions.length).toBeGreaterThan(0);
  });

  it("requires lessonId (no query-topicKey access)", async () => {
    await request(app)
      .get("/api/lessons/invalid-id/practice")
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
  });
});
