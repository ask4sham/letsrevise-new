/**
 * PR-CHEM-3: topicKey namespacing integration tests.
 * A) Namespaced write (Chemistry)
 * B) Namespaced write (Biology)
 * C) Read fallback: namespaced query returns legacy content
 * D) Reject mismatch: invalid topicKey for spec (biology-only topic with chemistry spec)
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const TopicFlashcard = require("../models/TopicFlashcard");
const { fingerprint } = require("../utils/flashcardDedupe");

const hashedPassword = bcrypt.hashSync("password123", 10);

// Stable keys from taxonomies (see taxonomy.chemistry.integration.test.js for Chemistry)
const CHEM_TOPIC = "rate-of-reaction";
const BIO_TOPIC = "cell-structure"; // Biology-only (not in Chemistry)

describe("TopicKey namespacing (PR-CHEM-3)", () => {
  let teacherToken;
  let teacherId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Chem",
      lastName: "Teacher",
      email: "chem-namespace-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "chem-namespace-teacher@test.com", password: "password123" });
    teacherToken = loginRes.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await TopicFlashcard.deleteMany({ ownerId: teacherId });
  });

  test("A) Namespaced write (Chemistry): stored topicKey is specKey:topicKey", async () => {
    const res = await request(app)
      .post("/api/topic-flashcards")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        specKey: "aqa-gcse-chemistry",
        topicKey: CHEM_TOPIC,
        front: "What affects rate?",
        back: "Concentration, temperature, catalyst.",
        status: "draft",
      });
    expect(res.status).toBe(201);
    expect(res.body.flashcard).toBeDefined();
    expect(res.body.flashcard.topicKey).toBe("aqa-gcse-chemistry:rate-of-reaction");
  });

  test("B) Namespaced write (Biology): stored topicKey is aqa-gcse-biology:<topicKey>", async () => {
    const res = await request(app)
      .post("/api/topic-flashcards")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: BIO_TOPIC,
        front: "What is a cell?",
        back: "Basic unit of life.",
        status: "draft",
      });
    expect(res.status).toBe(201);
    expect(res.body.flashcard.topicKey).toBe("aqa-gcse-biology:cell-structure");
  });

  test("C) Read fallback: namespaced query returns legacy content", async () => {
    const front = "Legacy fallback front";
    const back = "Legacy fallback back";
    const legacyDoc = await TopicFlashcard.create({
      ownerId: teacherId,
      topicKey: CHEM_TOPIC,
      front,
      back,
      status: "draft",
      fingerprint: fingerprint(front, back),
    });
    const legacyId = String(legacyDoc._id);

    const listRes = await request(app)
      .get("/api/topic-flashcards")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ topicKey: CHEM_TOPIC, specKey: "aqa-gcse-chemistry" });

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.items)).toBe(true);
    const foundLegacy = listRes.body.items.find((f) => String(f._id) === legacyId);
    expect(foundLegacy).toBeDefined();
    expect(foundLegacy.topicKey).toBe("rate-of-reaction");
  });

  test("D) Reject mismatch: invalid topicKey for spec returns 400", async () => {
    const res = await request(app)
      .post("/api/topic-flashcards")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        specKey: "aqa-gcse-chemistry",
        topicKey: BIO_TOPIC,
        front: "Q",
        back: "A",
        status: "draft",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid|topicKey|spec/);
    expect(res.body.error).not.toMatch(/stack|internal|path|at\s+/i);
  });
});
