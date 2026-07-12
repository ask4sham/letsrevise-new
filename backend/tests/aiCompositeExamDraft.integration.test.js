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
        type: "short",
        marks: 1,
        questionText: "State what is meant by asexual reproduction.",
        markSchemeLines: ["Award 1 mark for reproduction involving one parent / no gametes / genetically identical offspring."],
        commandWord: "State",
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
    const after = await ExamQuestion.countDocuments();
    expect(after).toBe(before);
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
