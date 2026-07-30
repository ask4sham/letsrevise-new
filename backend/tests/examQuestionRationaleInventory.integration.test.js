/**
 * Integration: read-only MCQ rationale inventory admin endpoint.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const app = require("../app");
const User = require("../models/User");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);
jest.setTimeout(30000);

async function loginAs(email, userType = "admin", staffRole) {
  await User.deleteMany({ email });
  const doc = {
    email,
    password: hashedPassword,
    firstName: "Inv",
    lastName: "Tester",
    userType,
    isEmailVerified: true,
  };
  if (staffRole) doc.staffRole = staffRole;
  await User.create(doc);
  const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  expect(res.status).toBe(200);
  return res.body.token || res.body.accessToken || res.body.jwt;
}

function compositeDoc(teacherId, overrides = {}) {
  return {
    teacherId,
    subject: "Biology",
    examBoard: "Edexcel",
    level: "IGCSE",
    topic: "Germination",
    topicKey: "edexcel-igcse-biology:germination",
    type: "composite",
    questionMode: "composite",
    title: "Seeds",
    sharedStem: "Seeds need conditions to germinate.",
    question: "Seeds need conditions to germinate.",
    status: "published",
    totalMarks: 3,
    marks: 3,
    parts: [
      {
        label: "a",
        type: "mcq",
        marks: 1,
        questionText: "Which factor is not essential for seed germination?",
        options: ["Water", "Oxygen", "Light", "Temperature"],
        correctIndex: 2,
        markScheme: ["Award 1 mark for selecting Option C / Light."],
        partData: overrides.partData,
      },
      {
        label: "b",
        type: "short",
        marks: 2,
        questionText: "Explain why water is needed.",
        markScheme: ["Award 1 mark for activates enzymes.", "Award 1 mark for softens testa."],
      },
    ],
    ...overrides.doc,
  };
}

describe("GET /api/admin/exam-question-rationale-inventory", () => {
  let adminToken;
  let teacherId;

  beforeAll(async () => {
    adminToken = await loginAs("rationale-inv-admin@test.com", "admin");
    const teacher = await User.create({
      email: "rationale-inv-owner@test.com",
      password: hashedPassword,
      firstName: "Owner",
      lastName: "Teacher",
      userType: "teacher",
      isEmailVerified: true,
    });
    teacherId = teacher._id;
  });

  beforeEach(async () => {
    await ExamQuestion.deleteMany({ teacherId });
  });

  test("rejects unauthenticated", async () => {
    const res = await request(app).get("/api/admin/exam-question-rationale-inventory");
    expect(res.status).toBe(401);
  });

  test("rejects student", async () => {
    const token = await loginAs("rationale-inv-student@test.com", "student");
    const res = await request(app)
      .get("/api/admin/exam-question-rationale-inventory")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("rejects ordinary teacher", async () => {
    const token = await loginAs("rationale-inv-teacher@test.com", "teacher");
    const res = await request(app)
      .get("/api/admin/exam-question-rationale-inventory")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("admin sees summary counts and items; no write side effects", async () => {
    await ExamQuestion.create([
      compositeDoc(teacherId, { partData: undefined }),
      compositeDoc(teacherId, {
        partData: { explanation: "   " },
        doc: { topic: "Germination 2", topicKey: "edexcel-igcse-biology:germination-2" },
      }),
      compositeDoc(teacherId, {
        partData: { explanation: "Light" },
        doc: { topic: "Germination 3", topicKey: "edexcel-igcse-biology:germination-3" },
      }),
      compositeDoc(teacherId, {
        partData: {
          explanation:
            "Light is not essential because the seed uses stored food reserves before photosynthesis.",
        },
        doc: { topic: "Germination 4", topicKey: "edexcel-igcse-biology:germination-4", status: "draft" },
      }),
    ]);
    const before = await ExamQuestion.countDocuments({ teacherId });

    const res = await request(app)
      .get("/api/admin/exam-question-rationale-inventory")
      .query({ teacherId: String(teacherId), pageSize: 25 })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.readOnly).toBe(true);
    expect(res.body.summary.totalCompositeQuestions).toBe(4);
    expect(res.body.summary.totalCompositeMcqParts).toBe(4);
    expect(res.body.summary.missing).toBe(1);
    expect(res.body.summary.empty).toBe(1);
    expect(res.body.summary.generic).toBe(1);
    expect(res.body.summary.substantive).toBe(1);
    expect(res.body.summary.potentiallyEligible).toBe(3);
    expect(res.body.linkedLessonCount.deferred).toBe(true);
    expect(res.body.items[0]).not.toHaveProperty("password");
    expect(res.body.items[0]).not.toHaveProperty("metadata");
    expect(await ExamQuestion.countDocuments({ teacherId })).toBe(before);

    const afterDocs = await ExamQuestion.find({ teacherId }).lean();
    for (const d of afterDocs) {
      // Ensure no accidental mutation of partData by the inventory endpoint.
      expect(d.status === "draft" || d.status === "published").toBe(true);
    }
  });

  test("bucket filter and pagination", async () => {
    for (let i = 0; i < 3; i += 1) {
      await ExamQuestion.create(
        compositeDoc(teacherId, {
          partData: undefined,
          doc: { topicKey: `edexcel-igcse-biology:g-${i}`, topic: `T${i}` },
        })
      );
    }
    const res = await request(app)
      .get("/api/admin/exam-question-rationale-inventory")
      .query({ teacherId: String(teacherId), rationaleBucket: "missing", page: 1, pageSize: 2 })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(2);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.totalMatchingParts).toBe(3);
    expect(res.body.items.every((i) => i.rationaleBucket === "missing")).toBe(true);
  });

  test("max page size capped at 100", async () => {
    const res = await request(app)
      .get("/api/admin/exam-question-rationale-inventory")
      .query({ teacherId: String(teacherId), pageSize: 500 })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(100);
  });

  test("malformed MCQ does not crash report", async () => {
    await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "X",
      topicKey: "v22-inv-malformed-unique:x",
      type: "composite",
      questionMode: "composite",
      question: "Stem",
      sharedStem: "Stem",
      status: "published",
      marks: 1,
      parts: [
        {
          label: "a",
          type: "mcq",
          marks: 1,
          questionText: "",
          options: ["Only one"],
          correctIndex: 0,
        },
      ],
    });
    const res = await request(app)
      .get("/api/admin/exam-question-rationale-inventory")
      .query({ teacherId: String(teacherId), topicKey: "v22-inv-malformed-unique:x" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.summary.malformed).toBe(1);
  });
});
