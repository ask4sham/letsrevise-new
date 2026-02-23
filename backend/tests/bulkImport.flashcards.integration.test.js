/**
 * PR-BULK-INGEST-1: Admin bulk import flashcards — taxonomy validation, namespacing, dry-run.
 */
const request = require("supertest");
const app = require("../app");

describe("POST /api/admin/bulk-import/flashcards", () => {
  it("dryRun rejects invalid topicKey", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/flashcards")
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
