/**
 * PR3a.1: attach-by-topic endpoint — one-click auto-attach questions by topicKey.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(20000);

describe("POST /api/lessons/:id/exam-questions/attach-by-topic", () => {
  let teacherToken;
  let teacherId;
  let lessonId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "AttachByTopic",
      lastName: "Teacher",
      email: "attachbytopic@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "attachbytopic@test.com", password: "password123" });
    teacherToken = loginRes.body?.token;
    if (!teacherToken) throw new Error("Failed to get teacher token");

    const lesson = await Lesson.create({
      title: "Photosynthesis Lesson",
      description: "Desc",
      content: "Content",
      teacherId,
      teacherName: "AttachByTopic Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      status: "draft",
    });
    lessonId = lesson._id;

    const questions = [];
    for (let i = 0; i < 15; i++) {
      const q = await ExamQuestion.create({
        teacherId,
        subject: "Biology",
        type: "mcq",
        question: `Q photosynthesis ${i}?`,
        topicKey: "photosynthesis",
        marks: (i % 3) + 1,
        status: "draft",
      });
      questions.push(q);
    }
    await lesson.updateOne({
      $push: {
        examQuestions: [
          { questionId: questions[0]._id, addedAt: new Date() },
          { questionId: questions[1]._id, addedAt: new Date() },
        ],
      },
    });
  });

  test("no body => derives topicKey from lesson.topic, adds up to limit excluding already attached", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/exam-questions/attach-by-topic`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ limit: 20 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.topicKey).toBe("aqa-gcse-biology:photosynthesis");
    expect(res.body.requested).toBe(20);
    expect(res.body.added).toBeLessThanOrEqual(20);
    expect(Array.isArray(res.body.addedIds)).toBe(true);
    // Display title is not resolved for namespaced topicKey lookups (topicKey is authoritative).
    expect(res.body.topic).toBeNull();
  });

  test("call again => added 0 (idempotent)", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/exam-questions/attach-by-topic`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.added).toBe(0);
    expect(res.body.addedIds).toEqual([]);
  });

  test("limit=5 => adds 5 more when lesson has room", async () => {
    const lesson2 = await Lesson.create({
      title: "Another Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "AttachByTopic Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cell structure",
      status: "draft",
    });
    const qs = await ExamQuestion.create([
      { teacherId, subject: "Biology", type: "short", question: "CS 1?", topicKey: "cell-structure", status: "draft" },
      { teacherId, subject: "Biology", type: "short", question: "CS 2?", topicKey: "cell-structure", status: "draft" },
      { teacherId, subject: "Biology", type: "short", question: "CS 3?", topicKey: "cell-structure", status: "draft" },
      { teacherId, subject: "Biology", type: "short", question: "CS 4?", topicKey: "cell-structure", status: "draft" },
      { teacherId, subject: "Biology", type: "short", question: "CS 5?", topicKey: "cell-structure", status: "draft" },
    ]);
    const res = await request(app)
      .post(`/api/lessons/${lesson2._id}/exam-questions/attach-by-topic`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.topicKey).toBe("aqa-gcse-biology:cell-structure");
    expect(res.body.added).toBe(5);
    expect(res.body.addedIds).toHaveLength(5);
  });

  test("invalid topicKey in body on unmapped lesson => 400", async () => {
    const lesson3 = await Lesson.create({
      title: "Weird Topic",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "AttachByTopic Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Some Random Topic Xyz",
      status: "draft",
    });
    const res = await request(app)
      .post(`/api/lessons/${lesson3._id}/exam-questions/attach-by-topic`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey: "not-a-real-topic-xyz" });
    expect(res.status).toBe(400);
    expect(res.body.error || res.body.msg).toBeDefined();
  });

  test("lesson topic not in taxonomy => 400 when no body topicKey", async () => {
    const lesson3 = await Lesson.create({
      title: "Weird Topic",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "AttachByTopic Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Some Random Topic Xyz",
      status: "draft",
    });
    const res = await request(app)
      .post(`/api/lessons/${lesson3._id}/exam-questions/attach-by-topic`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
