/**
 * PR-F1: Topic Flashcard Bank — integration tests.
 * Teacher bulk+list; student 403; seed copies into lesson and GET returns flashcards (OWNER).
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const TopicFlashcard = require("../models/TopicFlashcard");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(20000);

describe("Topic Flashcard Bank (PR-F1)", () => {
  let teacherToken;
  let teacherId;
  let otherTeacherToken;
  let studentToken;
  const topicKey = "cell-structure";

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Flash",
      lastName: "Teacher",
      email: "flash-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const otherTeacher = await User.create({
      firstName: "Other",
      lastName: "Teacher",
      email: "flash-other-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const student = await User.create({
      firstName: "Flash",
      lastName: "Student",
      email: "flash-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    const loginTeacher = await request(app)
      .post("/api/auth/login")
      .send({ email: "flash-teacher@test.com", password: "password123" });
    teacherToken = loginTeacher.body?.token;
    const loginOther = await request(app)
      .post("/api/auth/login")
      .send({ email: "flash-other-teacher@test.com", password: "password123" });
    otherTeacherToken = loginOther.body?.token;
    const loginStudent = await request(app)
      .post("/api/auth/login")
      .send({ email: "flash-student@test.com", password: "password123" });
    studentToken = loginStudent.body?.token;
    if (!teacherToken || !otherTeacherToken || !studentToken) throw new Error("Login failed");
  }, 20000);

  afterAll(async () => {
    await TopicFlashcard.deleteMany({ ownerId: teacherId });
  }, 15000);

  test("GET without topicKey returns 400", async () => {
    const res = await request(app)
      .get("/api/topic-flashcards")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/topicKey/);
  });

  test("student GET /api/topic-flashcards returns 403", async () => {
    const res = await request(app)
      .get("/api/topic-flashcards")
      .set("Authorization", `Bearer ${studentToken}`)
      .query({ topicKey });
    expect(res.status).toBe(403);
  });

  test("student POST /api/topic-flashcards/bulk returns 403", async () => {
    const res = await request(app)
      .post("/api/topic-flashcards/bulk")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ topicKey, items: [{ front: "Q?", back: "A" }] });
    expect(res.status).toBe(403);
  });

  test("teacher can bulk insert and list by topicKey", async () => {
    const bulkRes = await request(app)
      .post("/api/topic-flashcards/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        topic: "Cell structure",
        items: [
          { front: "What is a nucleus?", back: "Membrane-bound organelle containing DNA." },
          { front: "What is cytoplasm?", back: "Gel-like substance where reactions occur." },
        ],
      });
    expect(bulkRes.status).toBe(200);
    expect(bulkRes.body.createdCount).toBe(2);
    expect(Array.isArray(bulkRes.body.createdIds)).toBe(true);
    expect(bulkRes.body.createdIds.length).toBe(2);

    const listRes = await request(app)
      .get("/api/topic-flashcards")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ topicKey });
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.items)).toBe(true);
    expect(listRes.body.items.length).toBeGreaterThanOrEqual(2);
    listRes.body.items.forEach((f) => {
      // PR-CHEM-3: stored key may be namespaced (aqa-gcse-biology:cell-structure) or legacy (cell-structure)
      expect(f.topicKey === topicKey || f.topicKey === `aqa-gcse-biology:${topicKey}`).toBe(true);
      expect(f.front).toBeDefined();
      expect(f.back).toBeDefined();
      expect(f.status).toBe("draft");
    });
  });

  test("publish and unpublish toggle status", async () => {
    const bulkRes = await request(app)
      .post("/api/topic-flashcards/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, items: [{ front: "Publish test?", back: "Yes." }] });
    expect(bulkRes.status).toBe(200);
    const id = bulkRes.body.createdIds[0];

    const pubRes = await request(app)
      .post(`/api/topic-flashcards/${id}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.flashcard.status).toBe("published");

    const listPub = await request(app)
      .get("/api/topic-flashcards")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ topicKey, status: "published" });
    expect(listPub.body.items.some((f) => f._id.toString() === id)).toBe(true);

    // Unpublish is admin-only (PR-EDGE-2): teacher gets 403
    const unpubRes = await request(app)
      .post(`/api/topic-flashcards/${id}/unpublish`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(unpubRes.status).toBe(403);
  });

  test("owner-only: teacher B gets 404 on PUT/DELETE/publish (no existence leak)", async () => {
    const bulkRes = await request(app)
      .post("/api/topic-flashcards/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, items: [{ front: "Owner only?", back: "Yes." }] });
    const id = bulkRes.body.createdIds[0];

    const putRes = await request(app)
      .put(`/api/topic-flashcards/${id}`)
      .set("Authorization", `Bearer ${otherTeacherToken}`)
      .send({ front: "Hacked" });
    expect(putRes.status).toBe(404);

    const pubRes = await request(app)
      .post(`/api/topic-flashcards/${id}/publish`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    expect(pubRes.status).toBe(404);

    const delRes = await request(app)
      .delete(`/api/topic-flashcards/${id}`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    expect(delRes.status).toBe(404);
  });

  test("POST /api/lessons/:id/seed-flashcards-from-topic copies published bank into lesson (replace semantics)", async () => {
    const { queryCandidates } = require("../utils/topicKey");
    const candidates = queryCandidates("aqa-gcse-biology", topicKey);
    await TopicFlashcard.deleteMany({ ownerId: teacherId, status: "published", topicKey: { $in: candidates } });

    const bulkRes = await request(app)
      .post("/api/topic-flashcards/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, items: [{ front: "Seed A?", back: "A." }, { front: "Seed B?", back: "B." }] });
    const ids = bulkRes.body.createdIds;
    for (const id of ids) {
      await request(app)
        .post(`/api/topic-flashcards/${id}/publish`)
        .set("Authorization", `Bearer ${teacherToken}`);
    }

    const lesson = await Lesson.create({
      title: "Cell structure lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "Flash Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      topicKey,
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      flashcards: [],
    });

    const seedRes = await request(app)
      .post(`/api/lessons/${lesson._id}/seed-flashcards-from-topic`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(seedRes.status).toBe(200);
    expect(seedRes.body.ok).toBe(true);
    expect(seedRes.body.addedCount).toBe(2);
    expect(seedRes.body.flashcardsCount).toBe(2);

    const getRes = await request(app)
      .get(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.accessDecision?.reason).toBe("OWNER");
    expect(Array.isArray(getRes.body.flashcards)).toBe(true);
    expect(getRes.body.flashcards.length).toBe(2);
  });

  test("generate/flashcards-from-topic excludes draft bank items", async () => {
    const draftTopicKey = "principles-of-organisation"; // different topic so no published cards from prior tests
    const bulkRes = await request(app)
      .post("/api/topic-flashcards/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey: draftTopicKey, items: [{ front: "Draft only?", back: "Never copied." }] });
    expect(bulkRes.status).toBe(200);

    const lesson = await Lesson.create({
      title: "Draft exclusion lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "Flash Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Principles of organisation",
      topicKey: draftTopicKey,
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      flashcards: [],
    });

    const genRes = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/flashcards-from-topic`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(genRes.status).toBe(200);
    expect(genRes.body.addedCount).toBe(0);
    expect(genRes.body.flashcardsCount).toBe(0);
  });
});
