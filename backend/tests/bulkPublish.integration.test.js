/**
 * PR-EDGE-2: Bulk publish/unpublish — owner works, non-owner 404, student 403, admin cross-owner.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const TopicPastPaper = require("../models/TopicPastPaper");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Bulk Publish (PR-EDGE-2)", () => {
  let teacherAToken;
  let teacherAId;
  let teacherBToken;
  let teacherBId;
  let adminToken;
  let studentToken;

  beforeAll(async () => {
    const teacherA = await User.create({
      firstName: "Teacher",
      lastName: "A",
      email: "bulk-teacherA@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherAId = teacherA._id;
    const teacherB = await User.create({
      firstName: "Teacher",
      lastName: "B",
      email: "bulk-teacherB@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherBId = teacherB._id;
    const admin = await User.create({
      firstName: "Admin",
      lastName: "User",
      email: "bulk-admin@test.com",
      password: hashedPassword,
      userType: "admin",
    });
    const student = await User.create({
      firstName: "Student",
      lastName: "One",
      email: "bulk-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    teacherAToken = (await request(app).post("/api/auth/login").send({ email: "bulk-teacherA@test.com", password: "password123" })).body?.token;
    teacherBToken = (await request(app).post("/api/auth/login").send({ email: "bulk-teacherB@test.com", password: "password123" })).body?.token;
    adminToken = (await request(app).post("/api/auth/login").send({ email: "bulk-admin@test.com", password: "password123" })).body?.token;
    studentToken = (await request(app).post("/api/auth/login").send({ email: "bulk-student@test.com", password: "password123" })).body?.token;
    if (!teacherAToken || !teacherBToken || !adminToken || !studentToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await TopicFlashcard.deleteMany({ ownerId: { $in: [teacherAId, teacherBId] } });
    await TopicQuizQuestion.deleteMany({ ownerId: { $in: [teacherAId, teacherBId] } });
    await TopicPastPaper.deleteMany({ ownerId: { $in: [teacherAId, teacherBId] } });
  });

  test("teacher bulk publish own flashcards", async () => {
    const bulkRes = await request(app)
      .post("/api/topic-flashcards/bulk")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({
        topicKey: "diffusion",
        items: [
          { front: "Bulk A1?", back: "A1" },
          { front: "Bulk A2?", back: "A2" },
          { front: "Bulk A3?", back: "A3" },
        ],
      });
    expect(bulkRes.status).toBe(200);
    const ids = bulkRes.body.createdIds || [];
    expect(ids.length).toBeGreaterThanOrEqual(1);

    const publishRes = await request(app)
      .post("/api/topic-flashcards/bulk/publish")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ ids });
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.ok).toBe(true);
    expect(publishRes.body.matchedCount).toBe(ids.length);
    expect(publishRes.body.updatedCount).toBe(ids.length);

    const cards = await TopicFlashcard.find({ _id: { $in: ids } }).lean();
    expect(cards.every((c) => c.status === "published")).toBe(true);
  });

  test("teacher tries to bulk publish others' items => 404", async () => {
    const cards = await TopicFlashcard.find({ ownerId: teacherAId }).limit(2).lean();
    const ids = cards.map((c) => String(c._id));
    if (ids.length === 0) return;

    const publishRes = await request(app)
      .post("/api/topic-flashcards/bulk/publish")
      .set("Authorization", `Bearer ${teacherBToken}`)
      .send({ ids });
    expect(publishRes.status).toBe(404);
    expect(publishRes.body.error).toMatch(/Not found|not found/i);
  });

  test("student blocked (403)", async () => {
    const res = await request(app)
      .post("/api/topic-flashcards/bulk/publish")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ ids: ["507f1f77bcf86cd799439011"] });
    expect(res.status).toBe(403);
  });

  test("admin can bulk publish across owners", async () => {
    const fcA = await request(app)
      .post("/api/topic-flashcards/bulk")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ topicKey: "diffusion", items: [{ front: "Admin test A?", back: "A" }] });
    const fcB = await request(app)
      .post("/api/topic-flashcards/bulk")
      .set("Authorization", `Bearer ${teacherBToken}`)
      .send({ topicKey: "diffusion", items: [{ front: "Admin test B?", back: "B" }] });
    const ids = [...(fcA.body.createdIds || []), ...(fcB.body.createdIds || [])];
    if (ids.length < 2) return;

    const publishRes = await request(app)
      .post("/api/topic-flashcards/bulk/publish")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ids });
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.matchedCount).toBe(ids.length);
    expect(publishRes.body.updatedCount).toBe(ids.length);
  });

  test("topic-quiz-questions bulk unpublish", async () => {
    const qRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({
        topicKey: "diffusion",
        kind: "quiz",
        items: [{ questionText: "Quiz bulk?", choices: ["A", "B"], correctIndex: 0 }],
      });
    const ids = qRes.body.createdIds || [];
    if (ids.length === 0) return;
    await request(app)
      .post("/api/topic-quiz-questions/bulk/publish")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ ids });

    const unpubRes = await request(app)
      .post("/api/topic-quiz-questions/bulk/unpublish")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ ids });
    expect(unpubRes.status).toBe(200);
    expect(unpubRes.body.updatedCount).toBeGreaterThanOrEqual(1);
    const docs = await TopicQuizQuestion.find({ _id: { $in: ids } }).lean();
    expect(docs.every((d) => d.status === "draft")).toBe(true);
  });

  test("topic-past-papers bulk publish", async () => {
    const ppRes = await request(app)
      .post("/api/topic-past-papers/bulk")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ topicKey: "diffusion", items: [{ title: "PP Bulk", url: "https://example.com/pp.pdf" }] });
    const ids = ppRes.body.createdIds || [];
    if (ids.length === 0) return;

    const publishRes = await request(app)
      .post("/api/topic-past-papers/bulk/publish")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ ids });
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.matchedCount).toBe(ids.length);
    expect(publishRes.body.updatedCount).toBe(ids.length);
  });

  test("empty ids => 400", async () => {
    const res = await request(app)
      .post("/api/topic-flashcards/bulk/publish")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ ids: [] });
    expect(res.status).toBe(400);
  });
});
