/**
 * Lesson-scoped Fresh Practice: LessonUnlock students without StudentTeacherLink.
 * Server resolves Lesson.teacherId after canAccessContent; client teacherId ignored.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const LessonUnlock = require("../models/LessonUnlock");
const PracticeSet = require("../models/PracticeSet");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");

jest.setTimeout(25000);

const SPEC = "aqa-gcse-biology";
const TOPIC = "aqa-gcse-biology:cell-structure";

describe("practice-sets lesson-scoped fresh practice", () => {
  let ownerTeacherId;
  let otherTeacherId;
  let unlockStudentId;
  let unlockStudentToken;
  let lessonId;
  let otherLessonId;

  beforeAll(async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    const [owner, other, unlockStudent] = await Promise.all([
      User.create({
        email: "lesson-fresh-owner@test.com",
        password: pw,
        firstName: "O",
        lastName: "Owner",
        userType: "teacher",
      }),
      User.create({
        email: "lesson-fresh-other@test.com",
        password: pw,
        firstName: "X",
        lastName: "Other",
        userType: "teacher",
      }),
      User.create({
        email: "lesson-fresh-unlock@test.com",
        password: pw,
        firstName: "U",
        lastName: "Unlock",
        userType: "student",
      }),
    ]);
    ownerTeacherId = owner._id;
    otherTeacherId = other._id;
    unlockStudentId = unlockStudent._id;

    const lesson = await Lesson.create({
      title: "Unlock Fresh Lesson",
      description: "D",
      content: "C",
      teacherId: ownerTeacherId,
      teacherName: "Owner",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      specKey: SPEC,
      topicKey: TOPIC,
    });
    lessonId = lesson._id;

    const otherLesson = await Lesson.create({
      title: "Other Teacher Lesson",
      description: "D",
      content: "C",
      teacherId: otherTeacherId,
      teacherName: "Other",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      specKey: SPEC,
      topicKey: TOPIC,
    });
    otherLessonId = otherLesson._id;

    await LessonUnlock.create({
      userId: unlockStudentId,
      lessonId,
      source: "admin",
    });

    // Ensure NO StudentTeacherLink for unlock student
    await StudentTeacherLink.deleteMany({ studentId: unlockStudentId });

    for (let i = 0; i < 3; i++) {
      await TopicQuizQuestion.create({
        ownerId: ownerTeacherId,
        topicKey: TOPIC,
        type: "mcq",
        questionText: `Lesson unlock fresh stem ${i} unique fingerprint text here`,
        choices: ["A", "B", "C"],
        correctIndex: 0,
        status: "published",
        kind: "quiz",
        fingerprint: `lesson-unlock-fresh-${i}-${Date.now()}`,
      });
    }

    await TopicQuizQuestion.create({
      ownerId: otherTeacherId,
      topicKey: TOPIC,
      type: "mcq",
      questionText: "Other teacher bank question must not leak via forged lessonId",
      choices: ["A", "B", "C"],
      correctIndex: 0,
      status: "published",
      kind: "quiz",
      fingerprint: `other-teacher-fresh-${Date.now()}`,
    });

    const { ensurePracticeSetIdempotencyIndex } = require("../services/practiceSetIdempotencyIndex");
    await ensurePracticeSetIdempotencyIndex(PracticeSet);

    const login = await request(app).post("/api/auth/login").send({
      email: "lesson-fresh-unlock@test.com",
      password: "Pass123!",
    });
    unlockStudentToken = login.body?.token;
    if (!unlockStudentToken) throw new Error("Unlock student login failed");
  });

  afterAll(async () => {
    await PracticeSet.deleteMany({ studentId: unlockStudentId });
    await TopicQuizQuestion.deleteMany({
      ownerId: { $in: [ownerTeacherId, otherTeacherId] },
      topicKey: TOPIC,
    });
    await LessonUnlock.deleteMany({ userId: unlockStudentId });
    await Lesson.deleteMany({ _id: { $in: [lessonId, otherLessonId] } });
    await User.deleteMany({
      email: {
        $in: [
          "lesson-fresh-owner@test.com",
          "lesson-fresh-other@test.com",
          "lesson-fresh-unlock@test.com",
        ],
      },
    });
  });

  test("LessonUnlock student without teacher link gets fresh-availability via lessonId", async () => {
    const avail = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${lessonId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);

    expect(avail.status).toBe(200);
    expect(avail.body.availableFreshCount).toBeGreaterThan(0);
    expect(avail.body.selectedCount).toBe(avail.body.availableFreshCount);
  });

  test("client-supplied wrong teacherId cannot override lesson owner", async () => {
    const avail = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${lessonId}&teacherId=${otherTeacherId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);

    expect(avail.status).toBe(200);
    // Owner bank has 3; other teacher has 1 — must use owner (not inflate to other bank alone)
    expect(avail.body.availableFreshCount).toBeGreaterThanOrEqual(3);

    const gen = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${unlockStudentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 5,
        include: ["quiz_mcq"],
        excludeSeen: true,
        lessonId: String(lessonId),
        teacherId: String(otherTeacherId),
        source: "fresh-practice",
      });

    expect(gen.status).toBe(200);
    expect(gen.body.practiceSetId).toBeTruthy();
    expect(gen.body.selectedCount).toBeGreaterThan(0);
    for (const item of gen.body.items) {
      const q = await TopicQuizQuestion.findById(item.contentId).lean();
      expect(String(q.ownerId)).toBe(String(ownerTeacherId));
    }
  });

  test("student without lesson access is denied", async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    const outsider = await User.create({
      email: "lesson-fresh-outsider@test.com",
      password: pw,
      firstName: "N",
      lastName: "None",
      userType: "student",
    });
    const login = await request(app).post("/api/auth/login").send({
      email: "lesson-fresh-outsider@test.com",
      password: "Pass123!",
    });
    const token = login.body?.token;

    const avail = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${lessonId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${token}`);

    expect(avail.status).toBe(403);

    const gen = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 5,
        include: ["quiz_mcq"],
        excludeSeen: true,
        lessonId: String(lessonId),
        source: "fresh-practice",
      });
    expect(gen.status).toBe(403);

    await User.deleteOne({ _id: outsider._id });
  });

  test("forged other lessonId without unlock cannot access other teacher bank", async () => {
    const avail = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${otherLessonId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);

    expect(avail.status).toBe(403);
  });

  test("linked-teacher dashboard path still requires teacherId when lessonId omitted", async () => {
    const avail = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);

    expect(avail.status).toBe(400);
    expect(String(avail.body.error || "")).toMatch(/teacherId/i);
  });
});
