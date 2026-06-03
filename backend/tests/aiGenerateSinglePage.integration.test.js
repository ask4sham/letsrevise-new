/**
 * PR: AI lesson generation creates ONE default page with blocks.
 * Verifies: exactly 1 page, content in blocks, subsection labels become blocks not pages.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const {
  getValidCellStructureBlocks,
  getValidCellStructureDraft,
} = require("./helpers/validAiStructureLessonDraft");

jest.mock("axios");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("AI generate-and-save: single-page default", () => {
  let teacherToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Single",
      lastName: "Page",
      email: "single-page-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "single-page-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    // Ensure gold template exists
    let gold = await Lesson.findOne({ isTemplate: true }).lean();
    if (!gold) {
      gold = await Lesson.create({
        teacherId: teacher._id,
        teacherName: "Single Page",
        title: "Gold Template",
        description: "Template",
        content: "Template content",
        isTemplate: true,
        status: "draft",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        topic: "Template",
        pages: [
          { pageId: "p1", title: "Page 1", order: 1, blocks: [{ type: "text", content: "Intro" }] },
        ],
      });
    }
  }, 15000);

  afterAll(async () => {
    await User.deleteMany({ email: "single-page-teacher@test.com" });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("creates exactly 1 page by default", async () => {
    axios.post.mockResolvedValue({
      data: {
        output_text: JSON.stringify(getValidCellStructureDraft()),
      },
    });

    const res = await request(app)
      .post("/api/ai/generate-and-save")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: "Cell structure",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        topicKey: "aqa-gcse-biology:cell-structure",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.lessonId).toBeDefined();
    expect(res.body.pagesCount).toBe(1);

    const lesson = await Lesson.findById(res.body.lessonId).lean();
    expect(lesson).toBeDefined();
    expect(Array.isArray(lesson.pages)).toBe(true);
    expect(lesson.pages.length).toBe(1);
    expect(lesson.pages[0].title).toBe("Page 1");
    expect(Array.isArray(lesson.pages[0].blocks)).toBe(true);
    expect(lesson.pages[0].blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("collapses multiple LLM pages into one (deterministic post-processing)", async () => {
    // Simulate LLM returning subsection headings as separate pages (old behavior)
    const blocks = getValidCellStructureBlocks();
    const third = Math.ceil(blocks.length / 3);
    axios.post.mockResolvedValue({
      data: {
        output_text: JSON.stringify(
          getValidCellStructureDraft({
            pages: [
              { title: "Core Concept 1", order: 1, pageType: "", blocks: blocks.slice(0, third) },
              { title: "Exam Tips", order: 2, pageType: "", blocks: blocks.slice(third, third * 2) },
              { title: "Check Understanding", order: 3, pageType: "", blocks: blocks.slice(third * 2) },
            ],
          })
        ),
      },
    });

    const res = await request(app)
      .post("/api/ai/generate-and-save")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: "Cell structure",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        topicKey: "aqa-gcse-biology:cell-structure",
      });

    expect(res.status).toBe(200);
    expect(res.body.pagesCount).toBe(1);

    const lesson = await Lesson.findById(res.body.lessonId).lean();
    expect(lesson.pages.length).toBe(1);
    // All content should be in blocks on Page 1 (Core Concept, Exam Tips, Check Understanding merged)
    const pageBlocks = lesson.pages[0].blocks || [];
    expect(pageBlocks.length).toBeGreaterThanOrEqual(2);
    const hasCheckpoint = pageBlocks.some((b) => b.type === "checkpoint");
    expect(hasCheckpoint).toBe(true);
  });

  test("no separate pages for Core Concept, Exam Tips, Check Understanding, Stretch", async () => {
    const blocks = getValidCellStructureBlocks();
    const third = Math.ceil(blocks.length / 3);
    axios.post.mockResolvedValue({
      data: {
        output_text: JSON.stringify(
          getValidCellStructureDraft({
            tier: "higher",
            pages: [
              { title: "Overview", order: 1, pageType: "", blocks: blocks.slice(0, third) },
              { title: "Core Concept 2", order: 2, pageType: "", blocks: blocks.slice(third, third * 2) },
              { title: "Stretch: Deeper Knowledge", order: 3, pageType: "", blocks: blocks.slice(third * 2) },
            ],
          })
        ),
      },
    });

    const res = await request(app)
      .post("/api/ai/generate-and-save")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: "Cell structure",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        topicKey: "aqa-gcse-biology:cell-structure",
      });

    expect(res.status).toBe(200);
    expect(res.body.pagesCount).toBe(1);

    const lesson = await Lesson.findById(res.body.lessonId).lean();
    expect(lesson.pages.length).toBe(1);
    expect(lesson.pages[0].title).toBe("Page 1");
  });
});
