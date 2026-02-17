/**
 * PR14: POST/PATCH /api/reports/lessons/:lessonId/reteach-plan
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const mockAxiosPost = jest.fn();
jest.mock("axios", () => ({
  post: (...args) => mockAxiosPost(...args),
}));

const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ReteachPlan = require("../models/ReteachPlan");
const PracticeAttempt = require("../models/PracticeAttempt");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("PR14 Reteach plan", () => {
  let ownerId;
  let otherTeacherId;
  let lessonId;
  let ownerToken;
  let otherToken;

  beforeAll(async () => {
    const owner = await User.create({
      firstName: "T",
      lastName: "Owner",
      email: "rp-owner@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const other = await User.create({
      firstName: "O",
      lastName: "Other",
      email: "rp-other@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    otherTeacherId = other._id;

    const lesson = await Lesson.create({
      title: "RP Lesson",
      description: "D",
      content: "C",
      teacherId: ownerId,
      teacherName: "T Owner",
      subject: "Biology",
      level: "GCSE",
      topic: "Cell structure",
      board: "AQA",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", title: "P1", order: 1, blocks: [] }],
      examQuestions: [],
    });
    lessonId = lesson._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    ownerToken = await login("rp-owner@test.com");
    otherToken = await login("rp-other@test.com");
  });

  beforeEach(() => {
    mockAxiosPost.mockReset();
    mockAxiosPost.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: "## What students are getting wrong\n\nSome issues.\n\n## Likely misconception\n\nConfusion.\n\n## Reteach script (5–10 minutes)\n\nSteps.\n\n## Quick check questions (3)\n\n1. One.\n\n## Homework / next steps\n\nPractice.",
            },
          },
        ],
      },
    });
  });

  afterEach(async () => {
    await ReteachPlan.deleteMany({ lessonId });
  });

  describe("POST /api/reports/lessons/:lessonId/reteach-plan", () => {
    test("401 without auth", async () => {
      const res = await request(app)
        .post(`/api/reports/lessons/${lessonId}/reteach-plan`)
        .send({ days: 14, limit: 10 });
      expect(res.status).toBe(401);
    });

    test("403 non-owner teacher", async () => {
      const res = await request(app)
        .post(`/api/reports/lessons/${lessonId}/reteach-plan`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ days: 14, limit: 10 });
      expect(res.status).toBe(403);
    });

    test("501 when OPENAI_API_KEY not set", async () => {
      const orig = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      const res = await request(app)
        .post(`/api/reports/lessons/${lessonId}/reteach-plan`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ days: 14, limit: 10 });
      if (orig !== undefined) process.env.OPENAI_API_KEY = orig;
      expect(res.status).toBe(501);
      expect(res.body.error).toMatch(/not configured/i);
    });

    test("cache: second POST with same inputs returns same plan and does not call OpenAI again", async () => {
      process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-dummy";
      const body = { days: 14, limit: 10 };

      const res1 = await request(app)
        .post(`/api/reports/lessons/${lessonId}/reteach-plan`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send(body);
      expect(res1.status).toBe(200);
      expect(res1.body.ok).toBe(true);
      expect(res1.body.plan).toBeDefined();
      expect(res1.body.plan.content).toBeDefined();
      expect(mockAxiosPost).toHaveBeenCalledTimes(1);

      const res2 = await request(app)
        .post(`/api/reports/lessons/${lessonId}/reteach-plan`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send(body);
      expect(res2.status).toBe(200);
      expect(res2.body.ok).toBe(true);
      expect(res2.body.plan.content).toBe(res1.body.plan.content);
      expect(res2.body.plan.sourceHash).toBe(res1.body.plan.sourceHash);
      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    });
  });

  describe("PATCH /api/reports/lessons/:lessonId/reteach-plan", () => {
    test("404 when no plan exists", async () => {
      const res = await request(app)
        .patch(`/api/reports/lessons/${lessonId}/reteach-plan`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ content: "Updated" });
      expect(res.status).toBe(404);
    });

    test("updates content and sets editedAt/editedBy", async () => {
      process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-dummy";
      await request(app)
        .post(`/api/reports/lessons/${lessonId}/reteach-plan`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ days: 14, limit: 10 });

      const res = await request(app)
        .patch(`/api/reports/lessons/${lessonId}/reteach-plan`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ content: "Edited content here" });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.plan.content).toBe("Edited content here");
      expect(res.body.plan.editedAt).toBeDefined();

      const doc = await ReteachPlan.findOne({ lessonId }).lean();
      expect(doc.editedAt).toBeDefined();
      expect(doc.editedBy).toBeDefined();
      expect(String(doc.editedBy)).toBe(String(ownerId));
    });
  });
});
