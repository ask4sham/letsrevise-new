/**
 * PR: Every newly created lesson includes a valid checkpoint.
 * - Manual creation (POST /api/lessons) → valid page.checkpoint
 * - Invalid checkpoint on save → repaired to valid default
 * - Student view hides invalid checkpoint (existing behavior)
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

function validCheckpoint(overrides = {}) {
  return {
    question: "Which statement is correct?",
    options: ["Option 1", "Option 2", "Option 3", "Option 4"],
    answer: "Option 1",
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
            checkpoint: validCheckpoint({ question: "What is a cell?" }),
          },
        ],
      });

    expect(res.status).toBe(200);
    const lesson = await Lesson.findById(res.body.lesson._id).lean();
    expect(lesson.pages).toHaveLength(1);
    expect(lesson.pages[0].checkpoint).toBeDefined();
    expect(lesson.pages[0].checkpoint.question).toBe("What is a cell?");
    expect(lesson.pages[0].checkpoint.options).toHaveLength(4);
    expect(lesson.pages[0].checkpoint.answer).toBe("Option 1");
  });

  test("POST /api/lessons with empty checkpoint → repaired to valid default", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Empty Checkpoint Repaired",
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
    expect(lesson.pages[0].checkpoint).toBeDefined();
    expect(String(lesson.pages[0].checkpoint.question || "").trim()).toBeTruthy();
    const opts = (lesson.pages[0].checkpoint.options || []).filter((o) => String(o || "").trim());
    expect(opts.length).toBeGreaterThanOrEqual(2);
    expect(String(lesson.pages[0].checkpoint.answer || "").trim()).toBeTruthy();
  });

  test("POST /api/lessons without checkpoint → gets valid default", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "No Checkpoint Gets Default",
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
    expect(lesson.pages[0].checkpoint).toBeDefined();
    expect(lesson.pages[0].checkpoint.question).toBe("Which statement is correct?");
    expect(lesson.pages[0].checkpoint.options).toEqual(["Option 1", "Option 2", "Option 3", "Option 4"]);
    expect(lesson.pages[0].checkpoint.answer).toBe("Option 1");
  });

  test("POST /api/lessons with invalid checkpoint block → repaired to valid", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Invalid Block Repaired",
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
    const cpBlock = (lesson.pages[0].blocks || []).find((b) => b.type === "checkpoint");
    expect(cpBlock).toBeDefined();
    expect(String(cpBlock.prompt || "").trim()).toBeTruthy();
    const opts = (cpBlock.options || []).filter((o) => String(o || "").trim());
    expect(opts.length).toBeGreaterThanOrEqual(2);
  });
});
