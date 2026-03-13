/**
 * PR-CONTENT-TARGETING-1: topicKeyForBank enforcement — AI generation rejects missing/invalid topicKey.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Content targeting (PR-CONTENT-TARGETING-1)", () => {
  let teacherToken;
  let teacherId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Target",
      lastName: "Teacher",
      email: "target-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "target-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  }, 15000);

  test("generate flashcards-from-topic: missing topicKey → 400", async () => {
    const lesson = await Lesson.create({
      title: "No topic lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "Target Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Generic",
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      quiz: { timeSeconds: 600, questions: [] },
      // no topicKey — API should return 400
    });

    const res = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/flashcards-from-topic`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/topicKey|syllabus topic/);
  });

  test("generate flashcards-from-topic: valid topicKey → 200", async () => {
    const lesson = await Lesson.create({
      title: "Cell lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "Target Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cell structure",
      topicKey: "cell-structure",
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      quiz: { timeSeconds: 600, questions: [] },
    });

    const res = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/flashcards-from-topic`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("generate quiz-from-topic: missing topicKey → 400", async () => {
    const lesson = await Lesson.create({
      title: "No topic quiz lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "Target Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Generic",
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      quiz: { timeSeconds: 600, questions: [] },
      // no topicKey — API should return 400
    });

    const res = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/quiz-from-topic`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/topicKey|syllabus topic/);
  });
});
