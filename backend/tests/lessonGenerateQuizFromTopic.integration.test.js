/**
 * PR-Q2: Generate quiz from topic bank — integration tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Generate Quiz from Topic Bank (PR-Q2)", () => {
  let teacherToken;
  let teacherId;
  let otherTeacherToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "QuizGen",
      lastName: "Teacher",
      email: "quizgen-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const otherTeacher = await User.create({
      firstName: "Other",
      lastName: "Teacher",
      email: "quizgen-other@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const loginTeacher = await request(app)
      .post("/api/auth/login")
      .send({ email: "quizgen-teacher@test.com", password: "password123" });
    teacherToken = loginTeacher.body?.token;
    const loginOther = await request(app)
      .post("/api/auth/login")
      .send({ email: "quizgen-other@test.com", password: "password123" });
    otherTeacherToken = loginOther.body?.token;
    if (!teacherToken || !otherTeacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await TopicQuizQuestion.deleteMany({ ownerId: teacherId });
  });

  test("generates published-only", async () => {
    const topicKey = "diffusion";
    const bulkRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [
          { questionText: "Gen A?", choices: ["A", "B"], correctIndex: 0 },
          { questionText: "Gen B?", choices: ["X", "Y"], correctIndex: 1 },
        ],
      });
    expect(bulkRes.status).toBe(200);
    const ids = bulkRes.body.createdIds;
    await request(app)
      .post(`/api/topic-quiz-questions/${ids[0]}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`);

    const lesson = await Lesson.create({
      title: "Quiz gen lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "QuizGen Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Diffusion",
      topicKey,
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      quiz: { timeSeconds: 600, questions: [] },
    });

    const genRes = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/quiz-from-topic`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(genRes.status).toBe(200);
    expect(genRes.body.ok).toBe(true);
    expect(genRes.body.addedCount).toBe(1);
    expect(genRes.body.questionsCount).toBe(1);

    const getRes = await request(app)
      .get(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.status).toBe(200);
    expect(["OWNER", "OWNER_DRAFT"]).toContain(getRes.body.accessDecision?.reason);
    expect(getRes.body.quiz).toBeDefined();
    expect(Array.isArray(getRes.body.quiz.questions)).toBe(true);
    expect(getRes.body.quiz.questions.length).toBe(1);
  });

  test("draft-only bank -> 0 added", async () => {
    const topicKey = "osmosis";
    const bulkRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [
          { questionText: "Draft Q?", choices: ["A", "B"], correctIndex: 0 },
        ],
      });
    expect(bulkRes.status).toBe(200);

    const lesson = await Lesson.create({
      title: "Draft only lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "QuizGen Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Osmosis",
      topicKey,
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      quiz: { timeSeconds: 600, questions: [] },
    });

    const genRes = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/quiz-from-topic`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(genRes.status).toBe(200);
    expect(genRes.body.addedCount).toBe(0);
    expect(genRes.body.questionsCount).toBe(0);
  });

  test("replace semantics", async () => {
    const topicKey = "cell-structure";
    const bulkRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [
          { questionText: "Replace Q1?", choices: ["A", "B"], correctIndex: 0 },
          { questionText: "Replace Q2?", choices: ["X", "Y"], correctIndex: 1 },
        ],
      });
    expect(bulkRes.status).toBe(200);
    for (const id of bulkRes.body.createdIds) {
      await request(app)
        .post(`/api/topic-quiz-questions/${id}/publish`)
        .set("Authorization", `Bearer ${teacherToken}`);
    }

    const lesson = await Lesson.create({
      title: "Replace semantics lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "QuizGen Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      topicKey,
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      quiz: {
        timeSeconds: 600,
        questions: [
          { id: "manual1", type: "mcq", question: "Manual Q?", options: ["A", "B"], correctAnswer: "A" },
        ],
      },
    });

    const genRes = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/quiz-from-topic`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(genRes.status).toBe(200);
    expect(genRes.body.addedCount).toBe(2);
    expect(genRes.body.questionsCount).toBe(2);

    const getRes = await request(app)
      .get(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.body.quiz.questions.length).toBe(2);
    expect(getRes.body.quiz.questions.some((q) => q.question === "Manual Q?")).toBe(false);
  });

  test("no topicKey -> 400", async () => {
    const lesson = await Lesson.create({
      title: "No topic lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "QuizGen Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: ".",
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      quiz: { timeSeconds: 600, questions: [] },
    });
    await Lesson.updateOne({ _id: lesson._id }, { $unset: { topicKey: 1 } });

    const genRes = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/quiz-from-topic`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(genRes.status).toBe(400);
    expect(genRes.body.msg).toMatch(/topicKey|topic/);
  });

  test("teacher B (not owner) -> 404 (no existence leak)", async () => {
    const topicKey = "microscopy";
    const lesson = await Lesson.create({
      title: "Owner lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "QuizGen Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Microscopy",
      topicKey,
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      quiz: { timeSeconds: 600, questions: [] },
    });

    const genRes = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/quiz-from-topic`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    expect(genRes.status).toBe(404);
  });
});
