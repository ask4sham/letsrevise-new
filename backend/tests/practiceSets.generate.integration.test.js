/**
 * PR-PRACTICE-LOOP-1 Slice 2: POST /api/practice-sets/generate — student-only; validation; safety; filters; dedupe.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const PracticeSet = require("../models/PracticeSet");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const PastPaperQuestion = require("../models/PastPaperQuestion");

jest.setTimeout(20000);

const SPEC = "aqa-gcse-biology";
const TOPIC = "aqa-gcse-biology:cell-structure";

describe("POST /api/practice-sets/generate", () => {
  let studentToken;
  let studentId;
  let teacherId;

  beforeAll(async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    const [teacher, student] = await Promise.all([
      User.create({
        email: "practice-set-teacher@test.com",
        password: pw,
        firstName: "T",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: "practice-set-student@test.com",
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
      email: "practice-set-student@test.com",
      password: "Pass123!",
    });
    studentToken = login.body?.token;
    if (!studentToken) throw new Error("Student login failed");
  });

  afterAll(async () => {
    await PracticeSet.deleteMany({ studentId });
    await StudentTeacherLink.deleteMany({ studentId });
    await TopicQuizQuestion.deleteMany({ ownerId: teacherId });
    await ExamQuestion.deleteMany({ teacherId });
    await PastPaperQuestion.deleteMany({ ownerId: teacherId });
  });

  test("happy path: valid specKey + topicKeys returns practiceSetId and items.length <= limit", async () => {
    await TopicQuizQuestion.create({
      ownerId: teacherId,
      topicKey: TOPIC,
      type: "mcq",
      questionText: "What is a cell?",
      choices: ["A", "B", "C"],
      correctIndex: 0,
      status: "published",
      kind: "quiz",
      fingerprint: "ps-gen-mcq-1",
    });

    const res = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 10,
        include: ["quiz_mcq"],
        teacherId: teacherId.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.practiceSetId).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeLessThanOrEqual(10);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);

    const set = await PracticeSet.findById(res.body.practiceSetId).lean();
    expect(set).toBeTruthy();
    expect(set.studentId.toString()).toBe(studentId.toString());
    expect(set.specKey).toBe(SPEC);
    expect(set.topicKeys).toEqual([TOPIC]);
    expect(set.items.length).toBe(res.body.items.length);
  });

  test("safety: returned quiz MCQ items do NOT include correctIndex or correct answer", async () => {
    const res = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 5,
        include: ["quiz_mcq"],
        teacherId: teacherId.toString(),
      });

    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item.contentType).toBe("quiz_mcq");
      expect(item).not.toHaveProperty("correctIndex");
      expect(item).not.toHaveProperty("correctAnswer");
      expect(item).not.toHaveProperty("correct");
      expect(item.prompt).toBeDefined();
      expect(item.choices).toBeDefined();
    }
  });

  test("safety: exam_question items do not include mark scheme or correct answer", async () => {
    await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "mcq",
      topicKey: TOPIC,
      question: "Exam MCQ?",
      options: ["X", "Y", "Z"],
      correctIndex: 1,
      status: "published",
    });

    const res = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 10,
        include: ["exam_question"],
        teacherId: teacherId.toString(),
      });

    expect(res.status).toBe(200);
    const examItems = res.body.items.filter((i) => i.contentType === "exam_question");
    expect(examItems.length).toBeGreaterThanOrEqual(1);
    for (const item of examItems) {
      expect(item).not.toHaveProperty("markScheme");
      expect(item).not.toHaveProperty("correctIndex");
      expect(item).not.toHaveProperty("correctAnswer");
      expect(item.prompt).toBeDefined();
    }
  });

  test("safety: past_paper_question items do not include mark scheme", async () => {
    const pastPaperId = new mongoose.Types.ObjectId();
    await PastPaperQuestion.create({
      ownerId: teacherId,
      pastPaperId,
      specKey: SPEC,
      topicKey: TOPIC,
      question: "Past paper Q?",
      markScheme: ["Do not expose this"],
      fingerprint: "ps-gen-ppq-1",
    });

    const res = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 10,
        include: ["past_paper_question"],
        teacherId: teacherId.toString(),
      });

    expect(res.status).toBe(200);
    const ppItems = res.body.items.filter((i) => i.contentType === "past_paper_question");
    expect(ppItems.length).toBeGreaterThanOrEqual(1);
    for (const item of ppItems) {
      expect(item).not.toHaveProperty("markScheme");
      expect(item.prompt).toBeDefined();
    }
  });

  test("validation: missing specKey → 400", async () => {
    const res = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        topicKeys: [TOPIC],
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/specKey/i);
  });

  test("validation: topicKeys not namespaced or wrong prefix → 400", async () => {
    const res = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: ["cell-structure"],
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/topicKey|namespaced|start with/i);
  });

  test("validation: invalid include type → 400", async () => {
    const res = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        include: ["invalid_type"],
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/include|Invalid/i);
  });

  test("without student-teacher link → 403", async () => {
    const otherTeacher = await User.create({
      email: "practice-set-other-teacher@test.com",
      password: await bcrypt.hash("Pass123!", 10),
      firstName: "O",
      lastName: "Teacher",
      userType: "teacher",
    });
    const res = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 5,
        teacherId: otherTeacher._id.toString(),
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/link|teacher|add you/i);
    await User.deleteOne({ _id: otherTeacher._id });
  });

  test("non-student → 403", async () => {
    const teacherLogin = await request(app).post("/api/auth/login").send({
      email: "practice-set-teacher@test.com",
      password: "Pass123!",
    });
    const teacherToken = teacherLogin.body?.token;
    const res = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/student|only/i);
  });

  test("filters: difficulty filter returns only matching items where applicable", async () => {
    await TopicQuizQuestion.create({
      ownerId: teacherId,
      topicKey: TOPIC,
      type: "mcq",
      questionText: "Hard question?",
      choices: ["A", "B"],
      correctIndex: 0,
      difficulty: 3,
      status: "published",
      kind: "quiz",
      fingerprint: "ps-gen-diff-3",
    });
    await TopicQuizQuestion.create({
      ownerId: teacherId,
      topicKey: TOPIC,
      type: "mcq",
      questionText: "Easy question?",
      choices: ["A", "B"],
      correctIndex: 0,
      difficulty: 1,
      status: "published",
      kind: "quiz",
      fingerprint: "ps-gen-diff-1",
    });

    const res = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 10,
        include: ["quiz_mcq"],
        difficulty: [3],
        teacherId: teacherId.toString(),
      });

    expect(res.status).toBe(200);
    const mcqs = res.body.items.filter((i) => i.contentType === "quiz_mcq");
    for (const item of mcqs) {
      expect(item.metadata?.difficulty === 3 || item.metadata?.difficulty == null).toBe(true);
    }
  });

  test("dedupe: same (contentType, contentId) appears only once in response", async () => {
    const res = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 50,
        include: ["quiz_mcq", "quiz_short", "exam_question", "past_paper_question"],
        teacherId: teacherId.toString(),
      });

    expect(res.status).toBe(200);
    const keys = new Set();
    for (const item of res.body.items) {
      const key = `${item.contentType}:${item.contentId}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
  });

  test("mode=challenge prefers harder exam questions and stays student-safe", async () => {
    await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      topicKey: TOPIC,
      question: "State one function of the nucleus.",
      marks: 1,
      difficulty: 1,
      skill: "recall",
      status: "published",
    });
    await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      topicKey: TOPIC,
      question: "Evaluate how the placenta is adapted for exchange.",
      marks: 6,
      difficulty: 5,
      skill: "analysis",
      level: "Higher",
      status: "published",
    });

    const challengeRes = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 1,
        include: ["exam_question"],
        mode: "challenge",
        teacherId: teacherId.toString(),
      });

    expect(challengeRes.status).toBe(200);
    expect(challengeRes.body.mode).toBe("challenge");
    expect(challengeRes.body.items.length).toBe(1);
    expect(challengeRes.body.items[0].prompt).toMatch(/Evaluate how the placenta/i);
    expect(challengeRes.body.items[0]).not.toHaveProperty("markScheme");
    expect(challengeRes.body.items[0]).not.toHaveProperty("correctAnswer");
    expect(challengeRes.body.items[0].metadata?.marks).toBe(6);

    const standardRes = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 10,
        include: ["exam_question"],
        mode: "standard",
        teacherId: teacherId.toString(),
      });
    expect(standardRes.status).toBe(200);
    expect(standardRes.body.mode).toBe("standard");
    expect(standardRes.body.items.length).toBeGreaterThanOrEqual(2);
  });

  test("mode=challenge falls back to hardest available when no strong matches", async () => {
    await ExamQuestion.deleteMany({ teacherId, topicKey: TOPIC });
    await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      topicKey: TOPIC,
      question: "State X for challenge fallback.",
      marks: 1,
      difficulty: 1,
      status: "published",
    });
    await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      topicKey: TOPIC,
      question: "Describe Y for challenge fallback.",
      marks: 2,
      difficulty: 3,
      status: "published",
    });

    const res = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 1,
        include: ["exam_question"],
        mode: "challenge",
        teacherId: teacherId.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].prompt).toMatch(/Describe Y for challenge fallback/i);
  });
});
