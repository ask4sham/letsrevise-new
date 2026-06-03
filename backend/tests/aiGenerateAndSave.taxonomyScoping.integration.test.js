/**
 * Strict taxonomy scoping for AI generate-and-save.
 * Verifies: invalid topicKey → 400, valid topicKey → 200, drift validation → warning.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const app = require("../app");
const {
  getValidCellStructureBlocks,
  getValidCellStructureDraft,
} = require("./helpers/validAiStructureLessonDraft");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

jest.mock("axios");

const hashedPassword = bcrypt.hashSync("password123", 10);

function mockOpenAIResponse(payload) {
  // generate-and-save uses callOpenAI which expects Responses API format (output_text)
  axios.post.mockResolvedValue({
    data: {
      output_text: JSON.stringify(payload),
    },
  });
}

describe("AI generate-and-save: taxonomy scoping", () => {
  let teacherToken;
  let goldId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Tax",
      lastName: "Teacher",
      email: "taxonomy-scope-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "taxonomy-scope-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    // Ensure gold template exists
    let gold = await Lesson.findOne({ isTemplate: true }).lean();
    if (!gold) {
      gold = await Lesson.create({
        teacherId: teacher._id,
        teacherName: "Tax Teacher",
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
          { pageId: "p2", title: "Page 2", order: 2, blocks: [{ type: "text", content: "Content" }] },
        ],
      });
    }
    goldId = gold._id;
  }, 15000);

  afterAll(async () => {
    await User.deleteMany({ email: "taxonomy-scope-teacher@test.com" });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock: valid cell-structure content (no drift) — Responses API format
    const defaultPayload = getValidCellStructureDraft();
    axios.post.mockResolvedValue({
      data: { output_text: JSON.stringify(defaultPayload) },
    });
  });

  test("400 when topicKey is invalid for spec", async () => {
    const res = await request(app)
      .post("/api/ai/generate-and-save")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: "Cell structure",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        topicKey: "not-a-valid-topic-xyz",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/topic|syllabus|map/i);
  });

  test("200 with valid topicKey returns lessonId and topicKey", async () => {
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
    expect(axios.post).toHaveBeenCalled();
  });

  test("drift validation surfaces warning when content includes sibling topics", async () => {
    // Mock LLM to return content with mitosis (sibling of cell-structure)
    const driftBlocks = [
      ...getValidCellStructureBlocks(),
      {
        type: "text",
        role: "concept",
        content:
          "Mitosis is the process of cell division. Mitosis produces two identical daughter cells during mitotic division.",
      },
    ];
    mockOpenAIResponse(getValidCellStructureDraft({ blocks: driftBlocks }));

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
    // Drift check should flag mitosis → warning present
    expect(res.body.warning).toBeDefined();
    expect(res.body.warning).toMatch(/drifted|sub-topic|mitosis/i);
  });
});
