/**
 * PR13: GET /api/reports/lessons/:lessonId/question-insights
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const PracticeAttempt = require("../models/PracticeAttempt");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(15000);

describe("PR13 Question insights", () => {
  let teacherId;
  let otherTeacherId;
  let studentId;
  let lessonId;
  let questionIdA;
  let questionIdB;
  let teacherToken;
  let otherTeacherToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "T",
      lastName: "Owner",
      email: "qi-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const otherTeacher = await User.create({
      firstName: "O",
      lastName: "Other",
      email: "qi-other-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    otherTeacherId = otherTeacher._id;

    const student = await User.create({
      firstName: "S",
      lastName: "Student",
      email: "qi-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    studentId = student._id;

    const qA = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      topic: "Cells",
      topicKey: "cells",
      type: "mcq",
      marks: 2,
      question: "What is the function of the mitochondria?",
      status: "published",
    });
    questionIdA = qA._id;

    const qB = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      topic: "Respiration",
      topicKey: "respiration",
      type: "short",
      marks: 3,
      question: "Describe aerobic respiration.",
      status: "published",
    });
    questionIdB = qB._id;

    const lesson = await Lesson.create({
      title: "QI Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T Owner",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", title: "P1", order: 1, blocks: [] }],
      examQuestions: [
        { questionId: questionIdA, addedAt: new Date() },
        { questionId: questionIdB, addedAt: new Date() },
      ],
    });
    lessonId = lesson._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    teacherToken = await login("qi-teacher@test.com");
    otherTeacherToken = await login("qi-other-teacher@test.com");
  });

  describe("GET /api/reports/lessons/:lessonId/question-insights", () => {
    test("401 without auth", async () => {
      const res = await request(app).get(
        `/api/reports/lessons/${lessonId}/question-insights?days=7`
      );
      expect(res.status).toBe(401);
    });

    test("teacher owner gets 200", async () => {
      const res = await request(app)
        .get(`/api/reports/lessons/${lessonId}/question-insights?days=7&limit=10`)
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(Array.isArray(res.body.topics)).toBe(true);
      expect(res.body.lessonId).toBe(String(lessonId));
      expect(res.body.days).toBe(7);
    });

    test("other teacher gets 403", async () => {
      const res = await request(app)
        .get(`/api/reports/lessons/${lessonId}/question-insights?days=7`)
        .set("Authorization", `Bearer ${otherTeacherToken}`);
      expect(res.status).toBe(403);
    });

    test("aggregation ranks by highConfidenceWrong first", async () => {
      await PracticeAttempt.deleteMany({ lessonId, source: "practice" });

      await PracticeAttempt.create([
        {
          userId: studentId,
          lessonId,
          source: "practice",
          questionId: questionIdA,
          questionType: "mcq",
          isCorrect: false,
          confidence: 3,
        },
        {
          userId: studentId,
          lessonId,
          source: "practice",
          questionId: questionIdA,
          questionType: "mcq",
          isCorrect: false,
          confidence: 3,
        },
        {
          userId: studentId,
          lessonId,
          source: "practice",
          questionId: questionIdA,
          questionType: "mcq",
          isCorrect: true,
          confidence: 2,
        },
        {
          userId: studentId,
          lessonId,
          source: "practice",
          questionId: questionIdB,
          questionType: "short",
          isCorrect: false,
          confidence: 2,
        },
        {
          userId: studentId,
          lessonId,
          source: "practice",
          questionId: questionIdB,
          questionType: "short",
          isCorrect: false,
          confidence: 3,
        },
      ]);

      const res = await request(app)
        .get(`/api/reports/lessons/${lessonId}/question-insights?days=7&limit=10`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.items.length).toBe(2);

      const first = res.body.items[0];
      const second = res.body.items[1];

      expect(first.highConfidenceWrong).toBeGreaterThanOrEqual(second.highConfidenceWrong);
      expect(first.questionId).toBe(String(questionIdA));
      expect(first.highConfidenceWrong).toBe(2);
      expect(first.attempts).toBe(3);
      expect(first.accuracy).toBeCloseTo(1 / 3);

      expect(second.questionId).toBe(String(questionIdB));
      expect(second.highConfidenceWrong).toBe(1);
      expect(second.attempts).toBe(2);
    });
  });
});
