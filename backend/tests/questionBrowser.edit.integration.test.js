/**
 * PR-QUESTION-BROWSER-1: Question Browser edit (PATCH) integration tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const mongoose = require("mongoose");
const User = require("../models/User");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const { fingerprint } = require("../utils/quizDedupe");

jest.setTimeout(20000);

describe("Question Browser edits", () => {
  let token;
  let user;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("pass12345", 10);
    user = await User.create({
      email: "teacher_qb@example.com",
      password: passwordHash,
      userType: "teacher",
      firstName: "T",
      lastName: "E",
    });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "pass12345" });
    token = loginRes.body?.token;
    if (!token) throw new Error("Login failed");

    const fp = fingerprint("Test question", ["A", "B"], 0, "quiz");
    await TopicQuizQuestion.create({
      ownerId: user._id,
      topicKey: "aqa-gcse-biology:cell-structure",
      kind: "quiz",
      type: "mcq",
      questionText: "Test question",
      choices: ["A", "B"],
      correctIndex: 0,
      fingerprint: fp,
      status: "draft",
    });
  });

  afterAll(async () => {
    await TopicQuizQuestion.deleteMany({ ownerId: user._id });
    await User.deleteOne({ _id: user._id });
    await mongoose.connection.close();
  });

  test("PATCH /api/topic-quiz-questions/:id requires auth", async () => {
    const q = await TopicQuizQuestion.findOne({ ownerId: user._id });
    const res = await request(app)
      .patch(`/api/topic-quiz-questions/${q._id}`)
      .send({ questionText: "X" });
    expect(res.status).toBe(401);
  });

  test("PATCH rejects MCQ with <2 choices", async () => {
    const q = await TopicQuizQuestion.findOne({ ownerId: user._id });
    const res = await request(app)
      .patch(`/api/topic-quiz-questions/${q._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "mcq", choices: ["Only one"], correctChoice: "A" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2-6/i);
  });

  test("PATCH accepts MCQ with 2-6 choices + correctChoice in range", async () => {
    const q = await TopicQuizQuestion.findOne({ ownerId: user._id });
    const res = await request(app)
      .patch(`/api/topic-quiz-questions/${q._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "mcq", choices: ["One", "Two", "Three"], correctChoice: "C" });

    expect(res.status).toBe(200);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.choices.length).toBe(3);
    expect(res.body.item.correctIndex).toBe(2);
  });

  test("PATCH rejects short-answer with empty acceptableAnswers", async () => {
    const q = await TopicQuizQuestion.findOne({ ownerId: user._id });
    const res = await request(app)
      .patch(`/api/topic-quiz-questions/${q._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "short-answer", acceptableAnswers: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/acceptable/i);
  });

  test("PATCH accepts short-answer", async () => {
    const q = await TopicQuizQuestion.findOne({ ownerId: user._id });
    const res = await request(app)
      .patch(`/api/topic-quiz-questions/${q._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "short-answer", acceptableAnswers: ["nucleus"], matchMode: "contains" });

    expect(res.status).toBe(200);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.type).toBe("short-answer");
    expect(res.body.item.acceptableAnswers.length).toBeGreaterThan(0);
  });
});
