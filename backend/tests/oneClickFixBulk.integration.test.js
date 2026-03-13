/**
 * PR17: POST /api/reports/lessons/:lessonId/one-click-fix-bulk
 * Bulk attach for top N hotspot topics + single plan regen. Owner or admin only.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const { buildTopicKey } = require("../utils/topicKey");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");
const PracticeAttempt = require("../models/PracticeAttempt");

const SPEC_KEY = "aqa-gcse-biology";

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(20000);

describe("POST /api/reports/lessons/:lessonId/one-click-fix-bulk", () => {
  let ownerId;
  let otherTeacherId;
  let ownerToken;
  let otherToken;
  let lessonId;
  let studentId;
  let prevDisable;

  beforeAll(async () => {
    prevDisable = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";

    const owner = await User.create({
      firstName: "Bulk",
      lastName: "Owner",
      email: "bulk-owner@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const other = await User.create({
      firstName: "Other",
      lastName: "Teacher",
      email: "bulk-other@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    otherTeacherId = other._id;

    const student = await User.create({
      firstName: "S",
      lastName: "Student",
      email: "bulk-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    studentId = student._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    ownerToken = await login("bulk-owner@test.com");
    otherToken = await login("bulk-other@test.com");

    const lesson = await Lesson.create({
      title: "Bulk Lesson",
      description: "D",
      content: "C",
      teacherId: ownerId,
      teacherName: "Bulk Owner",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      status: "published",
      isPublished: true,
      examQuestions: [],
    });
    lessonId = lesson._id;

    const qPhoto = await ExamQuestion.create({
      teacherId: ownerId,
      subject: "Biology",
      type: "mcq",
      question: "Bulk photosynthesis?",
      topicKey: "photosynthesis",
      marks: 2,
      status: "published",
    });
    const qResp = await ExamQuestion.create({
      teacherId: ownerId,
      subject: "Biology",
      type: "mcq",
      question: "Bulk respiration?",
      topicKey: "respiration",
      marks: 2,
      status: "published",
    });
    const qCell = await ExamQuestion.create({
      teacherId: ownerId,
      subject: "Biology",
      type: "mcq",
      question: "Bulk cell?",
      topicKey: "cell-structure",
      marks: 2,
      status: "published",
    });

    await PracticeAttempt.create([
      {
        studentId,
        teacherId: ownerId,
        specKey: SPEC_KEY,
        topicKey: buildTopicKey(SPEC_KEY, "photosynthesis"),
        sourceType: "examQuestion",
        sourceId: qPhoto._id,
        outcome: "wrong",
        confidence: 3,
      },
      {
        studentId,
        teacherId: ownerId,
        specKey: SPEC_KEY,
        topicKey: buildTopicKey(SPEC_KEY, "respiration"),
        sourceType: "examQuestion",
        sourceId: qResp._id,
        outcome: "wrong",
        confidence: 3,
      },
      {
        studentId,
        teacherId: ownerId,
        specKey: SPEC_KEY,
        topicKey: buildTopicKey(SPEC_KEY, "cell-structure"),
        sourceType: "examQuestion",
        sourceId: qCell._id,
        outcome: "wrong",
        confidence: 3,
      },
    ]);
  });

  afterAll(() => {
    if (prevDisable === undefined) delete process.env.DISABLE_OPENAI;
    else process.env.DISABLE_OPENAI = prevDisable;
  });

  test("401 without auth", async () => {
    const res = await request(app).post(`/api/reports/lessons/${lessonId}/one-click-fix-bulk`).send({});
    expect(res.status).toBe(401);
  });

  test("403 non-owner teacher", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/one-click-fix-bulk`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ attachByTopic: true, regeneratePlan: false });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/owner|forbidden/i);
  });

  test("400 invalid topicKey in body", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/one-click-fix-bulk`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ topicKeys: ["not-a-valid-key-xyz"], attachByTopic: true, regeneratePlan: false });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("owner with explicit topicKeys returns 200, attach present, topics.length === sent, plan.status NOT_CONFIGURED, no content", async () => {
    const topicKeys = ["photosynthesis", "respiration", "cell-structure"];
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/one-click-fix-bulk`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        days: 7,
        topicKeys,
        attachByTopic: true,
        attachLimitPerTopic: 10,
        regeneratePlan: true,
        planLimit: 10,
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.lessonId).toBe(String(lessonId));
    expect(res.body.days).toBe(7);
    expect(Array.isArray(res.body.topics)).toBe(true);
    expect(res.body.topics.length).toBe(topicKeys.length);
    expect(res.body.attach).toBeDefined();
    expect(typeof res.body.attach.requested).toBe("number");
    expect(typeof res.body.attach.added).toBe("number");
    expect(Array.isArray(res.body.attach.addedIds)).toBe(true);
    expect(res.body.plan).toBeDefined();
    expect(res.body.plan.status).toBe("NOT_CONFIGURED");
    expect(res.body.plan.content).toBeUndefined();
    expect(res.body.plan.classroomNotes).toBeUndefined();
  });

  test("idempotency: second call same topicKeys => attach.added 0", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/one-click-fix-bulk`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        days: 7,
        topicKeys: ["photosynthesis", "respiration", "cell-structure"],
        attachByTopic: true,
        attachLimitPerTopic: 10,
        regeneratePlan: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.attach.added).toBe(0);
    expect(res.body.attach.addedIds).toEqual([]);
  });

  test("topicKeys omitted: derives top topics from insights, returns topics.length > 0", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/one-click-fix-bulk`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        days: 7,
        attachByTopic: true,
        attachLimitPerTopic: 10,
        regeneratePlan: true,
        planLimit: 10,
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.topics)).toBe(true);
    expect(res.body.topics.length).toBeGreaterThan(0);
    expect(res.body.plan.status).toBe("NOT_CONFIGURED");
  });
});
