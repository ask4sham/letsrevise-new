/**
 * PR-PRACTICE-LOOP-1 Slice 1+3: POST /api/practice-attempts — student only; validation; link; MCQ server-side correctness.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const PracticeAttempt = require("../models/PracticeAttempt");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");

jest.setTimeout(20000);

describe("POST /api/practice-attempts", () => {
  let studentToken;
  let studentId;
  let teacherId;

  beforeAll(async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    const [teacher, student] = await Promise.all([
      User.create({
        email: "practice-attempt-teacher@test.com",
        password: pw,
        firstName: "T",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: "practice-attempt-student@test.com",
        password: pw,
        firstName: "S",
        lastName: "Student",
        userType: "student",
      }),
    ]);
    teacherId = teacher._id;
    studentId = student._id;

    await StudentTeacherLink.create({ studentId, teacherId });

    const login = await request(app).post("/api/auth/login").send({
      email: "practice-attempt-student@test.com",
      password: "Pass123!",
    });
    studentToken = login.body?.token;
    if (!studentToken) throw new Error("Student login failed");
  });

  afterAll(async () => {
    await PracticeAttempt.deleteMany({ studentId });
    await StudentTeacherLink.deleteMany({ studentId });
    await TopicQuizQuestion.deleteMany({ ownerId: teacherId });
  });

  test("non-MCQ (exam_question) self-mark attempt accepted", async () => {
    const contentId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-biology:cell-structure",
        contentType: "exam_question",
        contentId: contentId.toString(),
        isCorrect: true,
        confidence: 2,
        timeSpentSec: 45,
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const doc = await PracticeAttempt.findOne({ studentId, contentId });
    expect(doc).toBeTruthy();
    expect(doc.contentType).toBe("exam_question");
    expect(doc.isCorrect).toBe(true);
  });

  test("MCQ correctness computed server-side: correct choice → isCorrect true", async () => {
    const mcq = await TopicQuizQuestion.create({
      ownerId: teacherId,
      topicKey: "aqa-gcse-biology:cell-structure",
      type: "mcq",
      questionText: "What is a cell?",
      choices: ["A", "B", "C"],
      correctIndex: 1,
      status: "published",
      kind: "quiz",
      fingerprint: "slice3-mcq-correct-1",
    });

    const res = await request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-biology:cell-structure",
        contentType: "quiz_mcq",
        contentId: mcq._id.toString(),
        selectedChoiceIndex: 1,
        confidence: 2,
        timeSpentSec: 30,
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(200);

    const doc = await PracticeAttempt.findOne({ studentId, contentId: mcq._id });
    expect(doc).toBeTruthy();
    expect(doc.isCorrect).toBe(true);
    expect(doc.selectedChoiceIndex).toBe(1);
  });

  test("MCQ correctness computed server-side: wrong choice → isCorrect false", async () => {
    const mcq = await TopicQuizQuestion.create({
      ownerId: teacherId,
      topicKey: "aqa-gcse-biology:cell-structure",
      type: "mcq",
      questionText: "Another MCQ?",
      choices: ["X", "Y", "Z"],
      correctIndex: 0,
      status: "published",
      kind: "quiz",
      fingerprint: "slice3-mcq-wrong-1",
    });

    const res = await request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-biology:cell-structure",
        contentType: "quiz_mcq",
        contentId: mcq._id.toString(),
        selectedChoiceIndex: 2,
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(200);

    const doc = await PracticeAttempt.findOne({ studentId, contentId: mcq._id });
    expect(doc).toBeTruthy();
    expect(doc.isCorrect).toBe(false);
    expect(doc.selectedChoiceIndex).toBe(2);
  });

  test("rejects MCQ when client sends isCorrect", async () => {
    const mcq = await TopicQuizQuestion.create({
      ownerId: teacherId,
      topicKey: "aqa-gcse-biology:cell-structure",
      type: "mcq",
      questionText: "No isCorrect allowed",
      choices: ["A", "B"],
      correctIndex: 0,
      status: "published",
      kind: "quiz",
      fingerprint: "slice3-mcq-no-iscorrect",
    });

    const res = await request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-biology:cell-structure",
        contentType: "quiz_mcq",
        contentId: mcq._id.toString(),
        isCorrect: true,
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Do not send isCorrect|selectedChoiceIndex/i);
  });

  test("without student-teacher link → 403", async () => {
    const otherTeacher = await User.create({
      email: "other-teacher-attempt@test.com",
      password: await bcrypt.hash("Pass123!", 10),
      firstName: "O",
      lastName: "Teacher",
      userType: "teacher",
    });
    const contentId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-biology:cell-structure",
        contentType: "exam_question",
        contentId: contentId.toString(),
        isCorrect: false,
        teacherId: otherTeacher._id.toString(),
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/link|teacher|add you/i);

    await User.deleteOne({ _id: otherTeacher._id });
  });

  test("with student-teacher link → success", async () => {
    const contentId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-biology:cell-structure",
        contentType: "exam_question",
        contentId: contentId.toString(),
        isCorrect: true,
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test("rejects bad specKey", async () => {
    const res = await request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: "unknown_spec",
        topicKey: "unknown_spec:cell-structure",
        contentType: "exam_question",
        contentId: new mongoose.Types.ObjectId().toString(),
        isCorrect: false,
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/spec|Unknown/i);
  });

  test("rejects non-namespaced topicKey", async () => {
    const res = await request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        contentType: "exam_question",
        contentId: new mongoose.Types.ObjectId().toString(),
        isCorrect: true,
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/topicKey|namespaced|start with/i);
  });

  test("rejects topicKey that does not start with specKey", async () => {
    const res = await request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-chemistry:cell-structure",
        contentType: "exam_question",
        contentId: new mongoose.Types.ObjectId().toString(),
        isCorrect: true,
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/topicKey|start with|specKey/i);
  });

  test("rejects invalid contentType", async () => {
    const res = await request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-biology:cell-structure",
        contentType: "invalid_type",
        contentId: new mongoose.Types.ObjectId().toString(),
        isCorrect: true,
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/contentType|quiz_mcq|quiz_short|exam_question|past_paper_question/i);
  });

  test("rejects when not a student (teacher)", async () => {
    const teacherLogin = await request(app).post("/api/auth/login").send({
      email: "practice-attempt-teacher@test.com",
      password: "Pass123!",
    });
    const teacherToken = teacherLogin.body?.token;
    const res = await request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-biology:cell-structure",
        contentType: "exam_question",
        contentId: new mongoose.Types.ObjectId().toString(),
        isCorrect: true,
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/student|only/i);
  });

  test("requires auth", async () => {
    const res = await request(app).post("/api/practice-attempts").send({
      specKey: "aqa-gcse-biology",
      topicKey: "aqa-gcse-biology:cell-structure",
      contentType: "exam_question",
      contentId: new mongoose.Types.ObjectId().toString(),
      isCorrect: true,
      teacherId: teacherId.toString(),
    });
    expect(res.status).toBe(401);
  });
});
