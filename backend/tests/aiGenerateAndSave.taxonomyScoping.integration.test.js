/**
 * Strict taxonomy scoping for AI generate-and-save.
 * Verifies: invalid topicKey → 400, valid topicKey → 200, drift validation → warning.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const app = require("../app");
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
    const defaultPayload = {
      title: "Cell Structure",
      description: "Eukaryotic cell organelles.",
      estimatedDuration: 25,
      tags: ["cells", "biology"],
      board: "AQA",
      tier: "foundation",
      pages: [
        {
          title: "Overview",
          order: 1,
          pageType: "intro",
          blocks: [
            {
              type: "text",
              content:
                "Eukaryotic cells have a nucleus, cytoplasm, and cell membrane. Plant cells also have chloroplasts and a cell wall.",
            },
          ],
          checkpoint: {
            question: "What organelle contains DNA?",
            options: ["Nucleus", "Cytoplasm", "Ribosome", "Mitochondria"],
            answer: "Nucleus",
          },
        },
      ],
    };
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
    mockOpenAIResponse({
      title: "Cell Structure",
      description: "Cells.",
      estimatedDuration: 25,
      tags: ["cells"],
      board: "AQA",
      tier: "foundation",
      pages: [
        {
          title: "Overview",
          order: 1,
          pageType: "intro",
          blocks: [
            {
              type: "text",
              content:
                "Cells have a nucleus. Mitosis is the process of cell division. Mitosis produces two identical daughter cells. Mitotic division is important.",
            },
          ],
          checkpoint: {
            question: "What is mitosis?",
            options: ["A", "B", "C", "D"],
            answer: "A",
          },
        },
      ],
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
    // Drift check should flag mitosis → warning present
    expect(res.body.warning).toBeDefined();
    expect(res.body.warning).toMatch(/drifted|sub-topic|mitosis/i);
  });
});
