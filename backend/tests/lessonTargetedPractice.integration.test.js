/**
 * PR13.2: GET /api/lessons/:id/targeted-practice — misconception-driven set.
 * Same access as /practice: 402 NOT_ENTITLED, 200 allowed:false for FREE_PREVIEW, 200 allowed:true for SUB_ACTIVE.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");
const LessonUnlock = require("../models/LessonUnlock");
const PracticeAttempt = require("../models/PracticeAttempt");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/lessons/:id/targeted-practice", () => {
  let teacherId;
  let lessonLockedId;
  let lessonPreviewId;
  let tokenNotEntitled;
  let tokenSubscribed;
  let tokenTeacher;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "T",
      lastName: "Teacher",
      email: "tp-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const q1 = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "mcq",
      question: "Q1 worst misconception",
      options: ["A", "B", "C"],
      correctIndex: 0,
      marks: 2,
      topicKey: "cells",
      status: "published",
    });
    const q2 = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      question: "Q2 middle misconception",
      marks: 3,
      topicKey: "cells",
      status: "published",
    });
    const q3 = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "mcq",
      question: "Q3 best performance",
      options: ["X", "Y"],
      correctIndex: 0,
      marks: 1,
      topicKey: "cells",
      status: "published",
    });

    const lessonLocked = await Lesson.create({
      title: "TP Locked",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: false,
      examQuestions: [
        { questionId: q1._id, addedAt: new Date() },
        { questionId: q2._id, addedAt: new Date() },
        { questionId: q3._id, addedAt: new Date() },
      ],
    });
    lessonLockedId = lessonLocked._id;

    const lessonPreview = await Lesson.create({
      title: "TP Preview",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: true,
      examQuestions: [{ questionId: q1._id, addedAt: new Date() }],
    });
    lessonPreviewId = lessonPreview._id;

    const uNotEntitled = await User.create({
      firstName: "Student",
      lastName: "None",
      email: "tp-not-entitled@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });
    const future = new Date(Date.now() + 86400000);
    const uSubscribed = await User.create({
      firstName: "Student",
      lastName: "Sub",
      email: "tp-subscribed@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: { status: "active", expiresAt: future },
      purchasedLessons: [],
    });

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    tokenNotEntitled = await login("tp-not-entitled@test.com");
    tokenSubscribed = await login("tp-subscribed@test.com");
    tokenTeacher = await login("tp-teacher@test.com");
  }, 15000);

  test("NOT_ENTITLED user gets 402", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonLockedId}/targeted-practice?days=14&limit=10`)
      .set("Authorization", `Bearer ${tokenNotEntitled}`);
    expect(res.status).toBe(402);
    expect(res.body.reason).toBe("NOT_ENTITLED");
  });

  test("FREE_PREVIEW returns 200 with allowed:false and empty questions", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonPreviewId}/targeted-practice?days=14`)
      .set("Authorization", `Bearer ${tokenNotEntitled}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.allowed).toBe(false);
    expect(res.body.reason).toBe("FREE_PREVIEW");
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions).toHaveLength(0);
  });

  test("SUB_ACTIVE: ordering by misconception score (Q1 worst first)", async () => {
    const studentId = (await User.findOne({ email: "tp-subscribed@test.com" }).select("_id").lean())._id;
    const lesson = await Lesson.findById(lessonLockedId).select("examQuestions").lean();
    const refs = lesson.examQuestions || [];
    const q1Id = refs[0]?.questionId;
    const q2Id = refs[1]?.questionId;
    const q3Id = refs[2]?.questionId;
    if (!q1Id || !q2Id || !q3Id) throw new Error("missing question ids");

    await PracticeAttempt.deleteMany({ userId: studentId, lessonId: lessonLockedId, source: "practice" });

    await PracticeAttempt.create([
      { userId: studentId, lessonId: lessonLockedId, source: "practice", questionId: q1Id, questionType: "mcq", isCorrect: false, confidence: 3 },
      { userId: studentId, lessonId: lessonLockedId, source: "practice", questionId: q1Id, questionType: "mcq", isCorrect: false, confidence: 3 },
      { userId: studentId, lessonId: lessonLockedId, source: "practice", questionId: q1Id, questionType: "mcq", isCorrect: false, confidence: 2 },
      { userId: studentId, lessonId: lessonLockedId, source: "practice", questionId: q2Id, questionType: "short", isCorrect: false, confidence: 2 },
      { userId: studentId, lessonId: lessonLockedId, source: "practice", questionId: q2Id, questionType: "short", isCorrect: false, confidence: 1 },
      { userId: studentId, lessonId: lessonLockedId, source: "practice", questionId: q3Id, questionType: "mcq", isCorrect: true, confidence: 2 },
      { userId: studentId, lessonId: lessonLockedId, source: "practice", questionId: q3Id, questionType: "mcq", isCorrect: true, confidence: 2 },
    ]);

    const res = await request(app)
      .get(`/api/lessons/${lessonLockedId}/targeted-practice?days=14&limit=10`)
      .set("Authorization", `Bearer ${tokenSubscribed}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.allowed).toBe(true);
    expect(res.body.days).toBe(14);
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBeGreaterThanOrEqual(1);

    const firstId = res.body.questions[0].id;
    expect(firstId).toBe(String(q1Id));
    expect(res.body.questions[0].question).toContain("Q1 worst");
  });
});
