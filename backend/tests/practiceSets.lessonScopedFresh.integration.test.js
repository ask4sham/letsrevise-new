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
const PracticeAttempt = require("../models/PracticeAttempt");
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

  describe("stranded fresh-practice resume availability", () => {
    beforeEach(async () => {
      await PracticeAttempt.deleteMany({
        $or: [{ studentId: unlockStudentId }, { userId: unlockStudentId }],
      });
      await PracticeSet.deleteMany({ studentId: unlockStudentId });
    });

  test("completed set plus fully unattempted second set returns resume for second set", async () => {
    const qIds = [];
    for (let i = 0; i < 4; i++) {
      const q = await TopicQuizQuestion.create({
        ownerId: ownerTeacherId,
        topicKey: TOPIC,
        type: "mcq",
        questionText: `Resume stranded stem ${i} unique fingerprint text here xx`,
        choices: ["A", "B", "C"],
        correctIndex: 0,
        status: "published",
        kind: "quiz",
        fingerprint: `resume-stranded-${i}-${Date.now()}`,
      });
      qIds.push(q._id);
    }

    const completed = await PracticeSet.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKeys: [TOPIC],
      lessonId,
      source: "fresh-practice",
      items: [
        { contentType: "quiz_mcq", contentId: qIds[0], topicKey: TOPIC },
        { contentType: "quiz_mcq", contentId: qIds[1], topicKey: TOPIC },
      ],
    });
    await PracticeAttempt.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: qIds[0],
      isCorrect: true,
    });
    await PracticeAttempt.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: qIds[1],
      isCorrect: false,
    });

    const stranded = await PracticeSet.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKeys: [TOPIC],
      lessonId,
      source: "fresh-practice",
      items: [
        { contentType: "quiz_mcq", contentId: qIds[2], topicKey: TOPIC },
        { contentType: "quiz_mcq", contentId: qIds[3], topicKey: TOPIC },
      ],
    });

    const beforeSets = await PracticeSet.countDocuments({ studentId: unlockStudentId });
    const beforeAttempts = await PracticeAttempt.countDocuments({ studentId: unlockStudentId });

    const avail = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${lessonId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);

    expect(avail.status).toBe(200);
    expect(avail.body.resumeAvailable).toBe(true);
    expect(avail.body.resumePracticeSetId).toBe(String(stranded._id));
    expect(avail.body.resumeItemCount).toBe(2);
    expect(avail.body.resumeAttemptedCount).toBe(0);
    expect(avail.body.resumeRemainingCount).toBe(2);
    expect(avail.body.resumeStartIndex).toBe(0);
    expect(avail.body.lessonId).toBe(String(lessonId));
    expect(avail.body.resumePracticeSetId).not.toBe(String(completed._id));

    const afterSets = await PracticeSet.countDocuments({ studentId: unlockStudentId });
    const afterAttempts = await PracticeAttempt.countDocuments({ studentId: unlockStudentId });
    expect(afterSets).toBe(beforeSets);
    expect(afterAttempts).toBe(beforeAttempts);

    await PracticeAttempt.deleteMany({ studentId: unlockStudentId, contentId: { $in: qIds } });
    await PracticeSet.deleteMany({ _id: { $in: [completed._id, stranded._id] } });
    await TopicQuizQuestion.deleteMany({ _id: { $in: qIds } });
  });

  test("completed set alone is not resumable; wrong student/lesson/topic ignored", async () => {
    const q = await TopicQuizQuestion.create({
      ownerId: ownerTeacherId,
      topicKey: TOPIC,
      type: "mcq",
      questionText: "Completed-only resume guard unique fingerprint stem text",
      choices: ["A", "B", "C"],
      correctIndex: 0,
      status: "published",
      kind: "quiz",
      fingerprint: `completed-only-${Date.now()}`,
    });

    const completed = await PracticeSet.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKeys: [TOPIC],
      lessonId,
      source: "fresh-practice",
      items: [{ contentType: "quiz_mcq", contentId: q._id, topicKey: TOPIC }],
    });
    await PracticeAttempt.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: q._id,
      isCorrect: true,
    });

    const availDone = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${lessonId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);
    expect(availDone.status).toBe(200);
    expect(availDone.body.resumeAvailable).toBe(false);
    expect(availDone.body.resumePracticeSetId).toBeNull();

    const otherStudent = await User.create({
      email: "lesson-fresh-other-student@test.com",
      password: await bcrypt.hash("Pass123!", 10),
      firstName: "O",
      lastName: "S",
      userType: "student",
    });
    const otherSet = await PracticeSet.create({
      studentId: otherStudent._id,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKeys: [TOPIC],
      lessonId,
      source: "fresh-practice",
      items: [{ contentType: "quiz_mcq", contentId: q._id, topicKey: TOPIC }],
    });

    const availOwn = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${lessonId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);
    expect(availOwn.body.resumeAvailable).toBe(false);

    // Set stored under a different topicKey must not resume for this topic.
    const wrongTopicSet = await PracticeSet.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKeys: [`${SPEC}:mitosis`],
      lessonId,
      source: "fresh-practice",
      items: [{ contentType: "quiz_mcq", contentId: q._id, topicKey: `${SPEC}:mitosis` }],
    });
    const availTopic = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${lessonId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);
    expect(availTopic.status).toBe(200);
    expect(availTopic.body.resumeAvailable).toBe(false);

    await PracticeSet.deleteMany({
      _id: { $in: [completed._id, otherSet._id, wrongTopicSet._id] },
    });
    await PracticeAttempt.deleteMany({ contentId: q._id });
    await TopicQuizQuestion.deleteOne({ _id: q._id });
    await User.deleteOne({ _id: otherStudent._id });
  });

  test("multiple unattempted sets: newest valid set wins deterministically", async () => {
    const qA = await TopicQuizQuestion.create({
      ownerId: ownerTeacherId,
      topicKey: TOPIC,
      type: "mcq",
      questionText: "Newest resume A unique fingerprint stem text here",
      choices: ["A", "B", "C"],
      correctIndex: 0,
      status: "published",
      kind: "quiz",
      fingerprint: `newest-a-${Date.now()}`,
    });
    const qB = await TopicQuizQuestion.create({
      ownerId: ownerTeacherId,
      topicKey: TOPIC,
      type: "mcq",
      questionText: "Newest resume B unique fingerprint stem text here",
      choices: ["A", "B", "C"],
      correctIndex: 0,
      status: "published",
      kind: "quiz",
      fingerprint: `newest-b-${Date.now()}`,
    });

    const older = await PracticeSet.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKeys: [TOPIC],
      lessonId,
      source: "fresh-practice",
      items: [{ contentType: "quiz_mcq", contentId: qA._id, topicKey: TOPIC }],
    });
    const newer = await PracticeSet.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKeys: [TOPIC],
      lessonId,
      source: "fresh-practice",
      items: [{ contentType: "quiz_mcq", contentId: qB._id, topicKey: TOPIC }],
    });
    // Force deterministic ordering (timestamps can collide in fast tests).
    await PracticeSet.collection.updateOne(
      { _id: older._id },
      { $set: { createdAt: new Date("2024-01-01T00:00:00.000Z") } }
    );
    await PracticeSet.collection.updateOne(
      { _id: newer._id },
      { $set: { createdAt: new Date("2025-06-01T00:00:00.000Z") } }
    );

    const avail = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${lessonId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);

    expect(avail.status).toBe(200);
    expect(avail.body.resumeAvailable).toBe(true);
    expect(avail.body.resumePracticeSetId).toBe(String(newer._id));
    expect(avail.body.resumePracticeSetId).not.toBe(String(older._id));

    await PracticeSet.deleteMany({ _id: { $in: [older._id, newer._id] } });
    await TopicQuizQuestion.deleteMany({ _id: { $in: [qA._id, qB._id] } });
  });

  test("attempt matching uses contentType + contentId even when practiceSetId absent", async () => {
    const q = await TopicQuizQuestion.create({
      ownerId: ownerTeacherId,
      topicKey: TOPIC,
      type: "mcq",
      questionText: "Content identity resume match unique fingerprint stem",
      choices: ["A", "B", "C"],
      correctIndex: 0,
      status: "published",
      kind: "quiz",
      fingerprint: `content-id-match-${Date.now()}`,
    });
    const set = await PracticeSet.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKeys: [TOPIC],
      lessonId,
      source: "fresh-practice",
      items: [{ contentType: "quiz_mcq", contentId: q._id, topicKey: TOPIC }],
    });
    // Attempt without practiceSetId — must still mark set non-resumable
    await PracticeAttempt.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: q._id,
      isCorrect: true,
    });

    const avail = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${lessonId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);

    expect(avail.status).toBe(200);
    expect(avail.body.resumeAvailable).toBe(false);
    expect(avail.body.resumePracticeSetId).toBeNull();

    await PracticeAttempt.deleteMany({ contentId: q._id });
    await PracticeSet.deleteOne({ _id: set._id });
    await TopicQuizQuestion.deleteOne({ _id: q._id });
  });

  test("partially completed set remains resumable with startIndex at first unanswered", async () => {
    const qIds = [];
    for (let i = 0; i < 5; i++) {
      const q = await TopicQuizQuestion.create({
        ownerId: ownerTeacherId,
        topicKey: TOPIC,
        type: "mcq",
        questionText: `Partial resume stem ${i} unique fingerprint text here xx`,
        choices: ["A", "B", "C"],
        correctIndex: 0,
        status: "published",
        kind: "quiz",
        fingerprint: `partial-resume-${i}-${Date.now()}`,
      });
      qIds.push(q._id);
    }

    const set = await PracticeSet.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKeys: [TOPIC],
      lessonId,
      source: "fresh-practice",
      items: qIds.map((id) => ({ contentType: "quiz_mcq", contentId: id, topicKey: TOPIC })),
    });

    // 0/5
    let avail = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${lessonId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);
    expect(avail.status).toBe(200);
    expect(avail.body.resumeAvailable).toBe(true);
    expect(avail.body.resumePracticeSetId).toBe(String(set._id));
    expect(avail.body.resumeItemCount).toBe(5);
    expect(avail.body.resumeAttemptedCount).toBe(0);
    expect(avail.body.resumeRemainingCount).toBe(5);
    expect(avail.body.resumeStartIndex).toBe(0);

    // 1/5 — first item answered
    await PracticeAttempt.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: qIds[0],
      isCorrect: true,
    });
    // Duplicate attempt for same item must not inflate attemptedCount
    await PracticeAttempt.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: qIds[0],
      isCorrect: false,
    });
    // Wrong contentType for same ObjectId must not count
    await PracticeAttempt.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_short",
      contentId: qIds[1],
      isCorrect: true,
    });
    // Outside-set item must not count
    const outside = await TopicQuizQuestion.create({
      ownerId: ownerTeacherId,
      topicKey: TOPIC,
      type: "mcq",
      questionText: "Outside set attempt unique fingerprint stem text here",
      choices: ["A", "B", "C"],
      correctIndex: 0,
      status: "published",
      kind: "quiz",
      fingerprint: `outside-set-${Date.now()}`,
    });
    await PracticeAttempt.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: outside._id,
      isCorrect: true,
    });

    const beforeSets = await PracticeSet.countDocuments({ studentId: unlockStudentId });
    avail = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${lessonId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);
    expect(avail.status).toBe(200);
    expect(avail.body.resumeAvailable).toBe(true);
    expect(avail.body.resumePracticeSetId).toBe(String(set._id));
    expect(avail.body.resumeItemCount).toBe(5);
    expect(avail.body.resumeAttemptedCount).toBe(1);
    expect(avail.body.resumeRemainingCount).toBe(4);
    expect(avail.body.resumeStartIndex).toBe(1);
    expect(await PracticeSet.countDocuments({ studentId: unlockStudentId })).toBe(beforeSets);

    // 4/5
    for (let i = 1; i <= 3; i++) {
      await PracticeAttempt.create({
        studentId: unlockStudentId,
        teacherId: ownerTeacherId,
        specKey: SPEC,
        topicKey: TOPIC,
        contentType: "quiz_mcq",
        contentId: qIds[i],
        isCorrect: true,
      });
    }
    avail = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${lessonId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);
    expect(avail.body.resumeAvailable).toBe(true);
    expect(avail.body.resumeAttemptedCount).toBe(4);
    expect(avail.body.resumeRemainingCount).toBe(1);
    expect(avail.body.resumeStartIndex).toBe(4);

    // 5/5 complete
    await PracticeAttempt.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: qIds[4],
      isCorrect: true,
    });
    avail = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${lessonId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);
    expect(avail.body.resumeAvailable).toBe(false);
    expect(avail.body.resumePracticeSetId).toBeNull();

    await PracticeAttempt.deleteMany({
      contentId: { $in: [...qIds, outside._id] },
    });
    await PracticeSet.deleteOne({ _id: set._id });
    await TopicQuizQuestion.deleteMany({ _id: { $in: [...qIds, outside._id] } });
  });

  test("another student's attempt does not mark own set items attempted", async () => {
    const q = await TopicQuizQuestion.create({
      ownerId: ownerTeacherId,
      topicKey: TOPIC,
      type: "mcq",
      questionText: "Other student attempt ignore unique fingerprint stem xx",
      choices: ["A", "B", "C"],
      correctIndex: 0,
      status: "published",
      kind: "quiz",
      fingerprint: `other-student-attempt-${Date.now()}`,
    });
    const q2 = await TopicQuizQuestion.create({
      ownerId: ownerTeacherId,
      topicKey: TOPIC,
      type: "mcq",
      questionText: "Other student attempt ignore second unique fingerprint",
      choices: ["A", "B", "C"],
      correctIndex: 0,
      status: "published",
      kind: "quiz",
      fingerprint: `other-student-attempt-2-${Date.now()}`,
    });
    const set = await PracticeSet.create({
      studentId: unlockStudentId,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKeys: [TOPIC],
      lessonId,
      source: "fresh-practice",
      items: [
        { contentType: "quiz_mcq", contentId: q._id, topicKey: TOPIC },
        { contentType: "quiz_mcq", contentId: q2._id, topicKey: TOPIC },
      ],
    });
    const otherStudent = await User.create({
      email: `lesson-fresh-attempt-other-${Date.now()}@test.com`,
      password: await bcrypt.hash("Pass123!", 10),
      firstName: "O",
      lastName: "T",
      userType: "student",
    });
    await PracticeAttempt.create({
      studentId: otherStudent._id,
      teacherId: ownerTeacherId,
      specKey: SPEC,
      topicKey: TOPIC,
      contentType: "quiz_mcq",
      contentId: q._id,
      isCorrect: true,
    });

    const avail = await request(app)
      .get(
        `/api/practice-sets/fresh-availability?specKey=${SPEC}&topicKey=${encodeURIComponent(
          TOPIC
        )}&lessonId=${lessonId}&limit=5&include=quiz_mcq`
      )
      .set("Authorization", `Bearer ${unlockStudentToken}`);
    expect(avail.status).toBe(200);
    expect(avail.body.resumeAvailable).toBe(true);
    expect(avail.body.resumeAttemptedCount).toBe(0);
    expect(avail.body.resumeRemainingCount).toBe(2);
    expect(avail.body.resumeStartIndex).toBe(0);

    await PracticeAttempt.deleteMany({ contentId: { $in: [q._id, q2._id] } });
    await PracticeSet.deleteOne({ _id: set._id });
    await TopicQuizQuestion.deleteMany({ _id: { $in: [q._id, q2._id] } });
    await User.deleteOne({ _id: otherStudent._id });
  });
  }); // stranded fresh-practice resume availability
});
