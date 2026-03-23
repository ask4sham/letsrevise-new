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
        output_text: JSON.stringify({
          title: "Cell Structure",
          description: "Eukaryotic and prokaryotic cells.",
          estimatedDuration: 40,
          tags: ["cells", "biology"],
          board: "AQA",
          tier: "foundation",
          pages: [
            {
              title: "Page 1",
              order: 1,
              pageType: "",
              blocks: [
                { type: "text", role: "hook", content: "Cells are the basic units of life. What makes them work?" },
                { type: "keyIdea", role: "coreRule", content: "Eukaryotic cells have a nucleus and membrane-bound organelles." },
                { type: "commonMistake", role: "commonMistake", content: "Students often think prokaryotes have a nucleus. They do not—DNA floats in cytoplasm." },
                { type: "keyIdea", role: "patternRecognition", content: "Exam questions often ask you to compare plant and animal cells." },
                { type: "diagram", role: "concept", caption: "image here", content: "image here" },
                { type: "keyIdea", role: "whatToNotice", title: "What to Notice", content: "Nucleus, cytoplasm, cell membrane." },
                { type: "text", role: "concept", content: "The nucleus controls the cell. Cytoplasm is where reactions happen." },
                { type: "examTip", role: "concept", content: "Describe the function of each organelle in exams." },
                { type: "diagram", role: "concept", caption: "image here", content: "image here" },
                { type: "keyIdea", role: "whatToNotice", title: "What to Notice", content: "Chloroplasts in plant cells only." },
                { type: "text", role: "concept", content: "Plant cells have chloroplasts for photosynthesis." },
                { type: "examTip", role: "concept", content: "Compare plant and animal cells using a table." },
                {
                  type: "checkpoint",
                  role: "workedExample",
                  prompt: "Explain why plant cells have chloroplasts but animal cells do not. (3 marks)",
                  questionType: "short",
                  options: [],
                  correctAnswer: "Plant cells carry out photosynthesis to make glucose. Chloroplasts contain chlorophyll and are the site of photosynthesis. Animal cells do not photosynthesise.",
                  explanation: "Full marks for linking structure to function.",
                },
                { type: "keyIdea", role: "synthesis", content: "Plant cells: chloroplasts, cell wall, large vacuole. Animal cells: no cell wall, small vacuoles." },
                {
                  type: "checkpoint",
                  role: "quickCheck",
                  prompt: "Which organelle contains DNA?",
                  questionType: "mcq",
                  options: ["Nucleus", "Cytoplasm", "Ribosome", "Mitochondria"],
                  correctAnswer: "Nucleus",
                  explanation: "",
                },
                {
                  type: "checkpoint",
                  role: "quickCheck",
                  prompt: "Describe the function of the mitochondria.",
                  questionType: "short",
                  options: [],
                  correctAnswer: "Releases energy in respiration.",
                  explanation: "",
                },
                { type: "keyIdea", role: "finalMemoryRule", content: "Eukaryotic cells have a nucleus. Prokaryotes do not." },
              ],
            },
          ],
        }),
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
