/**
 * PR16: POST /api/reports/lessons/:lessonId/one-click-fix
 * One-click: attach questions by topic + regenerate reteach plan. Teacher owner or admin only.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");
const ReteachPlan = require("../models/ReteachPlan");

jest.setTimeout(20000);

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("POST /api/reports/lessons/:lessonId/one-click-fix", () => {
  let ownerId;
  let otherTeacherId;
  let ownerToken;
  let otherToken;
  let lessonId;
  let lessonUnmappedId;
  let prevDisable;

  beforeAll(async () => {
    prevDisable = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    const owner = await User.create({
      firstName: "Owner",
      lastName: "Teacher",
      email: "ocf-owner@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const other = await User.create({
      firstName: "Other",
      lastName: "Teacher",
      email: "ocf-other@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    otherTeacherId = other._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    ownerToken = await login("ocf-owner@test.com");
    otherToken = await login("ocf-other@test.com");

    const lesson = await Lesson.create({
      title: "OCF Lesson",
      description: "D",
      content: "C",
      teacherId: ownerId,
      teacherName: "Owner Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      status: "published",
      isPublished: true,
      examQuestions: [],
    });
    lessonId = lesson._id;

    const lessonUnmapped = await Lesson.create({
      title: "Unmapped Topic",
      description: "D",
      content: "C",
      teacherId: ownerId,
      teacherName: "Owner",
      subject: "Biology",
      level: "GCSE",
      topic: "Some Random Topic Not In Taxonomy",
      status: "draft",
      examQuestions: [],
    });
    lessonUnmappedId = lessonUnmapped._id;

    for (let i = 0; i < 5; i++) {
      await ExamQuestion.create({
        teacherId: ownerId,
        subject: "Biology",
        type: "mcq",
        question: `OCF Q ${i}?`,
        topicKey: "photosynthesis",
        marks: 2,
        status: "published",
      });
    }
  });

  afterAll(() => {
    if (prevDisable === undefined) delete process.env.DISABLE_OPENAI;
    else process.env.DISABLE_OPENAI = prevDisable;
  });

  test("401 without auth", async () => {
    const res = await request(app).post(`/api/reports/lessons/${lessonId}/one-click-fix`).send({});
    expect(res.status).toBe(401);
  });

  test("403 non-owner teacher", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/one-click-fix`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ attachByTopic: true, regeneratePlan: false });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/owner|forbidden/i);
  });

  test("invalid topicKey => 400", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/one-click-fix`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ topicKey: "not-a-valid-key-xyz", attachByTopic: true, regeneratePlan: false });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("unmapped lesson.topic and no topicKey with attachByTopic true => 400", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonUnmappedId}/one-click-fix`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ attachByTopic: true, regeneratePlan: false });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/topic/i);
  });

  test("owner success: attachByTopic true + regeneratePlan false => ok, attach.added >= 0, plan object", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/one-click-fix`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        days: 7,
        topicKey: "photosynthesis",
        attachByTopic: true,
        attachLimit: 10,
        regeneratePlan: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.lessonId).toBe(String(lessonId));
    expect(res.body.topicKey).toBe("photosynthesis");
    expect(res.body.attach).toBeDefined();
    expect(typeof res.body.attach.requested).toBe("number");
    expect(typeof res.body.attach.added).toBe("number");
    expect(Array.isArray(res.body.attach.addedIds)).toBe(true);
    expect(res.body.attach.added).toBeGreaterThanOrEqual(0);
    expect(res.body.plan).toBeDefined();
    expect(res.body.plan.status).toBe("SKIPPED");
    expect(res.body.plan.id).toBeNull();
    expect(res.body.plan.cached).toBe(false);
  });

  test("idempotency: second call same lesson => attach.added 0", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/one-click-fix`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        topicKey: "photosynthesis",
        attachByTopic: true,
        attachLimit: 10,
        regeneratePlan: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.attach.added).toBe(0);
    expect(res.body.attach.addedIds).toEqual([]);
  });

  test("owner with regeneratePlan true and DISABLE_OPENAI=1 => 200, plan.status NOT_CONFIGURED, attach present, no content", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/one-click-fix`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        days: 7,
        topicKey: "photosynthesis",
        attachByTopic: true,
        attachLimit: 10,
        regeneratePlan: true,
        planLimit: 10,
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.attach).toBeDefined();
    expect(typeof res.body.attach.added).toBe("number");
    expect(Array.isArray(res.body.attach.addedIds)).toBe(true);
    expect(res.body.plan).toBeDefined();
    expect(res.body.plan.status).toBe("NOT_CONFIGURED");
    expect(res.body.plan.content).toBeUndefined();
    expect(res.body.plan.classroomNotes).toBeUndefined();
  });
});
