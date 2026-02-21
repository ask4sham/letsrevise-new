/**
 * PR-EDGE-4.2: Quiz attempt create, submit (MCQ scoring), GET with release gating.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const QuizAssignment = require("../models/QuizAssignment");
const QuizAttempt = require("../models/QuizAttempt");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Quiz attempt scoring (PR-EDGE-4.2)", () => {
  let teacherId;
  let studentId;
  let studentToken;
  let teacherToken;
  let assignmentId;
  let shareId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Score",
      lastName: "Teacher",
      email: "score-quiz-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const student = await User.create({
      firstName: "Score",
      lastName: "Student",
      email: "score-quiz-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    studentId = student._id;
    studentToken = (await request(app).post("/api/auth/login").send({ email: "score-quiz-student@test.com", password: "password123" })).body?.token;
    teacherToken = (await request(app).post("/api/auth/login").send({ email: "score-quiz-teacher@test.com", password: "password123" })).body?.token;

    const lesson = await Lesson.create({
      title: "Score Test Lesson",
      description: "Test lesson for quiz scoring",
      content: "# Test",
      teacherId,
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      quiz: {
        timeSeconds: 300,
        questions: [
          { id: "q1", type: "mcq", question: "Q1?", options: ["A", "B", "C"], correctAnswer: "B", marks: 2 },
          { id: "q2", type: "mcq", question: "Q2?", options: ["X", "Y"], correctAnswer: "Y", marks: 1 },
        ],
      },
    });

    const assign = await QuizAssignment.create({
      ownerId: teacherId,
      kind: "quiz",
      title: "Score Test Quiz",
      isActive: true,
      shareId: "scorequiz" + Date.now(),
      lessonId: lesson._id,
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    assignmentId = assign._id;
    shareId = assign.shareId;
  });

  afterAll(async () => {
    await QuizAttempt.deleteMany({});
    await QuizAssignment.deleteMany({});
    await Lesson.deleteMany({ teacherId });
  });

  test("create attempt via share link returns attemptId and attemptToken", async () => {
    const res = await request(app)
      .post(`/api/quiz-assignments/share/${shareId}/attempts`)
      .send({ studentId: studentId.toString(), studentName: "Score Student" });
    expect(res.status).toBe(201);
    expect(res.body.attemptId).toBeDefined();
    expect(res.body.attemptToken).toBeDefined();
  });

  test("submit with correct MCQ answers and get score", async () => {
    const createRes = await request(app)
      .post(`/api/quiz-assignments/share/${shareId}/attempts`)
      .send({ studentId: studentId.toString() });
    const { attemptId, attemptToken } = createRes.body;

    const res = await request(app)
      .post(`/api/quiz-attempts/${attemptId}/submit`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        token: attemptToken,
        answers: [
          { questionId: "q1", selectedIndex: 1 },
          { questionId: "q2", selectedIndex: 1 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.attempt.status).toBe("SUBMITTED");
    expect(res.body.attempt.resultsLocked).toBe(true);
    expect(res.body.attempt.score).toBeNull();
    expect(res.body.attempt.maxScore).toBeNull();
  });

  test("submit stores score (teacher can see raw)", async () => {
    const createRes = await request(app)
      .post(`/api/quiz-assignments/share/${shareId}/attempts`)
      .send({ studentId: studentId.toString() });
    const { attemptId, attemptToken } = createRes.body;

    await request(app)
      .post(`/api/quiz-attempts/${attemptId}/submit`)
      .send({
        token: attemptToken,
        answers: [
          { questionId: "q1", selectedIndex: 1 },
          { questionId: "q2", selectedIndex: 1 },
        ],
      });

    const attempt = await QuizAttempt.findById(attemptId).lean();
    expect(attempt.score).toBe(3);
    expect(attempt.maxScore).toBe(3);
    expect(attempt.status).toBe("SUBMITTED");
  });

  test("student GET before release: score hidden", async () => {
    const createRes = await request(app)
      .post(`/api/quiz-assignments/share/${shareId}/attempts`)
      .send({ studentId: studentId.toString() });
    const { attemptId, attemptToken } = createRes.body;
    await request(app)
      .post(`/api/quiz-attempts/${attemptId}/submit`)
      .send({ token: attemptToken, answers: [{ questionId: "q1", selectedIndex: 0 }, { questionId: "q2", selectedIndex: 0 }] });

    const res = await request(app)
      .get(`/api/quiz-attempts/${attemptId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.attempt.resultsLocked).toBe(true);
    expect(res.body.attempt.score).toBeNull();
    expect(res.body.attempt.maxScore).toBeNull();
  });

  test("student GET after release: score visible", async () => {
    const createRes = await request(app)
      .post(`/api/quiz-assignments/share/${shareId}/attempts`)
      .send({ studentId: studentId.toString() });
    const { attemptId, attemptToken } = createRes.body;
    await request(app)
      .post(`/api/quiz-attempts/${attemptId}/submit`)
      .send({ token: attemptToken, answers: [{ questionId: "q1", selectedIndex: 1 }, { questionId: "q2", selectedIndex: 1 }] });
    await QuizAttempt.updateOne({ _id: attemptId }, { $set: { isReleased: true } });

    const res = await request(app)
      .get(`/api/quiz-attempts/${attemptId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.attempt.resultsLocked).toBeUndefined();
    expect(res.body.attempt.score).toBe(3);
    expect(res.body.attempt.maxScore).toBe(3);
  });

  test("submit without token returns 403 for new attempts", async () => {
    const createRes = await request(app)
      .post(`/api/quiz-assignments/share/${shareId}/attempts`)
      .send({ studentId: studentId.toString() });
    const attemptId = createRes.body.attemptId;
    const res = await request(app)
      .post(`/api/quiz-attempts/${attemptId}/submit`)
      .send({ answers: [{ questionId: "q1", selectedIndex: 1 }] });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/token/i);
  });

  test("submit rejects paper-based assignment", async () => {
    const paperAssign = await QuizAssignment.create({
      ownerId: teacherId,
      kind: "assessment",
      title: "Paper Quiz",
      isActive: true,
      shareId: "scorepaper" + Date.now(),
      paperId: new mongoose.Types.ObjectId(),
    });
    const createRes = await request(app)
      .post(`/api/quiz-assignments/share/${paperAssign.shareId}/attempts`)
      .send({ studentId: studentId.toString() });
    const res = await request(app)
      .post(`/api/quiz-attempts/${createRes.body.attemptId}/submit`)
      .send({ token: createRes.body.attemptToken, answers: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lesson-based|paper/i);
    await QuizAssignment.deleteOne({ _id: paperAssign._id });
  });
});
