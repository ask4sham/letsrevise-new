/**
 * Checkpoint persistence: real checkpoints kept; empty/invalid never invent Option 1–4.
 * Learn pages strip testing blocks and omit page.checkpoint.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

function validCheckpoint(overrides = {}) {
  return {
    question: "What is a cell?",
    options: [
      "The basic structural and functional unit of a living organism",
      "A group of organs working together",
      "A chemical that speeds up a reaction",
      "A tissue made from several organ systems",
    ],
    answer: "The basic structural and functional unit of a living organism",
    ...overrides,
  };
}

describe("Lesson checkpoint creation (PR)", () => {
  let teacherToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Checkpoint",
      lastName: "Teacher",
      email: "checkpoint-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "checkpoint-teacher@test.com", password: "password123" });
    teacherToken = loginRes.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  });

  afterAll(async () => {
    await Lesson.deleteMany({ "teacherName": /Checkpoint/ });
  });

  test("POST /api/lessons with valid checkpoint → saved as-is", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Valid Checkpoint Lesson",
        description: "Test",
        content: "Content",
        subject: "Biology",
        level: "GCSE",
        topic: "Cell structure",
        estimatedDuration: 30,
        pages: [
          {
            pageId: "p1",
            title: "Page 1",
            order: 1,
            blocks: [{ type: "text", content: "Content" }],
            checkpoint: validCheckpoint(),
          },
        ],
      });

    expect(res.status).toBe(200);
    const lesson = await Lesson.findById(res.body.lesson._id).lean();
    expect(lesson.pages).toHaveLength(1);
    expect(lesson.pages[0].checkpoint).toBeDefined();
    expect(lesson.pages[0].checkpoint.question).toBe("What is a cell?");
    expect(lesson.pages[0].checkpoint.options).toHaveLength(4);
    expect(lesson.pages[0].checkpoint.answer).toBe(
      "The basic structural and functional unit of a living organism"
    );
  });

  test("POST /api/lessons with empty checkpoint → omits invented Option 1–4 filler", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Empty Checkpoint Omitted",
        description: "Test",
        content: "Content",
        subject: "Biology",
        level: "GCSE",
        topic: "Animal & plant cells",
        estimatedDuration: 30,
        pages: [
          {
            pageId: "p1",
            title: "Page 1",
            order: 1,
            blocks: [{ type: "text", content: "Content" }],
            checkpoint: { question: "", options: ["", "", "", ""], answer: "" },
          },
        ],
      });

    expect(res.status).toBe(200);
    const lesson = await Lesson.findById(res.body.lesson._id).lean();
    expect(lesson.pages).toHaveLength(1);
    expect(lesson.pages[0].checkpoint == null || !String(lesson.pages[0].checkpoint.question || "").trim()).toBe(true);
  });

  test("POST /api/lessons without checkpoint → omits invented default filler", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "No Checkpoint No Invent",
        description: "Test",
        content: "Content",
        subject: "Biology",
        level: "GCSE",
        topic: "Cell structure",
        estimatedDuration: 30,
        pages: [
          {
            pageId: "p1",
            title: "Page 1",
            order: 1,
            blocks: [{ type: "text", content: "Content" }],
          },
        ],
      });

    expect(res.status).toBe(200);
    const lesson = await Lesson.findById(res.body.lesson._id).lean();
    expect(lesson.pages).toHaveLength(1);
    expect(lesson.pages[0].checkpoint == null || !String(lesson.pages[0].checkpoint?.question || "").trim()).toBe(true);
  });

  test("POST /api/lessons Learn page strips testing blocks and checkpoint", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Learn Teaching Only",
        description: "Test",
        content: "Content",
        subject: "Biology",
        level: "GCSE",
        topic: "Cell structure",
        estimatedDuration: 30,
        pages: [
          {
            pageId: "p1",
            title: "Learn",
            order: 1,
            pageType: "learn",
            blocks: [
              { type: "text", content: "Teaching" },
              {
                type: "selfCheck",
                prompt: "Which statement is correct?",
                options: ["Option 1", "Option 2", "Option 3", "Option 4"],
                correctAnswer: "Option 1",
              },
            ],
            checkpoint: {
              question: "Which statement is correct?",
              options: ["Option 1", "Option 2", "Option 3", "Option 4"],
              answer: "Option 1",
            },
          },
        ],
      });

    expect(res.status).toBe(200);
    const lesson = await Lesson.findById(res.body.lesson._id).lean();
    expect(lesson.pages).toHaveLength(1);
    expect(lesson.pages[0].checkpoint == null || !String(lesson.pages[0].checkpoint?.question || "").trim()).toBe(true);
    const types = (lesson.pages[0].blocks || []).map((b) => b.type);
    expect(types).not.toContain("selfCheck");
    expect(types).toContain("text");
  });

  test("POST /api/lessons with invalid checkpoint block → left without inventing Option 1–4 on page.checkpoint", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Invalid Block No Invent",
        description: "Test",
        content: "Content",
        subject: "Biology",
        level: "GCSE",
        topic: "Cell structure",
        estimatedDuration: 30,
        pages: [
          {
            pageId: "p1",
            title: "Page 1",
            order: 1,
            blocks: [
              { type: "text", content: "Content" },
              { type: "checkpoint", prompt: "", questionType: "mcq", options: ["", "", "", ""], correctAnswer: "" },
            ],
          },
        ],
      });

    expect(res.status).toBe(200);
    const lesson = await Lesson.findById(res.body.lesson._id).lean();
    expect(lesson.pages[0].checkpoint == null || !String(lesson.pages[0].checkpoint?.question || "").trim()).toBe(true);
  });
});
