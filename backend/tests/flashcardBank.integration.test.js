/**
 * PR-F1: Flashcard Bank (topic-level doc with cards[]) — GET, POST import, POST copy-to-lesson.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const FlashcardBank = require("../models/FlashcardBank");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Flashcard Bank (PR-F1)", () => {
  let ownerToken;
  let ownerId;
  let otherTeacherToken;
  let otherTeacherId;
  const topicKey = "cell-structure";
  const namespacedTopicKey = "aqa-gcse-biology:cell-structure";

  beforeAll(async () => {
    const owner = await User.create({
      firstName: "Bank",
      lastName: "Owner",
      email: "bank-owner@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;
    const other = await User.create({
      firstName: "Other",
      lastName: "Teacher",
      email: "bank-other@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    otherTeacherId = other._id;
    const loginOwner = await request(app)
      .post("/api/auth/login")
      .send({ email: "bank-owner@test.com", password: "password123" });
    ownerToken = loginOwner.body?.token;
    const loginOther = await request(app)
      .post("/api/auth/login")
      .send({ email: "bank-other@test.com", password: "password123" });
    otherTeacherToken = loginOther.body?.token;
    if (!ownerToken || !otherTeacherToken) throw new Error("Login failed");
  });

  afterAll(async () => {
    await FlashcardBank.deleteMany({});
  });

  test("teacher imports bank for topicKey → GET returns cards", async () => {
    const importRes = await request(app)
      .post("/api/flashcard-bank/import")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        topicKey,
        topicName: "Cell structure",
        cards: [
          { front: "What is a nucleus?", back: "Membrane-bound organelle containing DNA." },
          { front: "What is cytoplasm?", back: "Gel-like substance." },
        ],
      });
    expect(importRes.status).toBe(200);
    expect(importRes.body.ok).toBe(true);
    expect(importRes.body.cardsCount).toBe(2);
    expect(importRes.body.topicKey).toBe(topicKey);

    const getRes = await request(app)
      .get("/api/flashcard-bank")
      .set("Authorization", `Bearer ${ownerToken}`)
      .query({ topicKey: namespacedTopicKey });
    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body.cards)).toBe(true);
    expect(getRes.body.cards.length).toBe(2);
    expect(getRes.body.cards[0]).toMatchObject({ front: "What is a nucleus?", back: "Membrane-bound organelle containing DNA." });
  });

  test("copy-to-lesson when lesson.flashcards empty → lesson now has cards", async () => {
    const lesson = await Lesson.create({
      title: "Cell Lesson",
      description: "Cell structure",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Bank Owner",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", title: "Page 1", order: 1, blocks: [] }],
      flashcards: [],
    });

    const copyRes = await request(app)
      .post(`/api/flashcard-bank/${encodeURIComponent(namespacedTopicKey)}/copy-to-lesson/${lesson._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(copyRes.status).toBe(200);
    expect(copyRes.body.ok).toBe(true);
    expect(copyRes.body.copied).toBe(2);

    const updated = await Lesson.findById(lesson._id).lean();
    expect(Array.isArray(updated.flashcards)).toBe(true);
    expect(updated.flashcards.length).toBe(2);
    expect(updated.flashcards[0]).toHaveProperty("front", "What is a nucleus?");
    expect(updated.flashcards[0]).toHaveProperty("back");
    expect(updated.flashcards[0]).toHaveProperty("id");
  });

  test("copy-to-lesson when lesson already has flashcards → unchanged unless force=1", async () => {
    const lesson = await Lesson.create({
      title: "Cell Lesson With Cards",
      description: "Cell structure",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Bank Owner",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", title: "Page 1", order: 1, blocks: [] }],
      flashcards: [
        { id: "fc_existing", front: "Existing?", back: "Yes." },
      ],
    });

    const copyRes = await request(app)
      .post(`/api/flashcard-bank/${encodeURIComponent(namespacedTopicKey)}/copy-to-lesson/${lesson._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(copyRes.status).toBe(200);
    expect(copyRes.body.ok).toBe(true);
    expect(copyRes.body.copied).toBe(0);

    const updated = await Lesson.findById(lesson._id).lean();
    expect(updated.flashcards.length).toBe(1);
    expect(updated.flashcards[0].front).toBe("Existing?");
  });

  test("non-owner teacher cannot copy into someone else's lesson (404, no existence leak)", async () => {
    const lesson = await Lesson.create({
      title: "Owner Only Lesson",
      description: "Cell structure",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Bank Owner",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", title: "Page 1", order: 1, blocks: [] }],
      flashcards: [],
    });

    const copyRes = await request(app)
      .post(`/api/flashcard-bank/${encodeURIComponent(namespacedTopicKey)}/copy-to-lesson/${lesson._id}`)
      .set("Authorization", `Bearer ${otherTeacherToken}`)
      .send({});
    expect(copyRes.status).toBe(404);

    const updated = await Lesson.findById(lesson._id).lean();
    expect(updated.flashcards.length).toBe(0);
  });

  test("GET without topicKey returns 400", async () => {
    const res = await request(app)
      .get("/api/flashcard-bank")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(400);
  });

  test("PR-CONTENT-TARGETING-1: GET with non-namespaced topicKey returns 400", async () => {
    const res = await request(app)
      .get("/api/flashcard-bank")
      .set("Authorization", `Bearer ${ownerToken}`)
      .query({ topicKey: "cell-structure" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(String(res.body.error)).toMatch(/namespaced|topicKey/i);
  });

  test("PR-CONTENT-TARGETING-1: GET with invalid topicKey (bad prefix) returns 400", async () => {
    const res = await request(app)
      .get("/api/flashcard-bank")
      .set("Authorization", `Bearer ${ownerToken}`)
      .query({ topicKey: "invalid-spec:cell-structure" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("unauthenticated GET returns 401", async () => {
    const res = await request(app)
      .get("/api/flashcard-bank")
      .query({ topicKey });
    expect(res.status).toBe(401);
  });

  test("import flow: GET bank + POST revision → lesson.flashcards populated, student can view", async () => {
    const lesson = await Lesson.create({
      title: "Import Flow Lesson",
      description: "Cell structure",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Bank Owner",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      topicKey: namespacedTopicKey,
      status: "draft",
      isPublished: false,
      pages: [{ pageId: "p1", title: "Page 1", order: 1, blocks: [] }],
      flashcards: [],
    });

    const getRes = await request(app)
      .get("/api/flashcard-bank")
      .set("Authorization", `Bearer ${ownerToken}`)
      .query({ topicKey: namespacedTopicKey });
    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body.cards)).toBe(true);
    expect(getRes.body.cards.length).toBeGreaterThanOrEqual(1);

    const cardsForRevision = getRes.body.cards.map((c, i) => ({
      id: `fc_${Date.now()}_${i}`,
      front: c.front,
      back: c.back,
      difficulty: 1,
      tags: c.tags || [],
    }));

    const revRes = await request(app)
      .post(`/api/lessons/${lesson._id}/revision`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ flashcards: cardsForRevision });
    expect(revRes.status).toBe(200);
    expect(revRes.body.success).toBe(true);
    expect(revRes.body.flashcardsCount).toBe(cardsForRevision.length);

    const updated = await Lesson.findById(lesson._id).lean();
    expect(Array.isArray(updated.flashcards)).toBe(true);
    expect(updated.flashcards.length).toBe(cardsForRevision.length);
    expect(updated.flashcards[0]).toHaveProperty("front");
    expect(updated.flashcards[0]).toHaveProperty("back");
  });
});
