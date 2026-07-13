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

/**
 * Enrich Cell Structure teaching blocks so the LLM mock already satisfies the
 * fail-closed activity-question count/variety contract (without weakening production).
 * Keeps worked-example checkpoint; replaces single-question quick-checks.
 */
function getContractValidCellStructureBlocks() {
  const teaching = getValidCellStructureBlocks().filter(
    (b) => !(b.type === "checkpoint" && b.role === "quickCheck")
  );

  const selfCheckQuestions = [
    {
      prompt: "Define what is meant by a eukaryotic cell in cell structure.",
      questionType: "short",
      options: [],
      correctAnswer: "A cell with a nucleus and membrane-bound organelles.",
      explanation: "State nucleus + membrane-bound organelles for the definition mark.",
      purpose: "definition",
    },
    {
      prompt:
        "A student says prokaryotic cells have a nucleus. Explain why this is a misconception.",
      questionType: "short",
      options: [],
      correctAnswer:
        "Prokaryotes have DNA in the cytoplasm (nucleoid), not a membrane-bound nucleus.",
      explanation: "Contrast prokaryote nucleoid with eukaryotic nucleus.",
      purpose: "misconception",
    },
    {
      prompt: "Explain why mitochondria are important for cell function.",
      questionType: "short",
      options: [],
      correctAnswer: "Mitochondria release energy from respiration for cell processes.",
      explanation: "Link organelle to energy release / respiration.",
      purpose: "explain",
    },
  ];

  const checkpointQuestions = [
    {
      prompt: "Which organelle contains DNA in a typical eukaryotic cell?",
      questionType: "mcq",
      options: ["Nucleus", "Cytoplasm", "Ribosome", "Cell wall"],
      correctAnswer: "Nucleus",
      explanation: "DNA is stored in the nucleus of eukaryotic cells.",
      purpose: "recall",
    },
    {
      prompt:
        "In a cell that cannot carry out photosynthesis, which organelle is most likely missing?",
      questionType: "mcq",
      options: ["Chloroplast", "Nucleus", "Mitochondria", "Ribosome"],
      correctAnswer: "Chloroplast",
      explanation: "Chloroplasts are required for photosynthesis in plant cells.",
      purpose: "application",
    },
    {
      prompt: "Why do plant cells need chloroplasts but animal cells do not?",
      questionType: "mcq",
      options: [
        "Plant cells photosynthesise to make glucose; animal cells do not",
        "Animal cells already contain chlorophyll in the cytoplasm",
        "Chloroplasts store DNA only in animal cells",
        "Plant cells lack mitochondria so chloroplasts release energy",
      ],
      correctAnswer: "Plant cells photosynthesise to make glucose; animal cells do not",
      explanation: "Link chloroplasts to photosynthesis, which animals do not perform.",
      purpose: "explain",
    },
  ];

  const selfCheck = {
    type: "selfCheck",
    role: "selfCheck",
    // Top-level fields kept for older structure checks; questions[] is the contract bank.
    prompt: selfCheckQuestions[0].prompt,
    questionType: "short",
    options: [],
    correctAnswer: selfCheckQuestions[0].correctAnswer,
    explanation: selfCheckQuestions[0].explanation,
    questions: selfCheckQuestions,
  };

  const checkpoint = {
    type: "checkpoint",
    role: "quickCheck",
    prompt: checkpointQuestions[0].prompt,
    questionType: "mcq",
    options: checkpointQuestions[0].options,
    correctAnswer: checkpointQuestions[0].correctAnswer,
    explanation: checkpointQuestions[0].explanation,
    questions: checkpointQuestions,
  };

  // Keep a strong real-world/medical application in the later half of the lesson
  // so structure validation still passes after multi-page collapse + activity banks.
  const lateMedicalApplication = {
    type: "text",
    role: "concept",
    content:
      "In medicine, hospital pathologists use microscopes on patient samples — a real-world medical application of cell structure knowledge in diagnosis.",
  };

  const insertAt = teaching.findIndex((b) => b.role === "finalMemoryRule");
  const at = insertAt >= 0 ? insertAt : teaching.length;
  return [
    ...teaching.slice(0, at),
    selfCheck,
    checkpoint,
    ...teaching.slice(at),
    lateMedicalApplication,
  ];
}

