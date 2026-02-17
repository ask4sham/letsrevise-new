/**
 * PR12: POST /api/attempts + GET /api/reports/lessons/:lessonId/attempts-summary
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const PracticeAttempt = require("../models/PracticeAttempt");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("PR12 Practice attempts", () => {
  let teacherId;
  let studentId;
  let lessonId;
  let teacherToken;
  let studentToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "T",
      lastName: "Teacher",
      email: "attempts-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const student = await User.create({
      firstName: "S",
      lastName: "Student",
      email: "attempts-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    studentId = student._id;

    const lesson = await Lesson.create({
      title: "Test Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", title: "P1", order: 1, blocks: [] }],
      examQuestions: [],
    });
    lessonId = lesson._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    teacherToken = await login("attempts-teacher@test.com");
    studentToken = await login("attempts-student@test.com");
  });

  describe("POST /api/attempts", () => {
    test("returns 401 without auth", async () => {
      const res = await request(app)
        .post("/api/attempts")
        .send({
          lessonId: lessonId,
          source: "checkpoint",
          questionType: "mcq",
          selected: "A",
          isCorrect: true,
        });
      expect(res.status).toBe(401);
    });

    test("200 with valid checkpoint payload", async () => {
      const res = await request(app)
        .post("/api/attempts")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          lessonId: String(lessonId),
          source: "checkpoint",
          questionType: "mcq",
          selected: "A",
          isCorrect: true,
        });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test("rejects invalid lessonId", async () => {
      const res = await request(app)
        .post("/api/attempts")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          lessonId: "not-an-object-id",
          source: "checkpoint",
          questionType: "mcq",
          isCorrect: false,
        });
      expect(res.status).toBe(400);
    });

    test("practice requires questionId", async () => {
      const res = await request(app)
        .post("/api/attempts")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          lessonId: String(lessonId),
          source: "practice",
          questionType: "mcq",
          selected: "B",
          isCorrect: false,
        });
      expect(res.status).toBe(400);
    });

    test("200 with valid practice payload (questionId present)", async () => {
      const qId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post("/api/attempts")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          lessonId: String(lessonId),
          source: "practice",
          questionId: String(qId),
          questionType: "mcq",
          selected: "C",
          isCorrect: true,
        });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test("PR12.3: confidence invalid returns 400", async () => {
      const res = await request(app)
        .post("/api/attempts")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          lessonId: String(lessonId),
          source: "checkpoint",
          questionType: "mcq",
          selected: "X",
          isCorrect: false,
          confidence: 4,
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/confidence/);
    });

    test("PR12.3: confidence numeric string 3 accepted and saved", async () => {
      const before = await PracticeAttempt.countDocuments({ userId: studentId, lessonId });
      const res = await request(app)
        .post("/api/attempts")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          lessonId: String(lessonId),
          source: "checkpoint",
          questionType: "short",
          answerText: "ans",
          isCorrect: true,
          confidence: "3",
        });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      const after = await PracticeAttempt.countDocuments({ userId: studentId, lessonId });
      expect(after).toBe(before + 1);
      const doc = await PracticeAttempt.findOne({ userId: studentId, lessonId, confidence: 3 }).sort({ createdAt: -1 }).lean();
      expect(doc).toBeDefined();
      expect(doc.confidence).toBe(3);
    });

    test("PR12.3: duplicate guard returns ok true duplicate true within window", async () => {
      const qId = new mongoose.Types.ObjectId();
      const payload = {
        lessonId: String(lessonId),
        source: "practice",
        questionId: String(qId),
        questionType: "mcq",
        selected: "D",
        isCorrect: false,
      };
      const res1 = await request(app)
        .post("/api/attempts")
        .set("Authorization", `Bearer ${studentToken}`)
        .send(payload);
      expect(res1.status).toBe(200);
      expect(res1.body.ok).toBe(true);
      expect(res1.body.duplicate).toBeUndefined();

      const res2 = await request(app)
        .post("/api/attempts")
        .set("Authorization", `Bearer ${studentToken}`)
        .send(payload);
      expect(res2.status).toBe(200);
      expect(res2.body.ok).toBe(true);
      expect(res2.body.duplicate).toBe(true);

      const count = await PracticeAttempt.countDocuments({
        userId: studentId,
        lessonId,
        questionId: qId,
      });
      expect(count).toBe(1);
    });
  });

  describe("GET /api/reports/lessons/:lessonId/attempts-summary", () => {
    test("teacher can fetch summary for own lesson", async () => {
      const res = await request(app)
        .get(`/api/reports/lessons/${lessonId}/attempts-summary?days=7`)
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.totalAttempts).toBeGreaterThanOrEqual(1);
      expect(res.body.uniqueStudents).toBeGreaterThanOrEqual(1);
      expect(typeof res.body.accuracy).toBe("number");
      expect(res.body.bySource).toBeDefined();
    });

    test("student cannot fetch summary (403)", async () => {
      const res = await request(app)
        .get(`/api/reports/lessons/${lessonId}/attempts-summary?days=7`)
        .set("Authorization", `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });
  });
});
