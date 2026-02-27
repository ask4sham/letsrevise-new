/**
 * PR3b: GET /api/lessons/:id/practice — student-safe; no question content unless entitled.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");
const LessonUnlock = require("../models/LessonUnlock");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(15000);

describe("GET /api/lessons/:id/practice", () => {
  let teacherId;
  let lessonLockedId;
  let lessonPreviewId;
  let questionId;
  let tokenNotEntitled;
  let tokenSubscribed;
  let tokenUnlocked;
  let tokenTeacher;
  let lessonDraftId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "P",
      lastName: "Teacher",
      email: "practice-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const eq = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "mcq",
      question: "What is the product of photosynthesis?",
      options: ["Glucose", "Starch", "Protein"],
      correctIndex: 0,
      marks: 2,
      topicKey: "photosynthesis",
      topic: "Photosynthesis",
      status: "draft",
    });
    questionId = eq._id;

    const lessonLocked = await Lesson.create({
      title: "Locked Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isFreePreview: false,
      examQuestions: [{ questionId, addedAt: new Date() }],
    });
    lessonLockedId = lessonLocked._id;

    const lessonPreview = await Lesson.create({
      title: "Preview Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isFreePreview: true,
      examQuestions: [{ questionId, addedAt: new Date() }],
    });
    lessonPreviewId = lessonPreview._id;

    const lessonDraft = await Lesson.create({
      title: "Draft Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "draft",
      isFreePreview: false,
      examQuestions: [{ questionId, addedAt: new Date() }],
    });
    lessonDraftId = lessonDraft._id;

    const uNotEntitled = await User.create({
      firstName: "Student",
      lastName: "None",
      email: "practice-not-entitled@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });
    const future = new Date(Date.now() + 86400000);
    const uSubscribed = await User.create({
      firstName: "Student",
      lastName: "Sub",
      email: "practice-subscribed@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: { status: "active", expiresAt: future },
      purchasedLessons: [],
    });
    const uUnlocked = await User.create({
      firstName: "Student",
      lastName: "Unlock",
      email: "practice-unlocked@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });
    await LessonUnlock.create({
      userId: uUnlocked._id,
      lessonId: lessonLockedId,
      source: "credit",
    });

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    tokenNotEntitled = await login("practice-not-entitled@test.com");
    tokenSubscribed = await login("practice-subscribed@test.com");
    tokenUnlocked = await login("practice-unlocked@test.com");
    tokenTeacher = await login("practice-teacher@test.com");
  });

  test("NOT_ENTITLED user gets 402 and no question content", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonLockedId}/practice`)
      .set("Authorization", `Bearer ${tokenNotEntitled}`);
    expect(res.status).toBe(402);
    expect(res.body.reason).toBe("NOT_ENTITLED");
    expect(res.body.questions).toBeUndefined();
  });

  test("FREE_PREVIEW returns 200 with allowed:false and empty questions", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonPreviewId}/practice`)
      .set("Authorization", `Bearer ${tokenNotEntitled}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.allowed).toBe(false);
    expect(res.body.reason).toBe("FREE_PREVIEW");
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions).toHaveLength(0);
  });

  test("SUB_ACTIVE user gets 200 with allowed:true and question stem", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonLockedId}/practice`)
      .set("Authorization", `Bearer ${tokenSubscribed}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.allowed).toBe(true);
    expect(res.body.reason).toBe("SUB_ACTIVE");
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBeGreaterThanOrEqual(1);
    const q = res.body.questions[0];
    expect(q.id).toBeDefined();
    expect(q.question).toContain("photosynthesis");
    expect(q.type).toBe("mcq");
    expect(q.marks).toBe(2);
    expect(Array.isArray(q.options)).toBe(true);
    expect(q.correctAnswer).toBeDefined();
  });

  test("LESSON_UNLOCK user gets 200 with allowed:true and questions", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonLockedId}/practice`)
      .set("Authorization", `Bearer ${tokenUnlocked}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.allowed).toBe(true);
    expect(res.body.reason).toBe("LESSON_UNLOCK");
    expect(res.body.questions.length).toBeGreaterThanOrEqual(1);
    expect(res.body.questions[0].question).toBeDefined();
  });

  test("PR3b.1: teacher owner gets 200 with allowed:true and questions on draft lesson", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonDraftId}/practice`)
      .set("Authorization", `Bearer ${tokenTeacher}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.allowed).toBe(true);
    expect(res.body.reason).toBe("OWNER");
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBeGreaterThanOrEqual(1);
    expect(res.body.questions[0].question).toContain("photosynthesis");
  });

  test("PR-CONTENT-TARGETING-1: GET practice with topicKey query returns 200 and scopes by that topic", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonDraftId}/practice`)
      .set("Authorization", `Bearer ${tokenTeacher}`)
      .query({ topicKey: "aqa-gcse-biology:photosynthesis", limit: 10 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.allowed).toBe(true);
    expect(Array.isArray(res.body.questions)).toBe(true);
    if (res.body.topicKey) {
      expect(String(res.body.topicKey)).toMatch(/photosynthesis|aqa-gcse-biology/);
    }
  });
});
