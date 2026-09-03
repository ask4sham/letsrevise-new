/**
 * GET /api/exam-questions must exclude disposable sandbox browser-test masters.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);
const EDEXCEL_MUTATION = "edexcel-igcse-biology:mutation";

describe("GET /api/exam-questions sandbox manual test exclusion", () => {
  let teacherToken;
  let teacherId;
  let sandboxQuestionId;
  let legitQuestionId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Sandbox",
      lastName: "Bank",
      email: "sandbox-bank-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "sandbox-bank-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    const sandbox = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topicKey: EDEXCEL_MUTATION,
      topic: "Mutation",
      type: "mcq",
      marks: 1,
      question: "Disposable sandbox MCQ — must not appear in Question Bank",
      status: "published",
      metadata: {
        sandboxManualTest: true,
        purpose: "disposable-browser-test",
      },
    });
    sandboxQuestionId = String(sandbox._id);

    const legit = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topicKey: EDEXCEL_MUTATION,
      topic: "Mutation",
      type: "short",
      marks: 2,
      question: "Explain how a gene mutation can affect a protein.",
      markScheme: ["Mutation may change amino acid sequence", "Protein shape or function may change"],
      status: "published",
    });
    legitQuestionId = String(legit._id);
  }, 15000);

  afterAll(async () => {
    await ExamQuestion.deleteMany({ teacherId });
    await User.deleteMany({ email: "sandbox-bank-teacher@test.com" });
  });

  test("excludes metadata.sandboxManualTest true from Question Bank listing", async () => {
    const res = await request(app)
      .get("/api/exam-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ specKey: "edexcel-igcse-biology", topicKey: "mutation" });

    expect(res.status).toBe(200);
    const ids = (res.body.questions || []).map((q) => String(q._id || q.id));
    expect(ids).not.toContain(sandboxQuestionId);
    expect(ids).toContain(legitQuestionId);
  });

  test("Edexcel Mutation query resolves edexcel-igcse-biology:mutation namespace", async () => {
    const res = await request(app)
      .get("/api/exam-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ specKey: "edexcel-igcse-biology", topicKey: "mutation" });

    expect(res.status).toBe(200);
    const questions = res.body.questions || [];
    expect(questions.length).toBeGreaterThanOrEqual(1);
    questions.forEach((q) => {
      expect([EDEXCEL_MUTATION, "mutation"]).toContain(q.topicKey);
    });
    expect(questions.some((q) => String(q._id || q.id) === legitQuestionId)).toBe(true);
  });
});
