/**
 * PR3 — Integration test for POST /api/ai/lesson-factory/aqa-gcse-biology.
 * Mocks OpenAI so no real API call is made; asserts saved lesson has correct shape.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const VisualModel = require("../models/VisualModel");

jest.mock("axios");

const app = require("../app");

const hashedPassword = bcrypt.hashSync("password123", 10);

const validDraft = {
  title: "Photosynthesis (GCSE)",
  description: "Learn how plants make food using light.",
  estimatedDuration: 40,
  tags: ["photosynthesis", "biology", "plants"],
  board: "AQA",
  tier: "higher",
  pages: [
    {
      title: "Overview",
      order: 1,
      pageType: "intro",
      blocks: [
        { type: "text", content: "## Photosynthesis\n\nPlants use light to make glucose." },
        { type: "keyIdea", content: "Key idea: chlorophyll absorbs light." },
        { type: "stretch", content: "Extension: link to limiting factors and rate of photosynthesis." },
      ],
      checkpoint: {
        question: "Where does photosynthesis occur?",
        options: ["Roots", "Leaves", "Stem", "Flowers"],
        answer: "Leaves",
      },
    },
    {
      title: "Equation",
      order: 2,
      pageType: "content",
      blocks: [{ type: "text", content: "The word equation for photosynthesis." }],
      checkpoint: {
        question: "What is the product of photosynthesis?",
        options: ["Oxygen only", "Glucose only", "Glucose and oxygen", "Water"],
        answer: "Glucose and oxygen",
      },
    },
    {
      title: "Page 3",
      order: 3,
      pageType: "content",
      blocks: [{ type: "text", content: "Content." }],
      checkpoint: {
        question: "Quick check?",
        options: ["A", "B", "C", "D"],
        answer: "A",
      },
    },
    {
      title: "Page 4",
      order: 4,
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

describe("POST /api/ai/lesson-factory/aqa-gcse-biology", () => {
  let teacherToken;
  let teacherId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Factory",
      lastName: "Teacher",
      email: "factory-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "factory-teacher@test.com", password: "password123" });
    teacherToken = loginRes.body?.token;
    if (!teacherToken) throw new Error("Failed to get teacher token");

    await VisualModel.deleteMany({ conceptKey: "photosynthesis" });
    await VisualModel.create({
      conceptKey: "photosynthesis",
      subject: "Biology",
      topic: "Photosynthesis",
      isPublished: true,
      variants: [{ level: "GCSE", type: "staticDiagram", src: "/visuals/photosynthesis.svg" }],
    });
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

  test("returns 401 without auth", async () => {
    const res = await request(app)
      .post("/api/ai/lesson-factory/aqa-gcse-biology")
      .send({ topic: "Photosynthesis", tier: "higher" });
    expect(res.status).toBe(401);
  });

  test("returns 400 when topic too short", async () => {
    const res = await request(app)
      .post("/api/ai/lesson-factory/aqa-gcse-biology")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "ab", tier: "higher" });
    expect(res.status).toBe(400);
  });

  test("returns 400 when tier invalid", async () => {
    const res = await request(app)
      .post("/api/ai/lesson-factory/aqa-gcse-biology")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "Photosynthesis", tier: "invalid" });
    expect(res.status).toBe(400);
  });

  test("creates draft lesson with subject Biology, examBoard AQA, tier, status draft, pages with checkpoints", async () => {
    const res = await request(app)
      .post("/api/ai/lesson-factory/aqa-gcse-biology")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "Photosynthesis", tier: "higher" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.lessonId).toBeDefined();
    expect(mongoose.Types.ObjectId.isValid(res.body.lessonId)).toBe(true);

    const lesson = await Lesson.findById(res.body.lessonId).lean();
    expect(lesson).not.toBeNull();
    expect(lesson.subject).toBe("Biology");
    expect(lesson.board).toBe("AQA");
    expect(lesson.tier).toBe("higher");
    expect(lesson.topic).toBe("Photosynthesis");
    expect(lesson.status).toBe("draft");
    expect(Array.isArray(lesson.pages)).toBe(true);
    expect(lesson.pages.length).toBeGreaterThanOrEqual(4);

    lesson.pages.forEach((page) => {
      const hasCheckpointBlock =
        Array.isArray(page.blocks) && page.blocks.some((b) => b.type === "checkpoint");
      const hasPageCheckpoint = page.checkpoint && page.checkpoint.question;
      expect(hasCheckpointBlock || hasPageCheckpoint).toBe(true);
      if (hasCheckpointBlock) {
        const cp = page.blocks.find((b) => b.type === "checkpoint");
        expect(cp).toHaveProperty("prompt");
        expect(cp.questionType === "mcq" ? Array.isArray(cp.options) : true).toBe(true);
      }
    });

    expect(res.body.lesson).toBeDefined();
    expect(res.body.lesson.examBoard).toBe("AQA");
    expect(res.body.lesson.subject).toBe("Biology");
  });

  test("length short yields 4 pages", async () => {
    const res = await request(app)
      .post("/api/ai/lesson-factory/aqa-gcse-biology")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "Cell structure", tier: "foundation", length: "short" });

    expect(res.status).toBe(200);
    const lesson = await Lesson.findById(res.body.lessonId).lean();
    expect(lesson.pages.length).toBe(4);
    expect(lesson.tier).toBe("foundation");
  });

  test("each page has at least one checkpoint block in blocks[] (PR3.3)", async () => {
    const res = await request(app)
      .post("/api/ai/lesson-factory/aqa-gcse-biology")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "Respiration", tier: "higher" });

    expect(res.status).toBe(200);
    const lesson = await Lesson.findById(res.body.lessonId).lean();
    lesson.pages.forEach((page) => {
      const checkpointBlocks =
        Array.isArray(page.blocks) ? page.blocks.filter((b) => b.type === "checkpoint") : [];
      expect(checkpointBlocks.length).toBeGreaterThanOrEqual(1);
    });
  });

  test("factory-generated lesson uses checkpoint blocks; page-level checkpoint absent when blocks present", async () => {
    const res = await request(app)
      .post("/api/ai/lesson-factory/aqa-gcse-biology")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "Enzymes", tier: "foundation" });

    expect(res.status).toBe(200);
    const lesson = await Lesson.findById(res.body.lessonId).lean();
    const pagesWithCheckpointBlock = lesson.pages.filter(
      (p) => Array.isArray(p.blocks) && p.blocks.some((b) => b.type === "checkpoint")
    );
    expect(pagesWithCheckpointBlock.length).toBe(lesson.pages.length);
    pagesWithCheckpointBlock.forEach((page) => {
      expect(page.checkpoint).toBeUndefined();
    });
  });

  test("USP1: when topic maps to diagram and VisualModel exists, lesson has at least one diagram block", async () => {
    const res = await request(app)
      .post("/api/ai/lesson-factory/aqa-gcse-biology")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "Photosynthesis", tier: "higher" });

    expect(res.status).toBe(200);
    const lesson = await Lesson.findById(res.body.lessonId).lean();
    const diagramBlocks = lesson.pages.flatMap((p) =>
      (Array.isArray(p.blocks) ? p.blocks : []).filter((b) => b.type === "diagram")
    );
    expect(diagramBlocks.length).toBeGreaterThanOrEqual(1);
    expect(diagramBlocks[0]).toHaveProperty("visualId");
    expect(diagramBlocks[0].caption).toBeDefined();
  });

  test("topicKey from taxonomy resolves to topic name and does not break existing flow", async () => {
    const res = await request(app)
      .post("/api/ai/lesson-factory/aqa-gcse-biology")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey: "cell-structure", tier: "higher" });

    expect(res.status).toBe(200);
    const lesson = await Lesson.findById(res.body.lessonId).lean();
    expect(lesson.topic).toBe("Cell structure");
    expect(lesson.subject).toBe("Biology");
  });

  test("topic (free text) still works when topicKey not provided", async () => {
    const res = await request(app)
      .post("/api/ai/lesson-factory/aqa-gcse-biology")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "Custom free topic", tier: "foundation" });

    expect(res.status).toBe(200);
    const lesson = await Lesson.findById(res.body.lessonId).lean();
    expect(lesson.topic).toBe("Custom free topic");
  });
});
