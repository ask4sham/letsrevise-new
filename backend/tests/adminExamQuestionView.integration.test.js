/**
 * Integration: admin read-only Exam Question view by ID.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";

const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const app = require("../app");
const User = require("../models/User");
const ExamQuestion = require("../models/ExamQuestion");
const Lesson = require("../models/Lesson");
const ExamQuestionRationaleCandidate = require("../models/ExamQuestionRationaleCandidate");

const hashedPassword = bcrypt.hashSync("password123", 10);
jest.setTimeout(60000);

async function loginAs(email, userType = "admin", staffRole) {
  await User.deleteMany({ email });
  const doc = {
    email,
    password: hashedPassword,
    firstName: "Admin",
    lastName: "View",
    userType,
    isEmailVerified: true,
  };
  if (staffRole) doc.staffRole = staffRole;
  const user = await User.create(doc);
  const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  expect(res.status).toBe(200);
  return { token: res.body.token || res.body.accessToken || res.body.jwt, user };
}

function getView(token, questionId) {
  return request(app)
    .get(`/api/admin/question-banks/exam-questions/${questionId}`)
    .set("Authorization", `Bearer ${token}`);
}

async function createStandard(teacherId, overrides = {}) {
  return ExamQuestion.create({
    teacherId,
    subject: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    topic: "Cells",
    topicKey: "cells",
    type: "mcq",
    questionMode: "single",
    question: "Which organelle contains DNA?",
    options: ["Mitochondrion", "Nucleus", "Ribosome", "Vacuole"],
    correctIndex: 1,
    markScheme: ["Award 1 mark for Nucleus."],
    marks: 1,
    status: "draft",
    isArchived: false,
    ...overrides,
  });
}

async function createComposite(teacherId, overrides = {}) {
  return ExamQuestion.create({
    teacherId,
    subject: "Biology",
    examBoard: "Edexcel",
    level: "IGCSE",
    topic: "Gametes and fertilisation",
    topicKey: "edexcel-igcse-biology:gametes-and-fertilisation",
    type: "composite",
    questionMode: "composite",
    question: "Composite gametes",
    sharedStem: "Gametes are specialised sex cells.",
    status: "draft",
    isArchived: false,
    parts: [
      {
        label: "a",
        type: "mcq",
        marks: 1,
        questionText: "Which statement about gametes is correct?",
        options: ["A", "B", "C", "D"],
        correctIndex: 2,
        markScheme: ["Award 1 mark for C."],
      },
      {
        label: "b",
        type: "mcq",
        marks: 1,
        questionText: "Where does fertilisation usually occur?",
        options: ["W", "X", "Y", "Z"],
        correctIndex: 0,
        markScheme: ["Award 1 mark for W."],
      },
    ],
    ...overrides,
  });
}

describe("Admin Exam Question view by ID", () => {
  test("A: authorised admin can fetch exact Exam Question by ID", async () => {
    const { token, user } = await loginAs("aqv-admin@test.com", "admin");
    const q = await createStandard(user._id);
    const res = await getView(token, q._id.toString());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(q._id.toString());
    expect(res.body.readOnly).toBe(true);
  });

  test("B: response ID matches requested ID", async () => {
    const { token, user } = await loginAs("aqv-match@test.com", "admin");
    const q = await createStandard(user._id, { question: "Match ID probe" });
    const res = await getView(token, q._id.toString());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(String(q._id));
    expect(res.body.question).toBe("Match ID probe");
  });

  test("C: standard question fields returned correctly", async () => {
    const { token, user } = await loginAs("aqv-std@test.com", "admin");
    const q = await createStandard(user._id);
    const res = await getView(token, q._id.toString());
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe("Biology");
    expect(res.body.examBoard).toBe("AQA");
    expect(res.body.level).toBe("GCSE");
    expect(res.body.topicKey).toBe("cells");
    expect(res.body.status).toBe("draft");
    expect(res.body.type).toBe("mcq");
    expect(res.body.options).toHaveLength(4);
    expect(res.body.options[1].isCorrect).toBe(true);
    expect(res.body.markScheme).toEqual(["Award 1 mark for Nucleus."]);
    expect(res.body.marks).toBe(1);
  });

  test("D: Composite shared stem and ordered parts", async () => {
    const { token, user } = await loginAs("aqv-comp@test.com", "admin");
    const q = await createComposite(user._id);
    const res = await getView(token, q._id.toString());
    expect(res.status).toBe(200);
    expect(res.body.sharedStem).toMatch(/Gametes are specialised/);
    expect(res.body.parts).toHaveLength(2);
    expect(res.body.parts.map((p) => p.label)).toEqual(["a", "b"]);
    expect(res.body.parts[0].questionText).toMatch(/gametes is correct/);
    expect(res.body.parts[1].options[0].isCorrect).toBe(true);
  });

  test("E: record outside first 50 list results still retrievable by ID", async () => {
    const { token, user } = await loginAs("aqv-page@test.com", "admin");
    const created = [];
    for (let i = 0; i < 52; i += 1) {
      created.push(
        await createStandard(user._id, {
          question: `Paged question ${i}`,
          topicKey: `paged-topic-${i}`,
        })
      );
    }
    const target = created[0];
    const list = await request(app)
      .get("/api/admin/question-banks/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .query({ limit: 50, offset: 0 });
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(50);
    const idsOnFirstPage = new Set(list.body.items.map((r) => String(r.id)));
    expect(idsOnFirstPage.has(String(target._id))).toBe(false);

    const res = await getView(token, target._id.toString());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(String(target._id));
    expect(res.body.question).toBe("Paged question 0");
  });

  test("F: malformed ID rejected", async () => {
    const { token } = await loginAs("aqv-badid@test.com", "admin");
    const res = await getView(token, "not-an-object-id");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_QUESTION_ID");
  });

  test("G: missing valid ID returns not found", async () => {
    const { token } = await loginAs("aqv-missing@test.com", "admin");
    const missing = new mongoose.Types.ObjectId();
    const res = await getView(token, missing.toString());
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("QUESTION_NOT_FOUND");
  });

  test("H: anonymous request rejected", async () => {
    const res = await request(app).get(
      `/api/admin/question-banks/exam-questions/${new mongoose.Types.ObjectId()}`
    );
    expect([401, 403]).toContain(res.status);
  });

  test("I: non-authorised role rejected", async () => {
    const { token, user } = await loginAs("aqv-teacher@test.com", "teacher");
    const q = await createStandard(user._id);
    const res = await getView(token, q._id.toString());
    expect(res.status).toBe(403);
  });

  test("content_manager can fetch", async () => {
    const { token, user } = await loginAs("aqv-cm@test.com", "teacher", "content_manager");
    const q = await createStandard(user._id);
    const res = await getView(token, q._id.toString());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(String(q._id));
  });

  test("J: privacy — no email, password, tokens, signed URLs, media URLs", async () => {
    const { token, user } = await loginAs("aqv-privacy@test.com", "admin");
    const q = await createComposite(user._id, {
      imageUrl: "https://private.example/secret-token-xyz.png",
      assets: [
        {
          type: "image",
          url: "https://private.example/asset.png?token=abc",
          mediaId: new mongoose.Types.ObjectId(),
          alt: "Diagram of fertilisation",
        },
      ],
    });
    const res = await getView(token, q._id.toString());
    expect(res.status).toBe(200);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toMatch(/aqv-privacy@test\.com/i);
    expect(serialized).not.toMatch(/password|accessToken|Bearer |signed/i);
    expect(serialized).not.toMatch(/private\.example|secret-token|token=abc/i);
    expect(serialized).not.toMatch(/mediaId/i);
    expect(res.body.mediaSummary.questionImagePresent).toBe(true);
    expect(res.body.mediaSummary.assetCount).toBe(1);
    expect(res.body.mediaSummary.assets[0]).toEqual({
      type: "image",
      referencePresent: true,
      hasAlt: true,
    });
    expect(res.body.ownerName).toBe("Admin View");
  });

  test("K: repeated GET leaves ExamQuestion, Candidate, Lesson unchanged", async () => {
    const { token, user } = await loginAs("aqv-nomut@test.com", "admin");
    const q = await createComposite(user._id);
    const lesson = await Lesson.create({
      title: "AQV mutation guard",
      description: "Mutation guard",
      content: "Content",
      teacherId: user._id,
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "draft",
      pages: [],
    });
    const fp = "a".repeat(64);
    const cand = await ExamQuestionRationaleCandidate.create({
      questionId: q._id,
      partLabel: "a",
      sourceFingerprint: fp,
      sourceUpdatedAt: q.updatedAt,
      sourceSnapshot: { subject: "Biology" },
      status: "pending",
      active: true,
      attemptNumber: 1,
      explanation: "Existing candidate",
      generatedBy: user._id,
      idempotencyKey: `aqv-nomut-${q._id}`,
      generationGroupKey: `${q._id}:a:${fp}`,
    });

    const beforeQ = JSON.stringify(await ExamQuestion.findById(q._id).lean());
    const beforeC = JSON.stringify(await ExamQuestionRationaleCandidate.findById(cand._id).lean());
    const beforeL = JSON.stringify(await Lesson.findById(lesson._id).lean());

    const r1 = await getView(token, q._id.toString());
    const r2 = await getView(token, q._id.toString());
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const afterQ = JSON.stringify(await ExamQuestion.findById(q._id).lean());
    const afterC = JSON.stringify(await ExamQuestionRationaleCandidate.findById(cand._id).lean());
    const afterL = JSON.stringify(await Lesson.findById(lesson._id).lean());
    expect(afterQ).toBe(beforeQ);
    expect(afterC).toBe(beforeC);
    expect(afterL).toBe(beforeL);
  });
});
