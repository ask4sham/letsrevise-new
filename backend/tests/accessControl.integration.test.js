/**
 * PR-HARD-1: Access control audit — students blocked from bank endpoints;
 * non-owner teachers get 404 on assignment/attempt/report endpoints (no existence leak).
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Worksheet = require("../models/Worksheet");
const WorksheetAssignment = require("../models/WorksheetAssignment");
const WorksheetAttempt = require("../models/WorksheetAttempt");
const ExamQuestion = require("../models/ExamQuestion");
const Lesson = require("../models/Lesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("PR-HARD-1: Access control", () => {
  let ownerToken;
  let ownerId;
  let otherTeacherToken;
  let otherTeacherId;
  let studentToken;
  let worksheetId;
  let assignmentId;
  let attemptId;
  let lessonId;

  beforeAll(async () => {
    const owner = await User.create({
      firstName: "Access",
      lastName: "Owner",
      email: "access-owner@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const other = await User.create({
      firstName: "Other",
      lastName: "Teacher",
      email: "access-other-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    otherTeacherId = other._id;

    const student = await User.create({
      firstName: "Access",
      lastName: "Student",
      email: "access-student@test.com",
      password: hashedPassword,
      userType: "student",
    });

    const loginOwner = await request(app).post("/api/auth/login").send({ email: "access-owner@test.com", password: "password123" });
    ownerToken = loginOwner.body?.token;
    const loginOther = await request(app).post("/api/auth/login").send({ email: "access-other-teacher@test.com", password: "password123" });
    otherTeacherToken = loginOther.body?.token;
    const loginStudent = await request(app).post("/api/auth/login").send({ email: "access-student@test.com", password: "password123" });
    studentToken = loginStudent.body?.token;

    if (!ownerToken || !otherTeacherToken || !studentToken) throw new Error("Login failed");

    const eq = await ExamQuestion.create({
      teacherId: ownerId,
      subject: "Biology",
      type: "mcq",
      marks: 1,
      question: "Q?",
      options: ["A", "B"],
      correctIndex: 0,
      status: "draft",
    });

    const ws = await Worksheet.create({
      ownerId,
      title: "Access Test WS",
      questionItems: [{ examQuestionId: eq._id }],
      status: "PUBLISHED",
    });
    worksheetId = ws._id.toString();

    const createRes = await request(app)
      .post("/api/worksheet-assignments")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ worksheetId });
    assignmentId = createRes.body.assignment._id.toString();

    const attRes = await request(app)
      .post(`/api/worksheet-assignments/share/${createRes.body.assignment.shareId}/attempts`)
      .send({ studentName: "Test" });
    attemptId = attRes.body.attemptId;

    await request(app).post(`/api/worksheet-attempts/${attemptId}/submit`).send({
      answers: [{ examQuestionId: eq._id.toString(), answerIndex: 0, shortText: "" }],
    });

    const lesson = await Lesson.create({
      title: "Test",
      description: "Test lesson",
      content: "x",
      teacherId: ownerId,
      teacherName: "Owner",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", title: "P1", order: 1, blocks: [] }],
    });
    lessonId = lesson._id.toString();
  }, 15000);

  afterAll(async () => {
    await WorksheetAttempt.deleteMany({ worksheetId: worksheetId });
    await WorksheetAssignment.deleteMany({ worksheetId: worksheetId });
    await Worksheet.deleteMany({ ownerId });
    await Lesson.deleteMany({ teacherId: ownerId });
    await ExamQuestion.deleteMany({ teacherId: ownerId });
  });

  describe("student blocked from bank endpoints", () => {
    test("student GET /api/flashcard-bank returns 403", async () => {
      const res = await request(app)
        .get("/api/flashcard-bank")
        .set("Authorization", `Bearer ${studentToken}`)
        .query({ topicKey: "cell-structure" });
      expect(res.status).toBe(403);
    });

    test("student POST /api/flashcard-bank/import returns 403", async () => {
      const res = await request(app)
        .post("/api/flashcard-bank/import")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ topicKey: "cell-structure", cards: [{ front: "Q", back: "A" }] });
      expect(res.status).toBe(403);
    });

    test("student POST /api/flashcard-bank/:topicKey/copy-to-lesson/:lessonId returns 403", async () => {
      const res = await request(app)
        .post(`/api/flashcard-bank/cell-structure/copy-to-lesson/${lessonId}`)
        .set("Authorization", `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });

    test("student GET /api/worksheet-assignments returns 403", async () => {
      const res = await request(app)
        .get("/api/worksheet-assignments")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });

    test("student GET /api/worksheet-reports/needs-marking returns 403", async () => {
      const res = await request(app)
        .get("/api/worksheet-reports/needs-marking")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe("non-owner teacher gets 404 on assignment/attempt/report (no existence leak)", () => {
    test("non-owner GET /api/worksheet-assignments/:id returns 404", async () => {
      const res = await request(app)
        .get(`/api/worksheet-assignments/${assignmentId}`)
        .set("Authorization", `Bearer ${otherTeacherToken}`);
      expect(res.status).toBe(404);
    });

    test("non-owner POST /api/worksheet-assignments/:id/close returns 404", async () => {
      const res = await request(app)
        .post(`/api/worksheet-assignments/${assignmentId}/close`)
        .set("Authorization", `Bearer ${otherTeacherToken}`);
      expect(res.status).toBe(404);
    });

    test("non-owner GET /api/worksheet-attempts/:id/teacher returns 404", async () => {
      const res = await request(app)
        .get(`/api/worksheet-attempts/${attemptId}/teacher`)
        .set("Authorization", `Bearer ${otherTeacherToken}`);
      expect(res.status).toBe(404);
    });

    test("non-owner POST /api/worksheet-attempts/:id/mark returns 404", async () => {
      const res = await request(app)
        .post(`/api/worksheet-attempts/${attemptId}/mark`)
        .set("Authorization", `Bearer ${otherTeacherToken}`)
        .send({ marks: [] });
      expect(res.status).toBe(404);
    });

    test("non-owner POST /api/worksheet-attempts/:id/release returns 404", async () => {
      const res = await request(app)
        .post(`/api/worksheet-attempts/${attemptId}/release`)
        .set("Authorization", `Bearer ${otherTeacherToken}`);
      expect(res.status).toBe(404);
    });

    test("non-owner GET /api/worksheet-reports/assignment/:id/attempts returns 404", async () => {
      const res = await request(app)
        .get(`/api/worksheet-reports/assignment/${assignmentId}/attempts`)
        .set("Authorization", `Bearer ${otherTeacherToken}`);
      expect(res.status).toBe(404);
    });

    test("non-owner GET /api/worksheet-reports/assignment/:id/summary returns 404", async () => {
      const res = await request(app)
        .get(`/api/worksheet-reports/assignment/${assignmentId}/summary`)
        .set("Authorization", `Bearer ${otherTeacherToken}`);
      expect(res.status).toBe(404);
    });
  });
});
