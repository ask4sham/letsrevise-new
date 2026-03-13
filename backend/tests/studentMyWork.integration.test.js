/**
 * PR-EDGE-4: Student "My Work" dashboard — worksheets, quizzes, assessments.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Worksheet = require("../models/Worksheet");
const WorksheetAssignment = require("../models/WorksheetAssignment");
const WorksheetAttempt = require("../models/WorksheetAttempt");
const ExamQuestion = require("../models/ExamQuestion");
const QuizAssignment = require("../models/QuizAssignment");
const QuizAttempt = require("../models/QuizAttempt");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/student/my-work (PR-EDGE-4)", () => {
  let studentAToken;
  let studentAId;
  let studentBToken;
  let studentBId;
  let teacherToken;
  let teacherId;

  beforeAll(async () => {
    const studentA = await User.create({
      firstName: "MyWork",
      lastName: "StudentA",
      email: "mywork-studentA@test.com",
      password: hashedPassword,
      userType: "student",
    });
    studentAId = studentA._id;
    const studentB = await User.create({
      firstName: "MyWork",
      lastName: "StudentB",
      email: "mywork-studentB@test.com",
      password: hashedPassword,
      userType: "student",
    });
    studentBId = studentB._id;
    const teacher = await User.create({
      firstName: "MyWork",
      lastName: "Teacher",
      email: "mywork-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    studentAToken = (await request(app).post("/api/auth/login").send({ email: "mywork-studentA@test.com", password: "password123" })).body?.token;
    studentBToken = (await request(app).post("/api/auth/login").send({ email: "mywork-studentB@test.com", password: "password123" })).body?.token;
    teacherToken = (await request(app).post("/api/auth/login").send({ email: "mywork-teacher@test.com", password: "password123" })).body?.token;
    if (!studentAToken || !studentBToken || !teacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await QuizAttempt.deleteMany({});
    await QuizAssignment.deleteMany({});
    await WorksheetAttempt.deleteMany({});
    await WorksheetAssignment.deleteMany({});
    await Worksheet.deleteMany({});
    await ExamQuestion.deleteMany({ teacherId: teacherId });
  });

  test("teacher -> 403", async () => {
    const res = await request(app)
      .get("/api/student/my-work")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/student/i);
  });

  test("student gets overview with correct shape when empty", async () => {
    const res = await request(app)
      .get("/api/student/my-work")
      .set("Authorization", `Bearer ${studentAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.worksheets)).toBe(true);
    expect(Array.isArray(res.body.quizzes)).toBe(true);
    expect(Array.isArray(res.body.assessments)).toBe(true);
  });

  test("student gets their own work: worksheets, quizzes, assessments", async () => {
    const eq = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      question: "Test?",
      status: "published",
      topicKey: "cell-structure",
    });
    const ws = await Worksheet.create({
      ownerId: teacherId,
      title: "MyWork Test WS",
      questionItems: [{ examQuestionId: eq._id }],
      status: "PUBLISHED",
    });
    const assign = await WorksheetAssignment.create({
      worksheetId: ws._id,
      ownerId: teacherId,
      title: "MyWork Assignment",
      shareId: "myworkws" + Date.now(),
      isActive: true,
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await WorksheetAttempt.create({
      assignmentId: assign._id,
      worksheetId: ws._id,
      studentId: studentAId,
      studentName: "Student A",
      status: "SUBMITTED",
      isReleased: false,
      score: 5,
      maxScore: 10,
      submittedAt: new Date(),
    });

    const quizAssign = await QuizAssignment.create({
      ownerId: teacherId,
      kind: "quiz",
      title: "MyWork Quiz",
      isActive: true,
      shareId: "myworkquiz" + Date.now(),
      dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
    const assessAssign = await QuizAssignment.create({
      ownerId: teacherId,
      kind: "assessment",
      title: "MyWork Assessment",
      isActive: true,
      shareId: "myworkassess" + Date.now(),
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });

    await QuizAttempt.create({
      assignmentId: quizAssign._id,
      studentId: studentAId,
      status: "SUBMITTED",
      isReleased: false,
      submittedAt: new Date(),
    });
    await QuizAttempt.create({
      assignmentId: assessAssign._id,
      studentId: studentAId,
      status: "MARKED",
      isReleased: true,
      submittedAt: new Date(),
    });

    const res = await request(app)
      .get("/api/student/my-work")
      .set("Authorization", `Bearer ${studentAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.worksheets.length).toBeGreaterThanOrEqual(1);
    expect(res.body.quizzes.length).toBeGreaterThanOrEqual(1);
    expect(res.body.assessments.length).toBeGreaterThanOrEqual(1);

    const wsItem = res.body.worksheets.find((w) => w.worksheetTitle === "MyWork Assignment" || w.title === "MyWork Assignment");
    expect(wsItem).toBeDefined();
    expect(wsItem.isReleased).toBe(false);
    expect(wsItem.score).toBeNull();
    expect(wsItem.maxScore).toBeNull();
    expect(wsItem.link).toMatch(/^\/w\//);

    const quizItem = res.body.quizzes[0];
    expect(quizItem).toBeDefined();
    expect(quizItem.kind).toBe("quiz");
    expect(quizItem.isReleased).toBe(false);
    expect(quizItem.score).toBeNull();
    expect(quizItem.link).toMatch(/^\/q\//);

    const assessItem = res.body.assessments[0];
    expect(assessItem).toBeDefined();
    expect(assessItem.kind).toBe("assessment");
  });

  test("other student does not see student A work", async () => {
    const res = await request(app)
      .get("/api/student/my-work")
      .set("Authorization", `Bearer ${studentBToken}`);
    expect(res.status).toBe(200);
    expect(res.body.worksheets.length).toBe(0);
    expect(res.body.quizzes.length).toBe(0);
    expect(res.body.assessments.length).toBe(0);
  });

  test("release gating: released attempt shows score", async () => {
    const eq = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      question: "Released?",
      status: "published",
      topicKey: "cell",
    });
    const ws = await Worksheet.create({
      ownerId: teacherId,
      title: "Released WS",
      questionItems: [{ examQuestionId: eq._id }],
      status: "PUBLISHED",
    });
    const assign = await WorksheetAssignment.create({
      worksheetId: ws._id,
      ownerId: teacherId,
      title: "Released Assignment",
      shareId: "myworkrel" + Date.now(),
      isActive: true,
    });
    await WorksheetAttempt.create({
      assignmentId: assign._id,
      worksheetId: ws._id,
      studentId: studentAId,
      status: "MARKED",
      isReleased: true,
      score: 8,
      maxScore: 10,
      submittedAt: new Date(),
    });

    const res = await request(app)
      .get("/api/student/my-work")
      .set("Authorization", `Bearer ${studentAToken}`);
    expect(res.status).toBe(200);
    const released = res.body.worksheets.find((w) => w.worksheetTitle === "Released Assignment" || w.title === "Released Assignment");
    expect(released).toBeDefined();
    expect(released.isReleased).toBe(true);
    expect(released.score).toBe(8);
    expect(released.maxScore).toBe(10);
  });

  test("PR-EDGE-4.2: released quiz attempt shows score in My Work", async () => {
    const quizAssign = await QuizAssignment.create({
      ownerId: teacherId,
      kind: "quiz",
      title: "Scored Quiz",
      isActive: true,
      shareId: "myworkscore" + Date.now(),
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await QuizAttempt.create({
      assignmentId: quizAssign._id,
      studentId: studentAId,
      status: "SUBMITTED",
      isReleased: true,
      score: 7,
      maxScore: 10,
      submittedAt: new Date(),
    });

    const res = await request(app)
      .get("/api/student/my-work")
      .set("Authorization", `Bearer ${studentAToken}`);
    expect(res.status).toBe(200);
    const releasedQuiz = res.body.quizzes.find((q) => q.title === "Scored Quiz" || q.lessonTitle === "Scored Quiz");
    expect(releasedQuiz).toBeDefined();
    expect(releasedQuiz.isReleased).toBe(true);
    expect(releasedQuiz.score).toBe(7);
    expect(releasedQuiz.maxScore).toBe(10);
  });
});
