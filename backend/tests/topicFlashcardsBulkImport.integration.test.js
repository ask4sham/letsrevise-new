/**
 * PR-FLOW-4: Bulk import formats + preview + dedupe — integration tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const TopicFlashcard = require("../models/TopicFlashcard");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Topic Flashcard Bulk Import (PR-FLOW-4)", () => {
  let teacherToken;
  let teacherId;
  const topicKey = "diffusion";

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Bulk",
      lastName: "Teacher",
      email: "bulk-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "bulk-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await TopicFlashcard.deleteMany({ ownerId: teacherId });
  });

  test("Preview newline format parses correctly, invalid and duplicate in payload", async () => {
    const text = `Diffusion :: Movement from high to low concentration
Osmosis :: Movement of water across a partially permeable membrane
Bad line ::
Diffusion :: Movement from high to low concentration`;

    const res = await request(app)
      .post("/api/topic-flashcards/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, format: "newline", text });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.topicKey).toBe(topicKey);
    expect(res.body.summary.totalParsed).toBe(4);
    expect(res.body.summary.validCount).toBe(2); // Diffusion, Osmosis (after dedupe)
    expect(res.body.summary.invalidCount).toBe(1); // Bad line ::
    expect(res.body.summary.duplicatesInPayload).toBe(1); // 4th line duplicates 1st
    expect(res.body.invalid).toHaveLength(1);
    expect(res.body.invalid[0].reason).toMatch(/Missing back|No separator/i);
    expect(res.body.duplicates.inPayload).toHaveLength(1);
  });

  test("Commit with dedupeMode=skip: existing DB + one new", async () => {
    await TopicFlashcard.create({
      ownerId: teacherId,
      topicKey,
      topic: "Diffusion",
      front: "Diffusion",
      back: "Movement from high to low concentration",
      status: "published",
      fingerprint: "diffusion||movement from high to low concentration",
    });

    const res = await request(app)
      .post("/api/topic-flashcards/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [
          { front: "Diffusion", back: "Movement from high to low concentration" },
          { front: "Osmosis", back: "Water movement across membrane" },
        ],
        dedupeMode: "skip",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.createdCount).toBe(1);
    expect(res.body.skipped.duplicatesInDb).toBe(1);
  });

  test("Commit with dedupeMode=error returns 400 when duplicates exist", async () => {
    const res = await request(app)
      .post("/api/topic-flashcards/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [
          { front: "Osmosis", back: "Water movement across membrane" },
        ],
        dedupeMode: "error",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duplicates|dedupeMode/i);
  });

  test("CSV parsing: header-based with tags", async () => {
    const csv = `front,back,tags
What is mitosis?,Cell division,cell-cycle
What is meiosis?,Reduction division,genetics|inheritance`;

    const res = await request(app)
      .post("/api/topic-flashcards/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey: "cell-division", format: "csv", text: csv });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.validCount).toBe(2);
    expect(res.body.previewItems.length).toBe(2);
    expect(res.body.previewItems[0].front).toBe("What is mitosis?");
    expect(res.body.previewItems[1].tags).toEqual(expect.arrayContaining(["genetics", "inheritance"]));
  });

  test("Fingerprint uniqueness: normalized variant skipped", async () => {
    const res = await request(app)
      .post("/api/topic-flashcards/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [
          { front: "  Diffusion  ", back: "  Movement from high to low concentration  " },
        ],
        dedupeMode: "skip",
      });

    expect(res.status).toBe(200);
    expect(res.body.createdCount).toBe(0);
    expect(res.body.skipped.duplicatesInDb).toBe(1);
  });
});
