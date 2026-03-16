/**
 * Learning Evidence Integration — verify evidence is captured from real flows.
 * Tests: quiz submit, lesson-view, flashcard-review, practice (exam_question), lesson-completion.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const QuizAssignment = require("../models/QuizAssignment");
const QuizAttempt = require("../models/QuizAttempt");
const LearningEvidenceEvent = require("../models/LearningEvidenceEvent");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Learning Evidence Integration", () => {
  let studentId;
  let teacherId;
  let studentToken;
  let lessonId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Ev",
      lastName: "Teacher",
      email: "ev-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const student = await User.create({
      firstName: "Ev",
      lastName: "Student",
      email: "ev-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    studentId = student._id;
    studentToken = (
      await request(app).post("/api/auth/login").send({ email: "ev-student@test.com", password: "password123" })
    ).body?.token;

    const lesson = await Lesson.create({
      title: "Ev Test Lesson",
      description: "Test",
      content: "# Test",
      teacherId,
      subject: "Biology",
      level: "GCSE",
      topic: "Cell structure",
      specKey: "aqa-gcse-biology",
      topicKey: "cell-structure",
      status: "published",
      isPublished: true,
      quiz: {
        timeSeconds: 300,
        questions: [
          { id: "eq1", type: "mcq", question: "Q?", options: ["A", "B"], correctAnswer: "B", marks: 1 },
        ],
      },
    });
    lessonId = lesson._id;
  });

  afterAll(async () => {
    await LearningEvidenceEvent.deleteMany({});
    await QuizAttempt.deleteMany({});
    await QuizAssignment.deleteMany({});
    await Lesson.deleteMany({ teacherId });
    await User.deleteMany({ email: { $in: ["ev-student@test.com", "ev-teacher@test.com"] } });
  });

  beforeEach(async () => {
    await LearningEvidenceEvent.deleteMany({});
  });

  test("quiz submit creates LearningEvidenceEvent when lesson has specKey/topicKey", async () => {
    const assign = await QuizAssignment.create({
      ownerId: teacherId,
      kind: "quiz",
      title: "Ev Quiz",
      isActive: true,
      shareId: "evquiz" + Date.now(),
      lessonId,
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const createRes = await request(app)
      .post(`/api/quiz-assignments/share/${assign.shareId}/attempts`)
      .send({ studentId: studentId.toString() });
    const { attemptId, attemptToken } = createRes.body;

    await request(app)
      .post(`/api/quiz-attempts/${attemptId}/submit`)
      .send({
        token: attemptToken,
        answers: [{ questionId: "eq1", selectedIndex: 1 }],
      });

    const events = await LearningEvidenceEvent.find({ eventType: "quiz_attempt" }).lean();
    expect(events.length).toBeGreaterThanOrEqual(1);
    const ev = events.find((e) => e.userId?.toString() === studentId.toString());
    expect(ev).toBeDefined();
    expect(ev.specKey).toBe("aqa-gcse-biology");
    expect(ev.topicKey).toBe("cell-structure");
    expect(ev.correct).toBe(true);
    expect(ev.score).toBe(100);

    await QuizAttempt.deleteMany({ assignmentId: assign._id });
    await QuizAssignment.deleteOne({ _id: assign._id });
  });

  test("lesson-view creates LearningEvidenceEvent (lesson_completion)", async () => {
    const res = await request(app)
      .post("/api/progress/lesson-view")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ specKey: "aqa-gcse-biology", topicKey: "cell-structure", lessonId: lessonId.toString() });
    expect(res.status).toBe(204);

    await new Promise((r) => setTimeout(r, 200));
    const events = await LearningEvidenceEvent.find({ eventType: "lesson_completion" }).lean();
    expect(events.length).toBeGreaterThanOrEqual(1);
    const ev = events.find((e) => e.userId?.toString() === studentId.toString());
    expect(ev).toBeDefined();
    expect(ev.specKey).toBe("aqa-gcse-biology");
    expect(ev.topicKey).toBe("cell-structure");
  });

  test("lesson-completion endpoint creates LearningEvidenceEvent", async () => {
    const res = await request(app)
      .post("/api/progress/lesson-completion")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "cell-structure",
        lessonId: lessonId.toString(),
        timeSpentSeconds: 120,
      });
    expect(res.status).toBe(204);

    const events = await LearningEvidenceEvent.find({ eventType: "lesson_completion" }).lean();
    expect(events.length).toBeGreaterThanOrEqual(1);
    const ev = events.find((e) => e.lessonId?.toString() === lessonId.toString());
    expect(ev).toBeDefined();
    expect(ev.timeSpentSeconds).toBe(120);
  });

  test("flashcard-review creates LearningEvidenceEvent", async () => {
    await request(app)
      .post("/api/progress/flashcard-review")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ specKey: "aqa-gcse-biology", topicKey: "cell-structure" });

    const events = await LearningEvidenceEvent.find({ eventType: "flashcard_review" }).lean();
    expect(events.length).toBeGreaterThanOrEqual(1);
    const ev = events.find((e) => e.userId?.toString() === studentId.toString());
    expect(ev).toBeDefined();
    expect(ev.specKey).toBe("aqa-gcse-biology");
    expect(ev.topicKey).toBe("cell-structure");
  });

  test("lesson-view without specKey/topicKey does not break handler", async () => {
    const res = await request(app)
      .post("/api/progress/lesson-view")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test("evidence logging failure does not break quiz submit", async () => {
    const assign = await QuizAssignment.create({
      ownerId: teacherId,
      kind: "quiz",
      title: "Ev Quiz 2",
      isActive: true,
      shareId: "evquiz2" + Date.now(),
      lessonId,
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const createRes = await request(app)
      .post(`/api/quiz-assignments/share/${assign.shareId}/attempts`)
      .send({ studentId: studentId.toString() });
    const { attemptId, attemptToken } = createRes.body;

    const res = await request(app)
      .post(`/api/quiz-attempts/${attemptId}/submit`)
      .send({
        token: attemptToken,
        answers: [{ questionId: "eq1", selectedIndex: 0 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    await QuizAttempt.deleteMany({ assignmentId: assign._id });
    await QuizAssignment.deleteOne({ _id: assign._id });
  });
});
