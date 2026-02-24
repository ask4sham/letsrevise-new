/**
 * PR-BULK-INGEST-1: Admin bulk import flashcards — taxonomy validation, namespacing, dry-run.
 * Routes use auth middleware; tests send a valid token.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");

const hashedPassword = bcrypt.hashSync("Password123!", 10);

describe("POST /api/admin/bulk-import/flashcards", () => {
  let token;

  beforeAll(async () => {
    const user = await User.create({
      firstName: "Bulk",
      lastName: "Flashcards",
      email: `bulk_flash_${Date.now()}@example.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "Password123!" })
      .expect(200);
    token = login.body.token;
  }, 15000);

  it("returns 401 without auth", async () => {
    await request(app)
      .post("/api/admin/bulk-import/flashcards")
      .send({
        specKey: "aqa-gcse-biology",
        dryRun: true,
        items: [{ topicKey: "cell-structure", question: "Q?", answer: "A" }],
      })
      .expect(401);
  });

  it("dryRun rejects invalid topicKey", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/flashcards")
      .set("Authorization", `Bearer ${token}`)
      .send({
        specKey: "aqa-gcse-biology",
        dryRun: true,
        items: [{ topicKey: "not-a-real-topic", question: "Q?", answer: "A" }],
      })
      .expect(200);

    expect(res.body).toHaveProperty("invalid", 1);
    expect(res.body.errors[0]).toHaveProperty("code", "INVALID_TOPIC_KEY");
  });

  it("dryRun rejects unknown specKey", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/flashcards")
      .set("Authorization", `Bearer ${token}`)
      .send({
        specKey: "unknown-spec",
        dryRun: true,
        items: [{ topicKey: "cell-structure", question: "Q?", answer: "A" }],
      })
      .expect(400);

    expect(res.body.error).toMatch(/Unknown specKey|specKey/);
  });

  it("dryRun accepts valid items and returns would_insert", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/flashcards")
      .set("Authorization", `Bearer ${token}`)
      .send({
        specKey: "aqa-gcse-biology",
        dryRun: true,
        items: [
          {
            topicKey: "cell-structure",
            question: "What is the nucleus?",
            answer: "Controls cell activities",
          },
        ],
      })
      .expect(200);

    expect(res.body).toHaveProperty("valid", 1);
    expect(res.body).toHaveProperty("dryRun", true);
    expect(res.body.preview[0].action).toBe("would_insert");
    expect(res.body.preview[0].topicKey).toMatch(/aqa-gcse-biology:cell-structure/);
  });
});
