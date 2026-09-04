/**
 * PR-BULK-INGEST-2: Admin bulk import exam questions — taxonomy validation, namespacing, dry-run.
 * Routes use auth middleware; tests send a valid token.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");

const hashedPassword = bcrypt.hashSync("Password123!", 10);

describe("POST /api/admin/bulk-import/exam-questions", () => {
  let token;

  beforeAll(async () => {
    const user = await User.create({
      firstName: "Bulk",
      lastName: "Import",
      email: `bulk_exam_${Date.now()}@example.com`,
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
      .post("/api/admin/bulk-import/exam-questions")
      .send({
        specKey: "aqa-gcse-biology",
        dryRun: true,
        items: [{ topicKey: "cell-structure", question: "Q", markScheme: "MS" }],
      })
      .expect(401);
  });

  it("unknown specKey -> 400", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        specKey: "not-a-real-spec",
        dryRun: true,
        items: [{ topicKey: "x", question: "Q", markScheme: "MS" }],
      })
      .expect(400);

    expect(res.body).toHaveProperty("error");
  });

  it("invalid topicKey -> 200 with INVALID_TOPIC_KEY in report", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        specKey: "aqa-gcse-biology",
        dryRun: true,
        items: [{ topicKey: "not-a-real-topic", question: "Q", markScheme: "MS" }],
      })
      .expect(200);

    expect(res.body).toHaveProperty("invalid", 1);
    expect(res.body.errors[0]).toHaveProperty("code", "INVALID_TOPIC_KEY");
  });

  it("valid dryRun -> would_insert and namespaced topicKey", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        specKey: "aqa-gcse-biology",
        dryRun: true,
        items: [
          {
            topicKey: "cell-structure",
            question: "Explain one function of the nucleus.",
            markScheme: "Award 1 mark for stating it controls cell activities.",
            marks: 1,
          },
        ],
      })
      .expect(200);

    expect(res.body).toHaveProperty("valid", 1);
    expect(res.body.preview[0]).toHaveProperty("action", "would_insert");
    expect(res.body.preview[0].topicKey).toMatch(/^aqa-gcse-biology:/);
  });

  it("valid dryRun with metadata -> preview includes metadata when provided", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        specKey: "aqa-gcse-biology",
        dryRun: true,
        items: [
          {
            topicKey: "cell-structure",
            question: "Explain nucleus " + Date.now(),
            markScheme: "Control.",
            marks: 1,
            difficulty: 3,
            skill: "application",
          },
        ],
      })
      .expect(200);
    expect(res.body.valid).toBe(1);
    expect(res.body.preview[0].difficulty).toBe(3);
    expect(res.body.preview[0].skill).toBe("application");
  });
});
