/**
 * PR13.3: GET /api/reports/students/me/recommendations
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");
const PracticeAttempt = require("../models/PracticeAttempt");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/reports/students/me/recommendations", () => {
  let teacherId;
  let studentId;
  let questionId;
  let lessonId;
  let studentToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "T",
      lastName: "Teacher",
      email: "rec-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const student = await User.create({
      firstName: "S",
      lastName: "Student",
      email: "rec-student@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: { status: "active", expiresAt: new Date(Date.now() + 86400000) },
      purchasedLessons: [],
    });
    studentId = student._id;

    const q = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "mcq",
      question: "Cell structure question",
      options: ["A", "B"],
      correctIndex: 0,
      marks: 2,
      topicKey: "cell-structure",
      topic: "Cell structure",
      status: "published",
    });
    questionId = q._id;

    const lesson = await Lesson.create({
      title: "Rec Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      examQuestions: [{ questionId, addedAt: new Date() }],
    });
    lessonId = lesson._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    studentToken = await login("rec-student@test.com");
  });

  test("401 without auth", async () => {
    const res = await request(app).get("/api/reports/students/me/recommendations?days=14&limit=6");
    expect(res.status).toBe(401);
  });

  test("with auth and no attempts returns empty topics and lessons", async () => {
    await PracticeAttempt.deleteMany({ userId: studentId });
    const res = await request(app)
      .get("/api/reports/students/me/recommendations?days=14&limit=6")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.topics)).toBe(true);
    expect(Array.isArray(res.body.lessons)).toBe(true);
    expect(res.body.topics).toHaveLength(0);
    expect(res.body.lessons).toHaveLength(0);
  });

  test("with attempts returns topics sorted by score", async () => {
    await PracticeAttempt.create([
      { userId: studentId, lessonId, source: "practice", questionId, questionType: "mcq", isCorrect: false, confidence: 3 },
      { userId: studentId, lessonId, source: "practice", questionId, questionType: "mcq", isCorrect: false, confidence: 3 },
      { userId: studentId, lessonId, source: "practice", questionId, questionType: "mcq", isCorrect: true, confidence: 2 },
    ]);

    const res = await request(app)
      .get("/api/reports/students/me/recommendations?days=14&limit=6")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.days).toBe(14);
    expect(Array.isArray(res.body.topics)).toBe(true);
    expect(res.body.topics.length).toBeGreaterThanOrEqual(1);
    expect(res.body.topics[0].topicKey).toBe("cell-structure");
    expect(res.body.topics[0].wrong).toBe(2);
    expect(res.body.topics[0].highConfidenceWrong).toBe(2);
    expect(res.body.topics[0].score).toBe(2 * 3 + 2 * 1 - 1 * 0.5);
  });

  test("with published lessons for topic returns lessons array not empty", async () => {
    await Lesson.create({
      title: "Cell structure lesson",
      description: "Learn cells",
      content: "C",
      teacherId,
      teacherName: "T Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      status: "published",
      isPublished: true,
      examQuestions: [],
    });

    const res = await request(app)
      .get("/api/reports/students/me/recommendations?days=14&limit=6")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.lessons)).toBe(true);
    expect(res.body.lessons.length).toBeGreaterThanOrEqual(1);
    const first = res.body.lessons[0];
    expect(first.id).toBeDefined();
    expect(first.title).toBeDefined();
    expect(first.topic).toBeDefined();
    expect(typeof first.locked).toBe("boolean");
    expect(first.reason).toBeDefined();
    expect(first.isFreePreview).toBeDefined();
    expect(first.hasAccess).toBeDefined();
    expect(first.pages).toBeUndefined();
  });
});
