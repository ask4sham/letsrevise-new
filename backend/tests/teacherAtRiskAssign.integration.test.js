/**
 * PR-EDGE-5.2: POST /api/teacher/at-risk/assign — one-click remedial assignment from topicKey
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const QuizAssignment = require("../models/QuizAssignment");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("POST /api/teacher/at-risk/assign", () => {
  let teacherId;
  let teacherToken;
  let studentId;
  let studentToken;
  const topicKey = "cell-structure";

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Assign",
      lastName: "Teacher",
      email: "assign-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const student = await User.create({
      firstName: "Assign",
      lastName: "Student",
      email: "assign-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    studentId = student._id;

    const loginTeacher = await request(app)
      .post("/api/auth/login")
      .send({ email: "assign-teacher@test.com", password: "password123" });
    teacherToken = loginTeacher.body?.token || loginTeacher.body?.data?.token;

    const loginStudent = await request(app)
      .post("/api/auth/login")
      .send({ email: "assign-student@test.com", password: "password123" });
    studentToken = loginStudent.body?.token || loginStudent.body?.data?.token;

    if (!teacherToken || !studentToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await User.deleteMany({ email: /assign-.*@test\.com/ });
    await TopicQuizQuestion.deleteMany({ ownerId: teacherId, topicKey });
  });

  describe("teacher can create remedial quiz assignment", () => {
    let quizQids = [];

    beforeAll(async () => {
      const bulkRes = await request(app)
        .post("/api/topic-quiz-questions/bulk")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          topicKey,
          items: [
            { questionText: "Remedial Q1?", choices: ["A", "B", "C"], correctIndex: 0 },
            { questionText: "Remedial Q2?", choices: ["X", "Y"], correctIndex: 1 },
          ],
        });
      expect(bulkRes.status).toBe(200);
      quizQids = bulkRes.body.createdIds || [];
      for (const id of quizQids) {
        await request(app)
          .post(`/api/topic-quiz-questions/${id}/publish`)
          .set("Authorization", `Bearer ${teacherToken}`);
      }
    }, 15000);

    afterAll(async () => {
      if (quizQids.length) {
        await TopicQuizQuestion.deleteMany({ _id: { $in: quizQids } });
      }
    });

    it("returns 200 with shareUrl and creates assignment", async () => {
      const res = await request(app)
        .post("/api/teacher/at-risk/assign")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({ topicKey, kind: "quiz" })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.topicKey).toBe(topicKey);
      expect(res.body.kind).toBe("quiz");
      expect(res.body.lessonId).toBeDefined();
      expect(res.body.assignmentId).toBeDefined();
      expect(res.body.shareId).toBeDefined();
      expect(res.body.shareUrl).toMatch(/^\/q\/[a-zA-Z0-9_-]+/);
      expect(res.body.generated).toBeDefined();
      expect(res.body.generated.addedCount).toBeGreaterThanOrEqual(1);
      expect(res.body.generated.questionsCount).toBeGreaterThanOrEqual(1);

      const assignment = await QuizAssignment.findById(res.body.assignmentId).lean();
      expect(assignment).toBeDefined();
      expect(assignment.kind).toBe("quiz");
      expect(assignment.ownerId.toString()).toBe(teacherId.toString());

      const lesson = await Lesson.findById(res.body.lessonId).lean();
      expect(lesson).toBeDefined();
      expect(lesson.quiz).toBeDefined();
      expect(Array.isArray(lesson.quiz.questions)).toBe(true);
      expect(lesson.quiz.questions.length).toBeGreaterThanOrEqual(1);

      await QuizAssignment.findByIdAndDelete(res.body.assignmentId);
      await Lesson.findByIdAndDelete(res.body.lessonId);
    });
  });

  describe("teacher can create remedial assessment assignment", () => {
    let assessQids = [];

    beforeAll(async () => {
      const bulkRes = await request(app)
        .post("/api/topic-quiz-questions/bulk")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          topicKey,
          kind: "assessment",
          items: [
            { questionText: "Remedial A1?", choices: ["P", "Q"], correctIndex: 0 },
            { questionText: "Remedial A2?", choices: ["M", "N"], correctIndex: 1 },
          ],
        });
      expect(bulkRes.status).toBe(200);
      assessQids = bulkRes.body.createdIds || [];
      for (const id of assessQids) {
        await request(app)
          .post(`/api/topic-quiz-questions/${id}/publish`)
          .set("Authorization", `Bearer ${teacherToken}`);
      }
    }, 15000);

    afterAll(async () => {
      if (assessQids.length) {
        await TopicQuizQuestion.deleteMany({ _id: { $in: assessQids } });
      }
    });

    it("returns 200 and creates assessment assignment", async () => {
      const res = await request(app)
        .post("/api/teacher/at-risk/assign")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({ topicKey, kind: "assessment" })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.kind).toBe("assessment");
      expect(res.body.shareUrl).toMatch(/^\/q\/[a-zA-Z0-9_-]+/);

      const assignment = await QuizAssignment.findById(res.body.assignmentId).lean();
      expect(assignment).toBeDefined();
      expect(assignment.kind).toBe("assessment");

      await QuizAssignment.findByIdAndDelete(res.body.assignmentId);
      await Lesson.findByIdAndDelete(res.body.lessonId);
    });
  });

  describe("no published questions", () => {
    it("returns 400 when no published questions in bank for topic", async () => {
      const emptyTopic = "rp-microscopy";
      const res = await request(app)
        .post("/api/teacher/at-risk/assign")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({ topicKey: emptyTopic, kind: "quiz" })
        .expect(400);

      expect(res.body.error).toMatch(/No published .* questions|Publish some questions/i);
    });
  });

  describe("permissions", () => {
    it("student gets 403", async () => {
      await request(app)
        .post("/api/teacher/at-risk/assign")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ topicKey, kind: "quiz" })
        .expect(403);
    });
  });
});
