/**
 * PR-COVERAGE-1: GET /api/teacher/topic-coverage — auth + counts per topic.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const { buildTopicKey } = require("../utils/topicKey");

describe("GET /api/teacher/topic-coverage", () => {
  let token;
  let teacher;

  beforeAll(async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    teacher = await User.create({
      email: "coverage@test.com",
      password: pw,
      firstName: "Test",
      lastName: "Teacher",
      userType: "teacher",
    });

    const login = await request(app).post("/api/auth/login").send({
      email: "coverage@test.com",
      password: "Pass123!",
    });
    token = login.body?.token;
    if (!token) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await TopicFlashcard.deleteMany({ ownerId: teacher._id });
    await TopicQuizQuestion.deleteMany({ ownerId: teacher._id });
  });

  test("requires auth", async () => {
    const res = await request(app).get("/api/teacher/topic-coverage?specKey=aqa-gcse-biology");
    expect(res.status).toBe(401);
  });

  test("returns 400 when specKey missing", async () => {
    const res = await request(app)
      .get("/api/teacher/topic-coverage")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/specKey/i);
  });

  test("returns counts for taxonomy topics", async () => {
    const namespacedCell = buildTopicKey("aqa-gcse-biology", "cell-structure");
    const namespacedDiffusion = buildTopicKey("aqa-gcse-biology", "diffusion");

    await TopicFlashcard.create([
      { ownerId: teacher._id, topicKey: namespacedCell, front: "Q1", back: "A1", status: "draft", fingerprint: "cov-f1" },
      { ownerId: teacher._id, topicKey: namespacedCell, front: "Q2", back: "A2", status: "draft", fingerprint: "cov-f2" },
    ]);

    await TopicQuizQuestion.create([
      {
        ownerId: teacher._id,
        topicKey: namespacedCell,
        type: "mcq",
        questionText: "MCQ?",
        choices: ["A", "B"],
        correctIndex: 0,
        status: "draft",
        kind: "quiz",
        fingerprint: "cov-q1",
      },
      {
        ownerId: teacher._id,
        topicKey: namespacedDiffusion,
        type: "short-answer",
        questionText: "SA?",
        acceptableAnswers: ["diffusion"],
        matchMode: "contains",
        status: "draft",
        kind: "quiz",
        fingerprint: "cov-q2",
      },
    ]);

    const res = await request(app)
      .get("/api/teacher/topic-coverage?specKey=aqa-gcse-biology")
      .set("Authorization", `Bearer ${token}`);

    if (res.status !== 200) {
      throw new Error(`Expected 200 but got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    expect(res.status).toBe(200);
    expect(res.body.specKey).toBe("aqa-gcse-biology");
    expect(Array.isArray(res.body.units)).toBe(true);
    expect(res.body.totals).toBeDefined();
    expect(typeof res.body.totals.topics).toBe("number");
    expect(typeof res.body.totals.topicsWithAny).toBe("number");
    expect(typeof res.body.totals.topicsFullyCovered).toBe("number");

    const all = res.body.units.flatMap((u) => u.topics);
    const cell = all.find((t) => t.topicKey === "cell-structure");
    expect(cell).toBeTruthy();
    expect(cell.counts.flashcards).toBeGreaterThanOrEqual(2);
    expect(cell.counts.quiz_mcq).toBeGreaterThanOrEqual(1);
    expect(cell.coverage.any).toBe(true);
    expect(cell.coverage.score).toBeGreaterThanOrEqual(2);
    expect(cell.coverage.outOf).toBe(5);

    const diffusion = all.find((t) => t.topicKey === "diffusion");
    expect(diffusion).toBeTruthy();
    expect(diffusion.counts.quiz_short).toBeGreaterThanOrEqual(1);
  });
});
