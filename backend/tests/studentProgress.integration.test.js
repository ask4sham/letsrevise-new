/**
 * PR-STU-PROGRESS-1: GET /api/student/progress — reflection (quizzes attempted, avg score, needs practice)
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const QuizAssignment = require("../models/QuizAssignment");
const QuizAttempt = require("../models/QuizAttempt");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(20000);

describe("GET /api/student/progress (PR-STU-PROGRESS-1)", () => {
  let studentId;
  let teacherId;
  let lessonId;
  let quizAssignmentId;
  let studentToken;
  let teacherToken;
  let otherStudentId;
  let otherStudentToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "T",
      lastName: "Prog",
      email: "student-progress-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const student = await User.create({
      firstName: "S",
      lastName: "Prog",
      email: "student-progress-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    studentId = student._id;

    const otherStudent = await User.create({
      firstName: "O",
      lastName: "Student",
      email: "student-progress-other@test.com",
      password: hashedPassword,
      userType: "student",
    });
    otherStudentId = otherStudent._id;

    const lesson = await Lesson.create({
      title: "Progress Test Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cell structure",
      status: "published",
    });
    lessonId = lesson._id;

    const qa = await QuizAssignment.create({
      ownerId: teacherId,
      kind: "quiz",
      lessonId,
      title: "Progress Quiz",
      shareId: "prog-q-" + Date.now(),
    });
    quizAssignmentId = qa._id;

    await QuizAttempt.create({
      assignmentId: quizAssignmentId,
      studentId,
      status: "MARKED",
      score: 2,
      maxScore: 10,
      submittedAt: new Date(),
    });
    await QuizAttempt.create({
      assignmentId: quizAssignmentId,
      studentId,
      status: "MARKED",
      score: 1,
      maxScore: 5,
      submittedAt: new Date(),
    });

    const login = await request(app).post("/api/auth/login").send({
      email: "student-progress-student@test.com",
      password: "password123",
    });
    studentToken = login.body?.token || login.body?.data?.token;

    const tlogin = await request(app).post("/api/auth/login").send({
      email: "student-progress-teacher@test.com",
      password: "password123",
    });
    teacherToken = tlogin.body?.token || tlogin.body?.data?.token;

    const ologin = await request(app).post("/api/auth/login").send({
      email: "student-progress-other@test.com",
      password: "password123",
    });
    otherStudentToken = ologin.body?.token || ologin.body?.data?.token;
  });

  afterAll(async () => {
    await User.deleteMany({ email: /student-progress/ });
    await QuizAttempt.deleteMany({ assignmentId: quizAssignmentId });
    await QuizAssignment.deleteMany({ _id: quizAssignmentId });
    await Lesson.deleteMany({ _id: lessonId });
  });

  it("student with no attempts gets empty-ish response", async () => {
    const res = await request(app)
      .get("/api/student/progress")
      .set("Authorization", `Bearer ${otherStudentToken}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.subjects).toBeDefined();
    expect(Array.isArray(res.body.subjects)).toBe(true);
    expect(res.body.subjects[0]?.quizzesAttempted).toBe(0);
    expect(res.body.topics).toBeDefined();
  });

  it("student with quiz attempts gets correct aggregation", async () => {
    const res = await request(app)
      .get("/api/student/progress")
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.subjects.length).toBeGreaterThan(0);
    expect(res.body.subjects[0].quizzesAttempted).toBe(2);
    const avg = res.body.subjects[0].averageScore;
    expect(typeof avg).toBe("number");
    expect(avg).toBeCloseTo((2 / 10 + 1 / 5) / 2, 2);
  });

  it("needsPractice flag: averageScore < 0.4 -> true", async () => {
    const res = await request(app)
      .get("/api/student/progress")
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(200);
    const topicWithAttempts = res.body.topics.find((t) => t.attempted);
    expect(topicWithAttempts).toBeDefined();
    expect(topicWithAttempts.quizAttempts).toBe(2);
    const avg = (2 / 10 + 1 / 5) / 2;
    expect(avg).toBeLessThan(0.4);
    expect(topicWithAttempts.needsPractice).toBe(true);
  });

  it("teacher gets 403", async () => {
    await request(app)
      .get("/api/student/progress")
      .set("Authorization", `Bearer ${teacherToken}`)
      .expect(403);
  });

  it("other student cannot see first student data", async () => {
    const res = await request(app)
      .get("/api/student/progress")
      .set("Authorization", `Bearer ${otherStudentToken}`)
      .expect(200);
    expect(res.body.subjects[0]?.quizzesAttempted).toBe(0);
  });
});
