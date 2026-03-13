/**
 * Step 7 (LLM Roadmap): POST /api/ai/structure-notes — inbuilt tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");

jest.setTimeout(20000);

describe("POST /api/ai/structure-notes", () => {
  let studentToken;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash("password123", 10);
    const student = await User.create({
      email: "structure-notes-student@test.com",
      password: hashedPassword,
      userType: "student",
      firstName: "S",
      lastName: "N",
    });
    const login = await request(app).post("/api/auth/login").send({ email: student.email, password: "password123" });
    studentToken = login.body?.token;
    if (!studentToken) throw new Error("Login failed");
  });

  afterAll(async () => {
    await User.deleteMany({ email: "structure-notes-student@test.com" });
  });

  test("401 without auth", async () => {
    const res = await request(app).post("/api/ai/structure-notes").send({ notes: "My revision notes here." });
    expect(res.status).toBe(401);
  });

  test("400 when notes is missing", async () => {
    const res = await request(app)
      .post("/api/ai/structure-notes")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/notes is required/i);
  });

  test("400 when notes is empty", async () => {
    const res = await request(app)
      .post("/api/ai/structure-notes")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ notes: "   " });
    expect(res.status).toBe(400);
  });

  test("400 when notes exceeds max length", async () => {
    const long = "x".repeat(8001);
    const res = await request(app)
      .post("/api/ai/structure-notes")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ notes: long });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8000/);
  });

  test("200 with DISABLE_OPENAI=1 returns stub summary and flashcards", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/ai/structure-notes")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ notes: "Photosynthesis: plants use light to make glucose. Chlorophyll absorbs light." });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("summary");
      expect(res.body).toHaveProperty("flashcards");
      expect(Array.isArray(res.body.flashcards)).toBe(true);
      expect(res.body.flashcards.length).toBeGreaterThanOrEqual(1);
      expect(res.body._disabled).toBe(true);
      const card = res.body.flashcards[0];
      expect(card).toHaveProperty("front");
      expect(card).toHaveProperty("back");
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });
});
