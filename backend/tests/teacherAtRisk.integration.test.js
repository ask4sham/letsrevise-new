/**
 * PR-EDGE-5.1: GET /api/teacher/at-risk — low-score drill-down
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const WorksheetAssignment = require("../models/WorksheetAssignment");
const WorksheetAttempt = require("../models/WorksheetAttempt");
const Worksheet = require("../models/Worksheet");
const QuizAssignment = require("../models/QuizAssignment");
const QuizAttempt = require("../models/QuizAttempt");
const Lesson = require("../models/Lesson");

jest.setTimeout(20000);

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/teacher/at-risk", () => {
  let teacherId;
  let teacherToken;
  let studentId;
  let studentToken;
  let assignmentId;
  let worksheetId;
  let quizAssignmentId;
  let lessonId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "T",
      lastName: "Risk",
      email: "atrisk-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const student = await User.create({
      firstName: "S",
      lastName: "Risk",
      email: "atrisk-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    studentId = student._id;

    const lesson = await Lesson.create({
      title: "At Risk Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
    });
    lessonId = lesson._id;

    const worksheet = await Worksheet.create({
      ownerId: teacherId,
      title: "At Risk Worksheet",
      topicKey: "cell-structure",
      status: "PUBLISHED",
    });
    worksheetId = worksheet._id;

    const assignment = await WorksheetAssignment.create({
      worksheetId,
      ownerId: teacherId,
      title: "At Risk Assignment",
      shareId: "atrisk-" + Date.now(),
    });
    assignmentId = assignment._id;

    await WorksheetAttempt.create({
      assignmentId,
      worksheetId,
      studentId,
      score: 2,
      maxScore: 10,
      status: "MARKED",
      isReleased: true,
      submittedAt: new Date(),
    });

    const qa = await QuizAssignment.create({
      ownerId: teacherId,
      kind: "quiz",
      lessonId,
      title: "At Risk Quiz",
      shareId: "atriskq-" + Date.now(),
    });
    quizAssignmentId = qa._id;

    await QuizAttempt.create({
      assignmentId: quizAssignmentId,
      studentId,
      status: "MARKED",
      score: 1,
      maxScore: 5,
      isReleased: true,
      submittedAt: new Date(),
    });

    const login = await request(app).post("/api/auth/login").send({
      email: "atrisk-teacher@test.com",
      password: "password123",
    });
    teacherToken = login.body?.token || login.body?.data?.token;

    const slogin = await request(app).post("/api/auth/login").send({
      email: "atrisk-student@test.com",
      password: "password123",
    });
    studentToken = slogin.body?.token || slogin.body?.data?.token;
  });

  afterAll(async () => {
    await User.deleteMany({ email: /atrisk-/ });
    await WorksheetAttempt.deleteMany({ assignmentId });
    await QuizAttempt.deleteMany({ assignmentId: quizAssignmentId });
    await WorksheetAssignment.deleteMany({ _id: assignmentId });
    await QuizAssignment.deleteMany({ _id: quizAssignmentId });
    await Worksheet.deleteMany({ _id: worksheetId });
    await Lesson.deleteMany({ _id: lessonId });
  });

  it("teacher sees own at-risk items", async () => {
    const res = await request(app)
      .get("/api/teacher/at-risk?threshold=0.5&days=30")
      .set("Authorization", `Bearer ${teacherToken}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.threshold).toBe(0.5);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    const worksheetItem = res.body.items.find((i) => i.type === "worksheet");
    expect(worksheetItem).toBeDefined();
    expect(worksheetItem.ratio).toBeLessThan(0.5);
  });

  it("student gets 403", async () => {
    await request(app)
      .get("/api/teacher/at-risk")
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(403);
  });

  it("threshold filtering works", async () => {
    const res = await request(app)
      .get("/api/teacher/at-risk?threshold=0.1&days=30")
      .set("Authorization", `Bearer ${teacherToken}`)
      .expect(200);
    expect(res.body.threshold).toBe(0.1);
  });

  it("days filtering works", async () => {
    const res = await request(app)
      .get("/api/teacher/at-risk?days=14")
      .set("Authorization", `Bearer ${teacherToken}`)
      .expect(200);
    expect(res.body.days).toBe(14);
  });
});
