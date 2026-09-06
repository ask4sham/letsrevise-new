/**
 * Block 28 Semantic Short-Answer Marking — API integration tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");
const mutationFixture = require("./fixtures/semanticMarking/mutation");
const { buildMockLlmPoints } = require("./fixtures/semanticMarking/mockResponses");

jest.mock("../services/semanticShortAnswerMarking/llm", () => ({
  callSemanticMarkingLlm: jest.fn(),
}));

const { callSemanticMarkingLlm } = require("../services/semanticShortAnswerMarking/llm");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("semanticShortAnswerMarking integration", () => {
  let teacherToken;
  let teacherId;
  let lessonId;
  let questionId;
  let attachmentRefId;

  beforeAll(async () => {
    process.env.BLOCK28_SEMANTIC_MARKING_V1 = "1";

    const teacher = await User.create({
      firstName: "Semantic",
      lastName: "Marking",
      email: "semantic-marking-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "semantic-marking-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;

    const master = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      question: mutationFixture.question,
      marks: mutationFixture.marks,
      markScheme: mutationFixture.markScheme,
      correctAnswer: "STALE MODEL ANSWER MUST NOT AFFECT SCORE",
      topicKey: "aqa-gcse-biology:mutation",
      topic: "Mutation",
      status: "published",
    });
    questionId = master._id;

    const lesson = await Lesson.create({
      title: "Semantic Marking Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Mutation",
      topicKey: "aqa-gcse-biology:mutation",
      status: "published",
      isFreePreview: true,
      examQuestions: [{ questionId: master._id, addedAt: new Date() }],
    });
    lessonId = lesson._id;

    const saved = await Lesson.findById(lessonId).lean();
    attachmentRefId = String(saved.examQuestions[0]._id);
  });

  afterAll(async () => {
    delete process.env.BLOCK28_SEMANTIC_MARKING_V1;
    await User.deleteMany({ email: "semantic-marking-teacher@test.com" });
    await Lesson.deleteMany({ _id: lessonId });
    await ExamQuestion.deleteMany({ _id: questionId });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST mark-short returns server-derived score", async () => {
    const answer = mutationFixture.cases[0].answer;
    callSemanticMarkingLlm.mockResolvedValueOnce({
      points: buildMockLlmPoints(1, mutationFixture.markScheme, answer),
    });

    const res = await request(app)
      .post(`/api/lessons/${lessonId}/practice/mark-short`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ questionId: String(questionId), studentAnswer: answer });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.score).toBe(1);
    expect(res.body.maxMarks).toBe(4);
    expect(res.body.isCorrect).toBe(false);
    expect(res.body.points).toHaveLength(4);
    expect(res.body.points[0].awarded).toBe(1);
  });

  test("GET practice includes attachmentRefId for attached questions", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}/practice`)
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.semanticMarkingEnabled).toBe(true);
    const q = (res.body.questions || []).find((row) => String(row.id) === String(questionId));
    expect(q).toBeTruthy();
    expect(q.attachmentRefId).toBe(attachmentRefId);
  });

  test("stale correctAnswer on master does not change API score path", async () => {
    const answer = mutationFixture.cases[0].answer;
    callSemanticMarkingLlm.mockResolvedValueOnce({
      points: buildMockLlmPoints(1, mutationFixture.markScheme, answer),
    });

    const res = await request(app)
      .post(`/api/lessons/${lessonId}/practice/mark-short`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        questionId: String(questionId),
        studentAnswer: answer,
        markScheme: ["FAKE"],
        marks: 99,
        correctAnswer: "FAKE",
      });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);
    expect(res.body.maxMarks).toBe(4);
  });

  test("invalid JSON then retry succeeds", async () => {
    const answer = mutationFixture.cases[1].answer;
    callSemanticMarkingLlm
      .mockResolvedValueOnce({
        points: [{ index: 1, judgement: "SATISFIED", studentEvidence: "random only", reason: "bad" }],
      })
      .mockResolvedValueOnce({
        points: buildMockLlmPoints(2, mutationFixture.markScheme, answer),
      });

    const res = await request(app)
      .post(`/api/lessons/${lessonId}/practice/mark-short`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ questionId: String(questionId), studentAnswer: answer });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(2);
    expect(callSemanticMarkingLlm).toHaveBeenCalledTimes(2);
  });

  test("invalid twice returns unavailable", async () => {
    callSemanticMarkingLlm.mockResolvedValue({
      points: [{ index: 1, judgement: "SATISFIED", studentEvidence: "not in answer", reason: "bad" }],
    });

    const res = await request(app)
      .post(`/api/lessons/${lessonId}/practice/mark-short`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ questionId: String(questionId), studentAnswer: "real answer text" });

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("unavailable");
    expect(res.body.code).toBe("MARKING_UNAVAILABLE");
  });

  test("feature flag off returns unavailable", async () => {
    delete process.env.BLOCK28_SEMANTIC_MARKING_V1;
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/practice/mark-short`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ questionId: String(questionId), studentAnswer: "Mutations occur randomly." });

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("unavailable");
    process.env.BLOCK28_SEMANTIC_MARKING_V1 = "1";
  });

  test("rejects empty student answer", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/practice/mark-short`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ questionId: String(questionId), studentAnswer: "   " });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("EMPTY_ANSWER");
  });

  test("attachmentRefId resolves correct attachment", async () => {
    const answer = mutationFixture.cases[0].answer;
    callSemanticMarkingLlm.mockResolvedValueOnce({
      points: buildMockLlmPoints(1, mutationFixture.markScheme, answer),
    });

    const res = await request(app)
      .post(`/api/lessons/${lessonId}/practice/mark-short`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        questionId: String(questionId),
        attachmentRefId,
        studentAnswer: answer,
      });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);
  });
});
