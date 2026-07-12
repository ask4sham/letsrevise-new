/**
 * Integration: AI composite draft endpoint — auth, no DB write, validation path.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");

jest.mock("../utils/lessonAssetLlm", () => ({
  callOpenAiJson: jest.fn(),
}));

const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const app = require("../app");
const User = require("../models/User");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);
jest.setTimeout(20000);

function validEasyDraft() {
  return {
    title: "Asexual reproduction basics",
    sharedStem: "A gardener grows identical strawberry plants from runners.",
    difficulty: "easy",
    totalMarks: 3,
    parts: [
      {
        label: "a",
        type: "mcq",
        marks: 1,
        questionText: "Which statement best describes asexual reproduction?",
        options: [
          "Offspring are produced by two parents and are genetically varied",
          "Offspring are produced by one parent and are genetically identical",
          "Gametes fuse to form a zygote",
          "Meiosis always occurs before fertilisation",
        ],
        correctIndex: 1,
        markSchemeLines: [
          "Award 1 mark for selecting Option B (offspring from one parent / genetically identical).",
        ],
        commandWord: "Identify",
        skill: "recall",
      },
      {
        label: "b",
        type: "short",
        marks: 2,
        questionText: "Describe one advantage of asexual reproduction for the plant.",
        markSchemeLines: [
          "Award 1 mark for rapid population increase / no need for pollinator.",
          "Award 1 mark for offspring adapted to the same environment / identical traits.",
        ],
        commandWord: "Describe",
        skill: "describe",
      },
    ],
    warnings: [],
  };
}

function validMediumDraft() {
  return {
    title: "Comparing reproductive strategies",
    sharedStem: "Some plants reproduce asexually while others reproduce sexually.",
    difficulty: "medium",
    totalMarks: 5,
    parts: [
      {
        label: "a",
        type: "mcq",
        marks: 1,
        questionText: "Which statement best describes asexual reproduction?",
        options: [
          "Offspring are produced by two parents and are genetically varied",
          "Offspring are produced by one parent and are genetically identical",
          "Gametes fuse to form a zygote",
          "Meiosis always occurs before fertilisation",
        ],
        correctIndex: 1,
        markSchemeLines: [
          "Award 1 mark for selecting Option B (offspring from one parent / genetically identical).",
        ],
        commandWord: "Identify",
        skill: "recall",
      },
      {
        label: "b",
        type: "short",
        marks: 2,
        questionText: "Explain why asexual offspring are genetically identical to the parent.",
        markSchemeLines: [
          "Award 1 mark for mitosis / no mixing of gametes.",
          "Award 1 mark for identical DNA / clones of the parent.",
        ],
        commandWord: "Explain",
        skill: "explain",
      },
      {
        label: "c",
        type: "short",
        marks: 2,
        questionText: "Suggest why asexual reproduction can be a disadvantage after an environmental change.",
        markSchemeLines: [
          "Award 1 mark for low genetic variation / all offspring similar.",
          "Award 1 mark for population may all be vulnerable / less likely to survive change.",
        ],
        commandWord: "Suggest",
        skill: "apply",
      },
    ],
    warnings: [],
  };
}

function validHardDraft() {
  return {
    title: "Higher-tier reproduction analysis",
    sharedStem: "Organisms can reproduce sexually or asexually depending on conditions.",
    difficulty: "hard",
    totalMarks: 6,
    parts: [
      {
        label: "a",
        type: "short",
        marks: 2,
        questionText: "Compare asexual and sexual reproduction in terms of genetic variation.",
        markSchemeLines: [
          "Award 1 mark for asexual produces clones / little variation.",
          "Award 1 mark for sexual produces genetic variation / mixing of alleles.",
        ],
        commandWord: "Compare",
        skill: "compare",
      },
      {
        label: "b",
        type: "short",
        marks: 2,
        questionText: "Evaluate the benefit of sexual reproduction in a changing environment.",
        markSchemeLines: [
          "Award 1 mark for variation increases chance some individuals survive.",
          "Award 1 mark for linked explanation of changing selection pressures.",
        ],
        commandWord: "Evaluate",
        skill: "evaluate",
      },
      {
        label: "c",
        type: "short",
        marks: 2,
        questionText: "Justify why farmers may still prefer asexual methods for some crops.",
        markSchemeLines: [
          "Award 1 mark for desirable traits conserved / uniform yield.",
          "Award 1 mark for faster production / no need for pollination.",
        ],
        commandWord: "Justify",
        skill: "justify",
      },
    ],
    warnings: [],
  };
}

describe("POST /api/exam-questions/ai-draft-composite", () => {
  let token;

  beforeAll(async () => {
    await User.create({
      firstName: "Ai",
      lastName: "Draft",
      email: "ai-composite-draft@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "ai-composite-draft@test.com", password: "password123" });
    token = login.body?.token;
    if (!token) throw new Error("Login failed");
  });

  beforeEach(() => {
    callOpenAiJson.mockReset();
  });

  test("auth required", async () => {
    const res = await request(app).post("/api/exam-questions/ai-draft-composite").send({
      topicKey: "edexcel-igcse-biology:x",
      difficulty: "easy",
    });
    expect(res.status).toBe(401);
  });

  test("returns draft and does not save to DB", async () => {
    callOpenAiJson.mockResolvedValue(validEasyDraft());
    const before = await ExamQuestion.countDocuments();
    const res = await request(app)
      .post("/api/exam-questions/ai-draft-composite")
      .set("Authorization", `Bearer ${token}`)
      .send({
        subject: "Biology",
        examBoard: "Edexcel",
        level: "IGCSE",
        topic: "Sexual & Asexual Reproduction",
        topicKey: "edexcel-igcse-biology:sexual-asexual",
        difficulty: "easy",
        hasImage: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.draft.totalMarks).toBe(3);
    expect(res.body.draft.parts).toHaveLength(2);
    expect(res.body.draft.parts[0].type).toBe("mcq");
    expect(res.body.draft.parts[1].type).toBe("short");
    const after = await ExamQuestion.countDocuments();
    expect(after).toBe(before);
  });

  test("medium can return MCQ + short", async () => {
    callOpenAiJson.mockResolvedValue(validMediumDraft());
    const res = await request(app)
      .post("/api/exam-questions/ai-draft-composite")
      .set("Authorization", `Bearer ${token}`)
      .send({
        topicKey: "edexcel-igcse-biology:sexual-asexual",
        difficulty: "medium",
        hasImage: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.draft.parts.some((p) => p.type === "mcq")).toBe(true);
    expect(res.body.draft.parts.some((p) => p.type === "short")).toBe(true);
  });

  test("hard can return short-heavy draft", async () => {
    callOpenAiJson.mockResolvedValue(validHardDraft());
    const res = await request(app)
      .post("/api/exam-questions/ai-draft-composite")
      .set("Authorization", `Bearer ${token}`)
      .send({
        topicKey: "edexcel-igcse-biology:sexual-asexual",
        difficulty: "hard",
        hasImage: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.draft.parts.every((p) => p.type === "short")).toBe(true);
    expect(res.body.draft.totalMarks).toBe(6);
  });

  test("rejects missing topic", async () => {
    const res = await request(app)
      .post("/api/exam-questions/ai-draft-composite")
      .set("Authorization", `Bearer ${token}`)
      .send({ difficulty: "easy" });
    expect(res.status).toBe(400);
    expect(callOpenAiJson).not.toHaveBeenCalled();
  });

  test("returns 422 for invalid AI output", async () => {
    callOpenAiJson.mockResolvedValue({
      title: "x",
      sharedStem: "short",
      difficulty: "easy",
      totalMarks: 1,
      parts: [{ label: "a", type: "table", marks: 1, questionText: "x", markSchemeLines: [] }],
    });
    const res = await request(app)
      .post("/api/exam-questions/ai-draft-composite")
      .set("Authorization", `Bearer ${token}`)
      .send({
        topicKey: "edexcel-igcse-biology:x",
        difficulty: "easy",
        hasImage: false,
      });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.issues)).toBe(true);
  });
});
