/**
 * USP 3a: topicKey validation and lesson exam-questions attach/remove.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("ExamQuestion topicKey validation", () => {
  let teacherToken;
  let teacherId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Topic",
      lastName: "Teacher",
      email: "topic-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "topic-teacher@test.com", password: "password123" });
    teacherToken = loginRes.body?.token;
    if (!teacherToken) throw new Error("Failed to get teacher token");
  });

  test("POST with valid topicKey accepts and stores", async () => {
    const res = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        subject: "Biology",
        examBoard: "AQA",
        level: "GCSE",
        topicKey: "photosynthesis",
        type: "mcq",
        marks: 2,
        question: "What is the product of photosynthesis?",
        options: ["Glucose", "Starch", "Protein", "Lipid"],
        correctIndex: 0,
      });
    expect(res.status).toBe(201);
    expect(res.body.question).toBeDefined();
    expect(res.body.question.topicKey).toBe("photosynthesis");
  });

  test("POST with invalid topicKey returns 400", async () => {
    const res = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        subject: "Biology",
        type: "short",
        marks: 1,
        question: "Test?",
        topicKey: "not-a-real-topic-key-xyz",
      });
    expect(res.status).toBe(400);
    expect(res.body.error || res.body.msg).toMatch(/topicKey|Invalid/);
  });

  test("GET list with topicKey filter returns only matching questions", async () => {
    const res = await request(app)
      .get("/api/exam-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ topicKey: "photosynthesis" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.questions)).toBe(true);
    res.body.questions.forEach((q) => {
      expect(q.topicKey).toBe("photosynthesis");
    });
  });
});

describe("GET exam-questions draft and published (PR-W2.2)", () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  const bankTopicKey = "cell-division";

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Bank",
      lastName: "Teacher",
      email: "bank-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const student = await User.create({
      firstName: "Bank",
      lastName: "Student",
      email: "bank-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    const loginTeacher = await request(app)
      .post("/api/auth/login")
      .send({ email: "bank-teacher@test.com", password: "password123" });
    teacherToken = loginTeacher.body?.token;
    const loginStudent = await request(app)
      .post("/api/auth/login")
      .send({ email: "bank-student@test.com", password: "password123" });
    studentToken = loginStudent.body?.token;
    if (!teacherToken || !studentToken) throw new Error("Failed to get tokens");

    await ExamQuestion.create([
      {
        teacherId,
        subject: "Biology",
        examBoard: "AQA",
        level: "GCSE",
        topicKey: bankTopicKey,
        topic: "Cell Division",
        type: "mcq",
        marks: 1,
        question: "PR-W2.2 draft question?",
        status: "draft",
      },
      {
        teacherId,
        subject: "Biology",
        examBoard: "AQA",
        level: "GCSE",
        topicKey: bankTopicKey,
        topic: "Cell Division",
        type: "short",
        marks: 2,
        question: "PR-W2.2 published question?",
        status: "published",
      },
    ]);
  });

  test("as teacher: GET with no status returns both draft and published for topicKey", async () => {
    const res = await request(app)
      .get("/api/exam-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ topicKey: bankTopicKey });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.questions)).toBe(true);
    const list = res.body.questions;
    const statuses = list.map((q) => q.status);
    expect(statuses).toContain("draft");
    expect(statuses).toContain("published");
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  test("as teacher: GET ?status=draft returns only draft", async () => {
    const res = await request(app)
      .get("/api/exam-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ topicKey: bankTopicKey, status: "draft" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.questions)).toBe(true);
    res.body.questions.forEach((q) => expect(q.status).toBe("draft"));
  });

  test("as teacher: GET ?status=published returns only published", async () => {
    const res = await request(app)
      .get("/api/exam-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ topicKey: bankTopicKey, status: "published" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.questions)).toBe(true);
    res.body.questions.forEach((q) => expect(q.status).toBe("published"));
  });

  test("as student: GET returns 403", async () => {
    const res = await request(app)
      .get("/api/exam-questions")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });
});

describe("Lesson exam-questions attach/remove", () => {
  let teacherToken;
  let teacherId;
  let lessonId;
  let questionId1;
  let questionId2;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Attach",
      lastName: "Teacher",
      email: "attach-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "attach-teacher@test.com", password: "password123" });
    teacherToken = loginRes.body?.token;
    if (!teacherToken) throw new Error("Failed to get teacher token");

    const lesson = await Lesson.create({
      title: "Test Lesson",
      description: "Desc",
      content: "Content",
      teacherId,
      teacherName: "Attach Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      status: "draft",
    });
    lessonId = lesson._id;

    const q1 = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "mcq",
      question: "Q1?",
      topicKey: "photosynthesis",
      status: "draft",
    });
    const q2 = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      question: "Q2?",
      topicKey: "photosynthesis",
      status: "draft",
    });
    questionId1 = q1._id;
    questionId2 = q2._id;
  });

  test("POST /lessons/:id/exam-questions adds questions and GET returns them", async () => {
    const addRes = await request(app)
      .post(`/api/lessons/${lessonId}/exam-questions`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ questionIds: [String(questionId1), String(questionId2)] });
    expect(addRes.status).toBe(200);
    expect(addRes.body.ok).toBe(true);
    expect(addRes.body.added).toBe(2);

    const getRes = await request(app)
      .get(`/api/lessons/${lessonId}/exam-questions`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body.questions)).toBe(true);
    expect(getRes.body.questions.length).toBe(2);
  });

  test("POST with duplicate questionIds does not duplicate", async () => {
    const addRes = await request(app)
      .post(`/api/lessons/${lessonId}/exam-questions`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ questionIds: [String(questionId1)] });
    expect(addRes.status).toBe(200);
    expect(addRes.body.added).toBe(0);

    const getRes = await request(app)
      .get(`/api/lessons/${lessonId}/exam-questions`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.body.questions.length).toBe(2);
  });

  test("DELETE /lessons/:id/exam-questions/:questionId removes one", async () => {
    const delRes = await request(app)
      .delete(`/api/lessons/${lessonId}/exam-questions/${questionId1}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.removed).toBe(true);

    const getRes = await request(app)
      .get(`/api/lessons/${lessonId}/exam-questions`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.body.questions.length).toBe(1);
    expect(getRes.body.questions[0]._id).toBe(String(questionId2));
  });
});
