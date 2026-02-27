/**
 * Integration tests for POST /api/ai/generate-lesson (Algorithm 1: syllabus-aligned generation).
 * Mocks OpenAI Responses API; with DISABLE_OPENAI=1 coverage verification skips embeddings.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const axios = require("axios");
const app = require("../app");
const User = require("../models/User");

jest.mock("axios");
jest.setTimeout(20000);

const validDraft = {
  title: "Cell Structure (GCSE)",
  description: "Learn about eukaryotic and prokaryotic cells.",
  estimatedDuration: 35,
  tags: ["cells", "eukaryotic", "prokaryotic", "biology"],
  board: "AQA",
  tier: "foundation",
  pages: [
    {
      title: "Overview",
      order: 1,
      pageType: "intro",
      blocks: [{ type: "text", content: "## Cell structure\n\nEukaryotic cells have a nucleus." }],
      checkpoint: {
        question: "What type of cell has a nucleus?",
        options: ["Prokaryotic", "Eukaryotic", "Bacterial", "Viral"],
        answer: "Eukaryotic",
      },
    },
    {
      title: "Page 2",
      order: 2,
      pageType: "content",
      blocks: [{ type: "text", content: "Content." }],
      checkpoint: {
        question: "Quick check?",
        options: ["A", "B", "C", "D"],
        answer: "A",
      },
    },
  ],
};

describe("POST /api/ai/generate-lesson", () => {
  let teacherToken;

  beforeAll(async () => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-dummy";
    const hashedPassword = await bcrypt.hash("password123", 10);
    const teacher = await User.create({
      email: "gen-lesson-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
      firstName: "Gen",
      lastName: "Lesson",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: teacher.email, password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({
      data: {
        output_text: JSON.stringify(validDraft),
        usage: null,
        model: "gpt-4o-mini",
      },
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: "gen-lesson-teacher@test.com" });
  });

  test("401 without auth", async () => {
    const res = await request(app).post("/api/ai/generate-lesson").send({
      topic: "Cell structure",
      subject: "Biology",
      level: "GCSE",
    });
    expect(res.status).toBe(401);
  });

  test("400 when topic, subject or level missing", async () => {
    const res = await request(app)
      .post("/api/ai/generate-lesson")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ subject: "Biology", level: "GCSE" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required fields/i);
  });

  test("200 and returns draft with mappingHint", async () => {
    const res = await request(app)
      .post("/api/ai/generate-lesson")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: "Cell structure",
        subject: "Biology",
        level: "GCSE",
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.draft).toBeDefined();
    expect(res.body.draft.title).toBe(validDraft.title);
    expect(res.body.draft.pages).toBeDefined();
    expect(res.body.mappingHint).toBeDefined();
    expect(res.body.mappingHint.lesson).toBeDefined();
  });

  test("200 with AQA board returns coverageScore and missingPoints when spec exists (DISABLE_OPENAI=1)", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const res = await request(app)
        .post("/api/ai/generate-lesson")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          topic: "Cell structure",
          subject: "Biology",
          level: "GCSE",
          board: "AQA",
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.draft).toBeDefined();
      expect(res.body.coverageScore).toBeDefined();
      expect(res.body.missingPoints).toBeDefined();
      expect(Array.isArray(res.body.missingPoints)).toBe(true);
      expect(typeof res.body.coverageScore).toBe("number");
      expect(res.body.coverageScore).toBe(1);
      expect(res.body.missingPoints).toEqual([]);
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });

  test("200 without board does not require coverage fields (no spec resolution)", async () => {
    const res = await request(app)
      .post("/api/ai/generate-lesson")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: "Random topic",
        subject: "Biology",
        level: "GCSE",
      });
    expect(res.status).toBe(200);
    expect(res.body.draft).toBeDefined();
    expect(res.body.success).toBe(true);
  });
});
