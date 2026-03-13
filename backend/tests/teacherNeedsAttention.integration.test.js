/**
 * PR18: GET /api/reports/teacher/needs-attention?days=7&limit=20
 * Teacher sees lessons ranked by misconception severity.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const PracticeAttempt = require("../models/PracticeAttempt");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(20000);

const TEST_SPEC = "aqa-gcse-biology";
const TEST_TOPIC = "aqa-gcse-biology:cell-biology";

describe("GET /api/reports/teacher/needs-attention", () => {
  let teacherId;
  let otherTeacherId;
  let teacherToken;
  let otherToken;
  let lessonId;
  let lessonNoPracticeId;
  let lessonNoAttemptsId;
  let studentId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "NA",
      lastName: "Teacher",
      email: "na-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const other = await User.create({
      firstName: "Other",
      lastName: "Teacher",
      email: "na-other@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    otherTeacherId = other._id;

    const student = await User.create({
      firstName: "S",
      lastName: "Student",
      email: "na-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    studentId = student._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    teacherToken = await login("na-teacher@test.com");
    otherToken = await login("na-other@test.com");

    const lesson = await Lesson.create({
      title: "NA Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "NA Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", title: "P1", order: 1, blocks: [] }],
      examQuestions: [],
    });
    lessonId = lesson._id;

    const sourceId = new mongoose.Types.ObjectId();
    await PracticeAttempt.create([
      { studentId, teacherId, specKey: TEST_SPEC, topicKey: TEST_TOPIC, sourceType: "examQuestion", sourceId, outcome: "wrong", confidence: 3 },
      { studentId, teacherId, specKey: TEST_SPEC, topicKey: TEST_TOPIC, sourceType: "examQuestion", sourceId, outcome: "wrong", confidence: 3 },
      { studentId, teacherId, specKey: TEST_SPEC, topicKey: TEST_TOPIC, sourceType: "examQuestion", sourceId, outcome: "correct", confidence: 2 },
    ]);

    const lessonNoPractice = await Lesson.create({
      title: "NA No Practice",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "NA Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Respiration",
      status: "published",
      isPublished: true,
      pages: [],
      examQuestions: [],
    });
    lessonNoPracticeId = lessonNoPractice._id;

    const lessonNoAttempts = await Lesson.create({
      title: "NA No Attempts",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "NA Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      pages: [],
      examQuestions: [{ questionId: new (require("mongoose")).Types.ObjectId(), addedAt: new Date() }],
    });
    lessonNoAttemptsId = lessonNoAttempts._id;
  });

  test("401 without auth", async () => {
    const res = await request(app).get("/api/reports/teacher/needs-attention?days=7");
    expect(res.status).toBe(401);
  });

  test("teacher gets list sorted by highConfidenceWrong", async () => {
    const res = await request(app)
      .get("/api/reports/teacher/needs-attention?days=7&limit=20")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.days).toBe(7);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    const first = res.body.items[0];
    expect(first.specKey).toBe(TEST_SPEC);
    expect(first.topicKey).toBe(TEST_TOPIC);
    expect(first.title).toBeDefined();
    expect(first.highConfidenceWrong).toBe(2);
    expect(first.wrong).toBe(2);
    expect(first.correct).toBe(1);
    expect(first.attempts).toBe(3);
    expect(first.uniqueStudents).toBe(1);
    expect(first.readiness).toBeDefined();
    expect(first.readiness.status).toBeDefined();
  });

  test("other teacher cannot see first teacher lessons", async () => {
    const res = await request(app)
      .get("/api/reports/teacher/needs-attention?days=7")
      .set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.items.length).toBe(0);
  });

  test("days and limit are clamped", async () => {
    const res = await request(app)
      .get("/api/reports/teacher/needs-attention?days=100&limit=1000")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.days).toBeLessThanOrEqual(30);
    expect(res.body.items.length).toBeLessThanOrEqual(50);
  });

  test("PR19: cold start includes noPracticeAttached and noAttemptsYet, totals present", async () => {
    const res = await request(app)
      .get("/api/reports/teacher/needs-attention?days=7")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.coldStart).toBeDefined();
    expect(Array.isArray(res.body.coldStart.noPracticeAttached)).toBe(true);
    expect(Array.isArray(res.body.coldStart.noAttemptsYet)).toBe(true);
    expect(res.body.totals).toBeDefined();
    expect(typeof res.body.totals.needsAttention).toBe("number");
    expect(typeof res.body.totals.noPracticeAttached).toBe("number");
    expect(typeof res.body.totals.noAttemptsYet).toBe("number");
    const noPractice = res.body.coldStart.noPracticeAttached.find((r) => r.lessonId === String(lessonNoPracticeId));
    expect(noPractice).toBeDefined();
    expect(noPractice.title).toBeDefined();
    expect(noPractice.readiness).toBeDefined();
    const noAttempts = res.body.coldStart.noAttemptsYet.find((r) => r.lessonId === String(lessonNoAttemptsId));
    expect(noAttempts).toBeDefined();
    expect(noAttempts.title).toBeDefined();
  });

  test("PR19: includeColdStart=false returns no coldStart", async () => {
    const res = await request(app)
      .get("/api/reports/teacher/needs-attention?days=7&includeColdStart=false")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.coldStart).toBeUndefined();
  });
});
