/**
 * STEP 15 — Generated lesson structure test case.
 * Verifies: generate lesson → has hook, worked example, diagrams, exam tips.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const { getValidCellStructureDraft } = require("./helpers/validAiStructureLessonDraft");

jest.mock("axios");

const hashedPassword = bcrypt.hashSync("password123", 10);

function getBlocks(lesson) {
  return (lesson?.pages ?? []).flatMap((p) => p?.blocks ?? []);
}

describe("AI generate-and-save: structure (hook, worked example, diagrams, exam tips)", () => {
  let teacherToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Structure",
      lastName: "Test",
      email: "structure-test-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "structure-test-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    let gold = await Lesson.findOne({ isTemplate: true }).lean();
    if (!gold) {
      await Lesson.create({
        teacherId: teacher._id,
        teacherName: "Structure Test",
        title: "Gold Template",
        description: "Template",
        content: "Template content",
        isTemplate: true,
        status: "draft",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        topic: "Template",
        pages: [{ pageId: "p1", title: "Page 1", order: 1, blocks: [{ type: "text", content: "Intro" }] }],
      });
    }
  }, 15000);

  afterAll(async () => {
    await User.deleteMany({ email: "structure-test-teacher@test.com" });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("generated lesson has hook, worked example, diagrams, exam tips", async () => {
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

    const lesson = await Lesson.findById(res.body.lessonId).lean();
    expect(lesson).toBeDefined();

    const blocks = getBlocks(lesson);

    const hasHook = blocks.some((b) => String(b?.role ?? "").trim() === "hook");
    expect(hasHook).toBe(true);

    const hasWorkedExample = blocks.some(
      (b) =>
        String(b?.role ?? "").trim() === "workedExample" &&
        [b?.explanation, b?.correctAnswer, b?.prompt, b?.answer].filter(Boolean).map(String).join(" ").length > 30
    );
    expect(hasWorkedExample).toBe(true);

    const diagramCount = blocks.filter((b) => String(b?.type ?? "").trim() === "diagram").length;
    expect(diagramCount).toBeGreaterThanOrEqual(2);

    const examTipCount = blocks.filter((b) =>
      ["examTip", "examTips"].includes(String(b?.type ?? "").trim())
    ).length;
    expect(examTipCount).toBeGreaterThanOrEqual(1);
  });
});
