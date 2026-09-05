/**
 * Caller regression: contentGeneration practice-set surfaces mark-scheme recovery outcomes.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const ExamQuestion = require("../models/ExamQuestion");
const ContentGenerationJob = require("../models/ContentGenerationJob");

jest.mock("../services/generation/practiceSetService", () => ({
  runPracticeSetGeneration: jest.fn(),
}));

jest.mock("../utils/topicDriftValidation", () => ({
  filterBankItemsByDrift: jest.fn((x) => x),
}));

jest.mock("../utils/lessonAssetLlm", () => ({
  callOpenAiJson: jest.fn(),
}));

const { runPracticeSetGeneration } = require("../services/generation/practiceSetService");
const { callOpenAiJson } = require("../utils/lessonAssetLlm");

const hashedPassword = bcrypt.hashSync("password123", 10);
const TOPIC = "aqa-gcse-biology:cell-structure";

const baseExam = {
  question: "Explain how osmosis affects plant cells in a concentrated solution.",
  marks: 4,
  markScheme: [
    "Water moves out of the cell by osmosis.",
    "The cytoplasm shrinks and the cell becomes plasmolysed.",
    "The cell membrane pulls away from the cell wall.",
    "Turgor pressure is lost in the plant cell.",
  ],
  modelAnswer:
    "Water leaves the cell by osmosis, so the cytoplasm shrinks and the membrane pulls away from the cell wall.",
  topicKey: TOPIC,
};

const mismatchedExam = {
  ...baseExam,
  markScheme: ["Water moves out of the cell by osmosis.", "The cytoplasm shrinks and the cell becomes plasmolysed."],
};

describe("contentGeneration practice-set exam recovery callers", () => {
  let token;
  let userId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "CG",
      lastName: "Recovery",
      email: "cg-exam-recovery@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    userId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "cg-exam-recovery@test.com", password: "password123" });
    token = login.body?.token;
    if (!token) throw new Error("login failed");
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await ExamQuestion.deleteMany({ teacherId: userId });
    await ContentGenerationJob.deleteMany({ requestedBy: userId });
    runPracticeSetGeneration.mockResolvedValue({
      pack: { flashcards: [], quiz: [], examQuestions: [mismatchedExam] },
      contextChunks: [],
      counts: { quizMcq: 0, quizShort: 0, exam: 1, flashcards: 0 },
      warnings: [],
    });
  });

  test("exhausted corrective retry returns 422 incomplete and does not persist invalid exam question", async () => {
    callOpenAiJson.mockResolvedValue(mismatchedExam);

    const res = await request(app)
      .post("/api/generate/practice-set")
      .set("Authorization", `Bearer ${token}`)
      .send({ specKey: "aqa-gcse-biology", topicKey: TOPIC, counts: { exam: 1 } });

    expect(res.status).toBe(422);
    expect(res.body.incomplete).toBe(true);
    expect(res.body.code).toBe("GENERATED_EXAM_QUESTION_SET_INCOMPLETE");
    expect(res.body.examCount).toBe(0);
    expect(res.body.expectedExamCount).toBe(1);
    expect(callOpenAiJson).toHaveBeenCalledTimes(1);

    const saved = await ExamQuestion.countDocuments({ teacherId: userId });
    expect(saved).toBe(0);

    const job = await ContentGenerationJob.findById(res.body.jobId).lean();
    expect(job.status).toBe("failed");
    expect(job.outputs.examQuestionIds || []).toHaveLength(0);
  });

  test("successful corrective retry persists exam question and completes job", async () => {
    callOpenAiJson.mockResolvedValue(baseExam);

    const res = await request(app)
      .post("/api/generate/practice-set")
      .set("Authorization", `Bearer ${token}`)
      .send({ specKey: "aqa-gcse-biology", topicKey: TOPIC, counts: { exam: 1 } });

    expect(res.status).toBe(200);
    expect(res.body.incomplete).toBeUndefined();
    expect(res.body.outputs.examCount).toBe(1);
    expect(callOpenAiJson).toHaveBeenCalledTimes(1);

    const saved = await ExamQuestion.countDocuments({ teacherId: userId });
    expect(saved).toBe(1);

    const job = await ContentGenerationJob.findById(res.body.jobId).lean();
    expect(job.status).toBe("completed");
    expect(job.outputs.examQuestionIds).toHaveLength(1);
  });
});
