/**
 * Block 28 Practice Integrity V1 — attach + /practice integration tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");
const { buildExamQuestionFingerprints } = require("../../lib/teacherBrain/examAwarePractice");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Block 28 Practice Integrity V1", () => {
  let teacherToken;
  let teacherId;
  let lessonId;
  let shortIds = [];
  let mcqId;
  let compositeId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Block28",
      lastName: "Integrity",
      email: "block28-integrity-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "block28-integrity-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("login failed");

    const mcq = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "mcq",
      question: "Which statement about mutations is correct?",
      options: ["A", "B", "C", "D"],
      correctIndex: 0,
      marks: 2,
      topicKey: "edexcel-igcse-biology:mutation",
      topic: "Mutation",
      status: "published",
    });
    mcqId = mcq._id;

    for (let i = 0; i < 10; i++) {
      const q = await ExamQuestion.create({
        teacherId,
        subject: "Biology",
        type: "short",
        question: `Short practice question ${i + 1} about mutations in organisms?`,
        marks: 2,
        markScheme: [`Point ${i + 1}a for question ${i + 1}`, `Point ${i + 1}b for question ${i + 1}`],
        topicKey: "edexcel-igcse-biology:mutation",
        topic: "Mutation",
        status: "published",
      });
      shortIds.push(q._id);
    }

    const composite = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "composite",
      question: "Composite stem about mutations for Block 28 integrity test.",
      topicKey: "edexcel-igcse-biology:mutation",
      topic: "Mutation",
      status: "published",
      parts: [
        {
          type: "short",
          questionText: "Part a",
          markScheme: ["Award 1 mark for part a."],
        },
      ],
      marks: 2,
    });
    compositeId = composite._id;

    const lesson = await Lesson.create({
      title: "Block28 Integrity Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Mutation",
      topicKey: "edexcel-igcse-biology:mutation",
      status: "published",
      isFreePreview: true,
      examQuestions: [],
    });
    lessonId = lesson._id;
  });

  test("mcq can attach manually", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/exam-questions`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ questionIds: [String(mcqId)] });
    expect(res.status).toBe(200);
    expect(res.body.added).toBe(1);
  });

  test("short can attach manually", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/exam-questions`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ questionIds: [String(shortIds[0])] });
    expect(res.status).toBe(200);
    expect(res.body.added).toBe(1);
  });

  test("composite cannot manually attach", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/exam-questions`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ questionIds: [String(compositeId)] });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.unsupported?.[0]?.type).toBe("composite");
  });

  test("mixed supported + unsupported POST does not partially attach", async () => {
    const lesson = await Lesson.create({
      title: "Mixed attach lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Mutation",
      topicKey: "edexcel-igcse-biology:mutation",
      status: "published",
      isFreePreview: true,
      examQuestions: [],
    });
    const before = await Lesson.findById(lesson._id).lean();
    const res = await request(app)
      .post(`/api/lessons/${lesson._id}/exam-questions`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ questionIds: [String(shortIds[1]), String(compositeId)] });
    expect(res.status).toBe(400);
    const after = await Lesson.findById(lesson._id).lean();
    expect(after.examQuestions).toHaveLength(before.examQuestions.length);
  });

  test("legacy unsupported attachment is excluded from /practice before limit", async () => {
    const refs = shortIds.slice(0, 9).map((id) => ({ questionId: id, addedAt: new Date() }));
    refs.push({ questionId: compositeId, addedAt: new Date() });
    refs.push({ questionId: shortIds[9], addedAt: new Date() });

    const lesson = await Lesson.create({
      title: "Legacy composite slot lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Mutation",
      topicKey: "edexcel-igcse-biology:mutation",
      status: "published",
      isFreePreview: true,
      examQuestions: refs,
    });

    const res = await request(app)
      .get(`/api/lessons/${lesson._id}/practice?limit=10`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(10);
    expect(res.body.questions.some((q) => q.id === String(compositeId))).toBe(false);
    expect(res.body.questions[9].id).toBe(String(shortIds[9]));
  });

  test("attached order remains correct among supported questions", async () => {
    const ordered = [shortIds[2], shortIds[3], shortIds[4]];
    const lesson = await Lesson.create({
      title: "Order lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Mutation",
      topicKey: "edexcel-igcse-biology:mutation",
      status: "published",
      isFreePreview: true,
      examQuestions: ordered.map((id) => ({ questionId: id, addedAt: new Date() })),
    });
    const res = await request(app)
      .get(`/api/lessons/${lesson._id}/practice?limit=10`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.body.questions.map((q) => q.id)).toEqual(ordered.map(String));
  });

  test("attach-by-topic skips unsupported composite questions", async () => {
    const lesson = await Lesson.create({
      title: "Attach by topic integrity",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Mutation",
      topicKey: "edexcel-igcse-biology:mutation",
      status: "published",
      isFreePreview: true,
      examQuestions: [],
    });

    const res = await request(app)
      .post(`/api/lessons/${lesson._id}/exam-questions/attach-by-topic`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.added).toBeGreaterThan(0);
    expect(res.body.addedIds).not.toContain(String(compositeId));

    const updated = await Lesson.findById(lesson._id).lean();
    const attached = (updated.examQuestions || []).map((r) => String(r.questionId));
    expect(attached).not.toContain(String(compositeId));
  });

  test("semanticFingerprintDedup:false keeps attached supported question despite embedded overlap", async () => {
    const embeddedComposite = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "composite",
      question: "Embedded composite about mutations for semantic dedup integrity test.",
      topicKey: "edexcel-igcse-biology:mutation",
      topic: "Mutation",
      status: "published",
      parts: [{ type: "short", questionText: "Part", markScheme: ["Point"] }],
      marks: 1,
    });

    const phenotype = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      question: "Explain how a mutation in DNA can result in a change in phenotype for integrity test.",
      marks: 2,
      markScheme: ["DNA sequence changes.", "Phenotype may change."],
      topicKey: "edexcel-igcse-biology:mutation",
      topic: "Mutation",
      status: "published",
    });

    const lesson = await Lesson.create({
      title: "Semantic dedup integrity",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Mutation",
      topicKey: "edexcel-igcse-biology:mutation",
      status: "published",
      isFreePreview: true,
      pages: [
        {
          pageId: "p1",
          order: 1,
          title: "Page 1",
          blocks: [{ type: "examQuestion", examQuestionId: embeddedComposite._id }],
        },
      ],
      examQuestions: [{ questionId: phenotype._id, addedAt: new Date() }],
    });

    const embeddedDocs = await ExamQuestion.find({ _id: embeddedComposite._id }).lean();
    buildExamQuestionFingerprints(embeddedDocs);

    const res = await request(app)
      .get(`/api/lessons/${lesson._id}/practice?limit=10`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.body.questions.some((q) => q.id === String(phenotype._id))).toBe(true);
  });
});
