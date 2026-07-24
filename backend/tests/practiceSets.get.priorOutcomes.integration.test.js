/**
 * GET /api/practice-sets/:id — hydrate prior attempts by contentType+contentId
 * (legacy practiceSetId: null must still match).
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const PracticeSet = require("../models/PracticeSet");
const PracticeAttempt = require("../models/PracticeAttempt");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const StudentTeacherLink = require("../models/StudentTeacherLink");

jest.setTimeout(30000);

const SPEC = "aqa-gcse-biology";
const TOPIC = "aqa-gcse-biology:cell-structure";

describe("GET /api/practice-sets/:id priorOutcomes hydration", () => {
  let studentToken;
  let studentId;
  let teacherId;
  let otherStudentToken;
  let otherStudentId;
  const mcqIds = [];

  beforeAll(async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    const [teacher, student, other] = await Promise.all([
      User.create({
        email: `get-prior-teacher-${Date.now()}@test.com`,
        password: pw,
        firstName: "T",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: `get-prior-student-${Date.now()}@test.com`,
        password: pw,
        firstName: "S",
        lastName: "Student",
        userType: "student",
      }),
      User.create({
        email: `get-prior-other-${Date.now()}@test.com`,
        password: pw,
        firstName: "O",
        lastName: "Student",
        userType: "student",
      }),
    ]);
    teacherId = teacher._id;
    studentId = student._id;
    otherStudentId = other._id;
    await StudentTeacherLink.create({ studentId, teacherId });

    for (let i = 0; i < 5; i++) {
      const q = await TopicQuizQuestion.create({
        ownerId: teacherId,
        topicKey: TOPIC,
        type: "mcq",
        questionText: `Hydration Q${i + 1}`,
        choices: ["A", "B", "C", "D"],
        correctIndex: 0,
        status: "published",
        kind: "quiz",
        fingerprint: `get-prior-mcq-${Date.now()}-${i}`,
      });
      mcqIds.push(q._id);
    }

    const login = await request(app).post("/api/auth/login").send({
      email: student.email,
      password: "Pass123!",
    });
    studentToken = login.body?.token;
    const otherLogin = await request(app).post("/api/auth/login").send({
      email: other.email,
      password: "Pass123!",
    });
    otherStudentToken = otherLogin.body?.token;
  });

  afterAll(async () => {
    await PracticeAttempt.deleteMany({
      $or: [{ studentId }, { userId: studentId }, { studentId: otherStudentId }, { userId: otherStudentId }],
    });
    await PracticeSet.deleteMany({ studentId });
    await TopicQuizQuestion.deleteMany({ _id: { $in: mcqIds } });
    await StudentTeacherLink.deleteMany({ studentId });
    await User.deleteMany({ _id: { $in: [studentId, teacherId, otherStudentId] } });
  });

  test("legacy attempts with practiceSetId null hydrate by contentType+contentId", async () => {
    const set = await PracticeSet.create({
      studentId,
      teacherId,
      specKey: SPEC,
      topicKeys: [TOPIC],
      source: "fresh-practice",
      items: mcqIds.map((id) => ({
        contentType: "quiz_mcq",
        contentId: id,
        topicKey: TOPIC,
      })),
    });

    for (let i = 0; i < 5; i++) {
      await PracticeAttempt.create({
        studentId,
        teacherId,
        specKey: SPEC,
        topicKey: TOPIC,
        contentType: "quiz_mcq",
        contentId: mcqIds[i],
        isCorrect: i !== 2,
        // intentionally omit practiceSetId (legacy)
      });
    }

    const res = await request(app)
      .get(`/api/practice-sets/${set._id}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.priorOutcomes).toHaveLength(5);
    expect(res.body.allItemsAttempted).toBe(true);
    expect(res.body.resumeStartIndex).toBe(5);
    expect(res.body.attemptedCount).toBe(5);
    expect(res.body.priorOutcomes.every((p) => p.attempted === true)).toBe(true);
    expect(res.body.priorOutcomes.filter((p) => p.isCorrect === true)).toHaveLength(4);
    expect(res.body.priorOutcomes.find((p) => String(p.contentId) === String(mcqIds[2])).isCorrect).toBe(
      false
    );
    // Student-safe: no answers / explanations
    const blob = JSON.stringify(res.body);
    expect(blob).not.toMatch(/correctChoiceIndex|correctIndex|explanation/i);

    await PracticeSet.deleteOne({ _id: set._id });
    await PracticeAttempt.deleteMany({ studentId, contentId: { $in: mcqIds } });
  });

  test("userId historical identity and outcome correct/wrong hydrate safely", async () => {
    const set = await PracticeSet.create({
      studentId,
      teacherId,
      specKey: SPEC,
      topicKeys: [TOPIC],
      source: "fresh-practice",
      items: mcqIds.slice(0, 2).map((id) => ({
        contentType: "quiz_mcq",
        contentId: id,
        topicKey: TOPIC,
      })),
    });

    // Legacy userId identity + outcome (no isCorrect) — still matches contentType+contentId.
    await PracticeAttempt.collection.insertOne({
      userId: studentId,
      teacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: mcqIds[0],
      outcome: "correct",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await PracticeAttempt.collection.insertOne({
      userId: studentId,
      teacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: mcqIds[1],
      outcome: "wrong",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .get(`/api/practice-sets/${set._id}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.priorOutcomes).toHaveLength(2);
    expect(res.body.priorOutcomes.find((p) => String(p.contentId) === String(mcqIds[0])).isCorrect).toBe(
      true
    );
    expect(res.body.priorOutcomes.find((p) => String(p.contentId) === String(mcqIds[1])).isCorrect).toBe(
      false
    );

    await PracticeSet.deleteOne({ _id: set._id });
    await PracticeAttempt.deleteMany({
      $or: [{ studentId }, { userId: studentId }],
      contentId: { $in: mcqIds.slice(0, 2) },
    });
  });

  test("another student ignored; wrong contentType ignored; duplicates use newest; partial unknown", async () => {
    const set = await PracticeSet.create({
      studentId,
      teacherId,
      specKey: SPEC,
      topicKeys: [TOPIC],
      source: "fresh-practice",
      items: [
        { contentType: "quiz_mcq", contentId: mcqIds[0], topicKey: TOPIC },
        { contentType: "quiz_mcq", contentId: mcqIds[1], topicKey: TOPIC },
      ],
    });

    await PracticeAttempt.create({
      studentId: otherStudentId,
      teacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: mcqIds[0],
      isCorrect: true,
    });
    await PracticeAttempt.create({
      studentId,
      teacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "exam_question",
      contentId: mcqIds[0],
      isCorrect: true,
    });
    await PracticeAttempt.collection.insertOne({
      studentId,
      teacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: mcqIds[0],
      isCorrect: false,
      createdAt: new Date("2020-01-01"),
      updatedAt: new Date("2020-01-01"),
    });
    await PracticeAttempt.collection.insertOne({
      studentId,
      teacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: mcqIds[0],
      isCorrect: true,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });
    await PracticeAttempt.collection.insertOne({
      studentId,
      teacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: mcqIds[1],
      outcome: "partial",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .get(`/api/practice-sets/${set._id}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.priorOutcomes).toHaveLength(2);
    const first = res.body.priorOutcomes.find((p) => String(p.contentId) === String(mcqIds[0]));
    expect(first.isCorrect).toBe(true);
    const second = res.body.priorOutcomes.find((p) => String(p.contentId) === String(mcqIds[1]));
    expect(second.attempted).toBe(true);
    expect(second.isCorrect).toBeUndefined();

    const forbidden = await request(app)
      .get(`/api/practice-sets/${set._id}`)
      .set("Authorization", `Bearer ${otherStudentToken}`);
    expect(forbidden.status).toBe(403);

    await PracticeSet.deleteOne({ _id: set._id });
    await PracticeAttempt.deleteMany({
      contentId: { $in: [mcqIds[0], mcqIds[1]] },
    });
  });
});
