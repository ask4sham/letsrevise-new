/**
 * PR-EDGE-1: Auto-generate from topic banks on lesson creation.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const TopicPastPaper = require("../models/TopicPastPaper");

const hashedPassword = bcrypt.hashSync("password123", 10);

const basePayload = {
  title: "AutoGen Test Lesson",
  description: "Test description",
  content: "Content",
  subject: "Biology",
  level: "GCSE",
  board: "AQA",
  topic: "Diffusion",
  tier: "foundation",
  estimatedDuration: 30,
  shamCoinPrice: 0,
  pages: [{ pageId: "p1", title: "Page 1", order: 1, blocks: [{ type: "text", content: "Content" }] }],
};

describe("Lesson create with autoGenerateFromBanks (PR-EDGE-1)", () => {
  let teacherToken;
  let teacherId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "AutoGen",
      lastName: "Teacher",
      email: "autogen-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "autogen-teacher@test.com", password: "password123" });
    teacherToken = loginRes.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    const topicKey = "diffusion";

    const fcRes = await request(app)
      .post("/api/topic-flashcards/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, items: [{ front: "What is diffusion?", back: "Movement of particles from high to low concentration" }] });
    for (const id of fcRes.body.createdIds || []) {
      await request(app).post(`/api/topic-flashcards/${id}/publish`).set("Authorization", `Bearer ${teacherToken}`);
    }

    const qRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, kind: "quiz", items: [{ questionText: "Quiz Q?", choices: ["A", "B"], correctIndex: 0 }] });
    for (const id of qRes.body.createdIds || []) {
      await request(app).post(`/api/topic-quiz-questions/${id}/publish`).set("Authorization", `Bearer ${teacherToken}`);
    }

    const aRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, kind: "assessment", items: [{ questionText: "Assessment Q?", choices: ["X", "Y"], correctIndex: 1 }] });
    for (const id of aRes.body.createdIds || []) {
      await request(app).post(`/api/topic-quiz-questions/${id}/publish`).set("Authorization", `Bearer ${teacherToken}`);
    }

    const ppRes = await request(app)
      .post("/api/topic-past-papers/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, items: [{ title: "Paper 1", url: "https://www.aqa.org.uk/paper1.pdf" }] });
    for (const id of ppRes.body.createdIds || []) {
      await request(app).post(`/api/topic-past-papers/${id}/publish`).set("Authorization", `Bearer ${teacherToken}`);
    }
  });

  afterAll(async () => {
    await TopicFlashcard.deleteMany({ ownerId: teacherId });
    await TopicQuizQuestion.deleteMany({ ownerId: teacherId });
    await TopicPastPaper.deleteMany({ ownerId: teacherId });
    await Lesson.deleteMany({ teacherId });
  });

  test("autoGenerateFromBanks ON → content exists", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ ...basePayload, autoGenerateFromBanks: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.lesson).toBeDefined();
    expect(res.body.autoGenerateResult).toBeDefined();
    expect(res.body.autoGenerateResult.flashcardsAdded).toBeGreaterThanOrEqual(1);
    expect(res.body.autoGenerateResult.quizAdded).toBeGreaterThanOrEqual(1);
    expect(res.body.autoGenerateResult.assessmentAdded).toBeGreaterThanOrEqual(1);
    expect(res.body.autoGenerateResult.pastPapersAdded).toBeGreaterThanOrEqual(1);

    const lesson = await Lesson.findById(res.body.lesson._id).lean();
    expect(Array.isArray(lesson.flashcards)).toBe(true);
    expect(lesson.flashcards.length).toBeGreaterThanOrEqual(1);
    expect(lesson.quiz?.questions?.length).toBeGreaterThanOrEqual(1);
    expect(lesson.assessment?.questions?.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(lesson.pastPapers)).toBe(true);
    expect(lesson.pastPapers.length).toBeGreaterThanOrEqual(1);
  });

  test("autoGenerateFromBanks OFF → lesson empty of bank content", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ ...basePayload, autoGenerateFromBanks: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.autoGenerateResult).toBeUndefined();

    const lesson = await Lesson.findById(res.body.lesson._id).lean();
    expect(Array.isArray(lesson.flashcards)).toBe(true);
    expect(lesson.flashcards.length).toBe(0);
    expect(!lesson.quiz?.questions?.length || lesson.quiz.questions.length === 0).toBe(true);
    expect(!lesson.assessment?.questions?.length || lesson.assessment.questions.length === 0).toBe(true);
    expect(Array.isArray(lesson.pastPapers)).toBe(true);
    expect(lesson.pastPapers.length).toBe(0);
  });

  test("missing topicKey (invalid topic) → auto-generate ignored safely", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        ...basePayload,
        topic: "XyzNonexistent999",
        autoGenerateFromBanks: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.autoGenerateResult).toBeDefined();
    expect(res.body.autoGenerateResult.flashcardsAdded).toBe(0);
    expect(res.body.autoGenerateResult.quizAdded).toBe(0);
    expect(res.body.autoGenerateResult.assessmentAdded).toBe(0);
    expect(res.body.autoGenerateResult.pastPapersAdded).toBe(0);
  });
});