function getContractValidQuiz() {
  return {
    timeSeconds: 600,
    questions: [
      {
        id: "q1",
        type: "mcq",
        question: "Which option correctly defines a eukaryotic cell?",
        options: [
          "A cell with a nucleus and membrane-bound organelles",
          "A cell with DNA only in the cytoplasm and no membrane systems",
          "A cell that never contains mitochondria",
          "A cell wall-only structure without cytoplasm",
        ],
        correctAnswer: "A cell with a nucleus and membrane-bound organelles",
        explanation: "Eukaryotic cells have a nucleus and membrane-bound organelles.",
        purpose: "definition",
      },
      {
        id: "q2",
        type: "mcq",
        question: "Which statement shows a common misconception about prokaryotes?",
        options: [
          "Prokaryotes have a membrane-bound nucleus",
          "Prokaryotes have DNA in the cytoplasm",
          "Prokaryotes lack membrane-bound organelles",
          "Prokaryotes are usually smaller than eukaryotic cells",
        ],
        correctAnswer: "Prokaryotes have a membrane-bound nucleus",
        explanation: "Prokaryotes do not have a membrane-bound nucleus.",
        purpose: "misconception",
      },
      {
        id: "q3",
        type: "mcq",
        question:
          "If a plant cell loses its chloroplasts, what is the most likely effect on the cell?",
        options: [
          "It can no longer photosynthesise to make glucose",
          "It immediately gains a nucleus for the first time",
          "It stops having a cell membrane",
          "It becomes a prokaryotic cell",
        ],
        correctAnswer: "It can no longer photosynthesise to make glucose",
        explanation: "Chloroplasts are the site of photosynthesis.",
        purpose: "application",
      },
      {
        id: "q4",
        type: "mcq",
        question: "How do plant cells and animal cells differ in cell structure?",
        options: [
          "Plant cells have a cell wall and chloroplasts; animal cells do not",
          "Animal cells have chloroplasts; plant cells never do",
          "Only animal cells have a nucleus",
          "Plant cells lack cytoplasm entirely",
        ],
        correctAnswer: "Plant cells have a cell wall and chloroplasts; animal cells do not",
        explanation: "Classic plant vs animal cell comparison point.",
        purpose: "comparison",
      },
      {
        id: "q5",
        type: "mcq",
        question:
          "Which answer would earn a mark for explaining mitochondria in cell structure (not just naming them)?",
        options: [
          "Mitochondria release energy from respiration for cell processes",
          "Mitochondria",
          "They are green",
          "They are only found in prokaryotes",
        ],
        correctAnswer: "Mitochondria release energy from respiration for cell processes",
        explanation: "Explanation must link structure/organelle to function.",
        purpose: "exam_style",
      },
    ],
  };
}

function mockLlmCellStructureDraft(overrides = {}) {
  const draft = getValidCellStructureDraft({
    blocks: getContractValidCellStructureBlocks(),
    ...overrides,
  });
  draft.quiz = getContractValidQuiz();
  return draft;
}

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
        output_text: JSON.stringify(mockLlmCellStructureDraft()),
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
    // Simulate LLM returning subsection headings as separate pages (old behavior).
    // Activity banks remain contract-valid; only page packaging is multi-page.
    const blocks = getContractValidCellStructureBlocks();
    const third = Math.ceil(blocks.length / 3);
    axios.post.mockResolvedValue({
      data: {
        output_text: JSON.stringify(
          mockLlmCellStructureDraft({
            pages: [
              { title: "Core Concept 1", order: 1, pageType: "", blocks: blocks.slice(0, third) },
              { title: "Exam Tips", order: 2, pageType: "", blocks: blocks.slice(third, third * 2) },
              // Avoid "Check Understanding" title — pipeline may inject an extra thin checkpoint.
              { title: "Section Review", order: 3, pageType: "", blocks: blocks.slice(third * 2) },
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
    // All content should be in blocks on Page 1 (Core Concept, Exam Tips, Section Review merged)
    const pageBlocks = lesson.pages[0].blocks || [];
    expect(pageBlocks.length).toBeGreaterThanOrEqual(2);
    const hasCheckpoint = pageBlocks.some((b) => b.type === "checkpoint");
    expect(hasCheckpoint).toBe(true);
  });

  test("no separate pages for Core Concept, Exam Tips, Check Understanding, Stretch", async () => {
    const blocks = getContractValidCellStructureBlocks();
    const third = Math.ceil(blocks.length / 3);
    axios.post.mockResolvedValue({
      data: {
        output_text: JSON.stringify(
          mockLlmCellStructureDraft({
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
