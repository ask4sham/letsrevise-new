/**
 * Integration: AI composite draft endpoint — auth, no DB write, required MCQ.
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

function mcqPart(label = "a") {
  return {
    label,
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
  };
}

function validEasyDraft() {
  return {
    title: "Asexual reproduction basics",
    sharedStem: "A gardener grows identical strawberry plants from runners.",
    difficulty: "easy",
    totalMarks: 3,
    parts: [
      mcqPart("a"),
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
      mcqPart("a"),
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
    totalMarks: 7,
    parts: [
      {
        label: "a",
        type: "mcq",
        marks: 1,
        questionText: "A farmer produces identical potato plants from tubers. Why can a new disease wipe out the whole crop?",
        options: [
          "Asexual offspring are genetically identical so all may be susceptible",
          "Sexual reproduction always produces weaker plants",
          "Tubers cannot store food reserves",
          "Meiosis increases mutation rate in every tuber generation",
        ],
        correctIndex: 0,
        markSchemeLines: [
          "Award 1 mark for selecting Option A (clones / identical genetics / shared susceptibility).",
        ],
        commandWord: "Explain",
        skill: "apply",
      },
      {
        label: "b",
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
        label: "c",
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
        label: "d",
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
      email: "ai-composite-draft-mcq-required@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "ai-composite-draft-mcq-required@test.com", password: "password123" });
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

  test("Easy generated draft contains exactly one MCQ and does not save", async () => {
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
    expect(res.body.draft.parts.filter((p) => p.type === "mcq")).toHaveLength(1);
    expect(res.body.draft.parts.filter((p) => p.type === "short")).toHaveLength(1);
    expect(await ExamQuestion.countDocuments()).toBe(before);
  });

  test("Medium generated draft contains exactly one MCQ", async () => {
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
    expect(res.body.draft.parts.filter((p) => p.type === "mcq")).toHaveLength(1);
    expect(res.body.draft.parts.filter((p) => p.type === "short")).toHaveLength(2);
  });

  test("Hard generated draft contains exactly one MCQ", async () => {
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
    expect(res.body.draft.parts.filter((p) => p.type === "mcq")).toHaveLength(1);
    expect(res.body.draft.parts.every((p) => p.type !== "table")).toBe(true);
  });

  test("rejects missing topic", async () => {
    const res = await request(app)
      .post("/api/exam-questions/ai-draft-composite")
      .set("Authorization", `Bearer ${token}`)
      .send({ difficulty: "easy" });
    expect(res.status).toBe(400);
    expect(callOpenAiJson).not.toHaveBeenCalled();
  });

  test("returns 422 for short-only AI output", async () => {
    callOpenAiJson.mockResolvedValue({
      title: "Short only",
      sharedStem: "A gardener grows identical strawberry plants from runners.",
      difficulty: "easy",
      totalMarks: 3,
      parts: [
        {
          label: "a",
          type: "short",
          marks: 1,
          questionText: "State what is meant by asexual reproduction.",
          markSchemeLines: ["Award 1 mark for one parent / genetically identical offspring."],
        },
        {
          label: "b",
          type: "short",
          marks: 2,
          questionText: "Describe one advantage of asexual reproduction for the plant.",
          markSchemeLines: [
            "Award 1 mark for rapid population increase.",
            "Award 1 mark for offspring adapted to the same environment.",
          ],
        },
      ],
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
    expect(res.body.issues).toEqual(expect.arrayContaining(["mcq_required_exactly_one"]));
  });
});
