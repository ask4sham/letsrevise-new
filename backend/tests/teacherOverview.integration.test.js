/**
 * PR-EDGE-3: Teacher overview dashboard — needsMarking, awaitingRelease, dueSoon, recentActivity.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Worksheet = require("../models/Worksheet");
const WorksheetAssignment = require("../models/WorksheetAssignment");
const WorksheetAttempt = require("../models/WorksheetAttempt");
const ExamQuestion = require("../models/ExamQuestion");
const QuizAssignment = require("../models/QuizAssignment");
const QuizAttempt = require("../models/QuizAttempt");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/teacher/overview (PR-EDGE-3)", () => {
  let teacherAToken;
  let teacherAId;
  let teacherBToken;
  let studentToken;

  beforeAll(async () => {
    const teacherA = await User.create({
      firstName: "Overview",
      lastName: "TeacherA",
      email: "overview-teacherA@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherAId = teacherA._id;
    const teacherB = await User.create({
      firstName: "Overview",
      lastName: "TeacherB",
      email: "overview-teacherB@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const student = await User.create({
      firstName: "Overview",
      lastName: "Student",
      email: "overview-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    teacherAToken = (await request(app).post("/api/auth/login").send({ email: "overview-teacherA@test.com", password: "password123" })).body?.token;
    teacherBToken = (await request(app).post("/api/auth/login").send({ email: "overview-teacherB@test.com", password: "password123" })).body?.token;
    studentToken = (await request(app).post("/api/auth/login").send({ email: "overview-student@test.com", password: "password123" })).body?.token;
    if (!teacherAToken || !teacherBToken || !studentToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await QuizAttempt.deleteMany({});
    await QuizAssignment.deleteMany({});
    await WorksheetAttempt.deleteMany({});
    await WorksheetAssignment.deleteMany({});
    await Worksheet.deleteMany({});
    await ExamQuestion.deleteMany({ teacherId: { $in: [teacherAId] } });
  });

  test("teacher gets overview with correct shape", async () => {
    const res = await request(app)
      .get("/api/teacher/overview")
      .set("Authorization", `Bearer ${teacherAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.needsMarking).toBeDefined();
    expect(res.body.needsMarking.worksheets).toEqual({ count: expect.any(Number), link: expect.any(String) });
    expect(res.body.awaitingRelease).toBeDefined();
    expect(res.body.awaitingRelease.worksheets).toEqual({ count: expect.any(Number), link: expect.any(String) });
    expect(res.body.awaitingRelease.quizzes).toEqual({ count: expect.any(Number), link: expect.any(String) });
    expect(res.body.awaitingRelease.assessments).toEqual({ count: expect.any(Number), link: expect.any(String) });
    expect(res.body.dueSoon).toBeDefined();
    expect(res.body.dueSoon.worksheets).toEqual({ count: expect.any(Number), link: expect.any(String) });
    expect(res.body.dueSoon.quizzes).toEqual({ count: expect.any(Number), link: expect.any(String) });
    expect(res.body.dueSoon.assessments).toEqual({ count: expect.any(Number), link: expect.any(String) });
    expect(Array.isArray(res.body.recentActivity)).toBe(true);
    expect(res.body.recentActivity.length).toBeLessThanOrEqual(10);
  });

  test("student -> 403", async () => {
    const res = await request(app)
      .get("/api/teacher/overview")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/teacher|admin/i);
  });

  test("needs marking count and awaiting release when teacher has worksheet data", async () => {
    const eq = await ExamQuestion.create({
      teacherId: teacherAId,
      subject: "Biology",
      type: "short",
      question: "Test?",
      status: "published",
      topicKey: "cell-structure",
    });
    const ws = await Worksheet.create({
      ownerId: teacherAId,
      title: "Overview Test WS",
      questionItems: [{ examQuestionId: eq._id }],
      status: "PUBLISHED",
    });
    const dueSoon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const assign = await WorksheetAssignment.create({
      worksheetId: ws._id,
      ownerId: teacherAId,
      title: "Test Assignment",
      shareId: "ovtest" + Date.now(),
      isActive: true,
      dueAt: dueSoon,
    });
    await WorksheetAttempt.create({
      assignmentId: assign._id,
      worksheetId: ws._id,
      studentName: "Test Student",
      status: "SUBMITTED",
      answers: [{ examQuestionId: eq._id, shortText: "x", awardedMarks: null }],
      submittedAt: new Date(),
    });
    await WorksheetAttempt.create({
      assignmentId: assign._id,
      worksheetId: ws._id,
      studentName: "Marked Student",
      status: "MARKED",
      isReleased: false,
      answers: [{ examQuestionId: eq._id, shortText: "y", awardedMarks: 1 }],
      submittedAt: new Date(),
    });

    const res = await request(app)
      .get("/api/teacher/overview")
      .set("Authorization", `Bearer ${teacherAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.needsMarking.worksheets.count).toBeGreaterThanOrEqual(1);
    expect(res.body.awaitingRelease.worksheets.count).toBeGreaterThanOrEqual(1);
    expect(res.body.dueSoon.worksheets.count).toBeGreaterThanOrEqual(1);
    expect(res.body.recentActivity.length).toBeGreaterThanOrEqual(1);
  });

  test("PR-EDGE-3.1: quiz and assessment counts and recent activity when teacher has quiz/assessment data", async () => {
    const dueSoon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const quizAssign = await QuizAssignment.create({
      ownerId: teacherAId,
      kind: "quiz",
      title: "Overview Quiz",
      isActive: true,
      shareId: "ovquiz" + Date.now(),
      dueAt: dueSoon,
    });
    const assessAssign = await QuizAssignment.create({
      ownerId: teacherAId,
      kind: "assessment",
      title: "Overview Assessment",
      isActive: true,
      shareId: "ovassess" + Date.now(),
      dueAt: dueSoon,
    });
    await QuizAttempt.create({
      assignmentId: quizAssign._id,
      status: "SUBMITTED",
      isReleased: false,
      submittedAt: new Date(),
    });
    await QuizAttempt.create({
      assignmentId: assessAssign._id,
      status: "SUBMITTED",
      isReleased: false,
      submittedAt: new Date(),
    });

    const res = await request(app)
      .get("/api/teacher/overview")
      .set("Authorization", `Bearer ${teacherAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.awaitingRelease.quizzes.count).toBe(1);
    expect(res.body.awaitingRelease.assessments.count).toBe(1);
    expect(res.body.dueSoon.quizzes.count).toBe(1);
    expect(res.body.dueSoon.assessments.count).toBe(1);
    const types = (res.body.recentActivity || []).map((a) => a.type);
    expect(types).toContain("quiz");
    expect(types).toContain("assessment");
  });
});
