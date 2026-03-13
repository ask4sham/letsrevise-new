/**
 * PR-PRACTICE-LOOP-1: Practice set, attempt, teacher topic stats.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const ExamQuestion = require("../models/ExamQuestion");
const PastPaper = require("../models/PastPaper");
const PastPaperQuestion = require("../models/PastPaperQuestion");
const PracticeAttempt = require("../models/PracticeAttempt");

const hashedPassword = bcrypt.hashSync("Password123!", 10);
const SPEC = "aqa-gcse-biology";
const TOPIC = "cell-structure";

describe("Practice loop (PR-PRACTICE-LOOP-1)", () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  let studentId;
  let examQuestionId;
  let pastPaperId;
  let pastPaperQuestionId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Practice",
      lastName: "Teacher",
      email: `practice_teacher_${Date.now()}@example.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const student = await User.create({
      firstName: "Practice",
      lastName: "Student",
      email: `practice_student_${Date.now()}@example.com`,
      password: hashedPassword,
      userType: "student",
    });
    studentId = student._id;

    const tLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: teacher.email, password: "Password123!" })
      .expect(200);
    teacherToken = tLogin.body.token;

    const sLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: student.email, password: "Password123!" })
      .expect(200);
    studentToken = sLogin.body.token;

    const eq = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      topicKey: `${SPEC}:${TOPIC}`,
      question: "What is the function of the mitochondria?",
      markScheme: ["Respiration", "ATP"],
      marks: 2,
      status: "published",
      fingerprint: `eq_pl1_${Date.now()}`,
    });
    examQuestionId = eq._id;

    const paper = await PastPaper.create({
      ownerId: teacherId,
      specKey: SPEC,
      subject: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      year: "2024",
      series: "June",
      paperCode: "P1",
      tier: "higher",
      title: "Practice Paper",
      pdf: { mediaId: null, url: null, mimeType: "application/pdf" },
      fingerprint: `pp_pl1_${Date.now()}`,
    });
    pastPaperId = paper._id;

    const ppq = await PastPaperQuestion.create({
      ownerId: teacherId,
      pastPaperId: paper._id,
      specKey: SPEC,
      topicKey: `${SPEC}:${TOPIC}`,
      question: "Name the organelle that contains chlorophyll.",
      markScheme: ["Chloroplast"],
      marks: 1,
      fingerprint: `ppq_pl1_${Date.now()}`,
    });
    pastPaperQuestionId = ppq._id;
  }, 15000);

  afterAll(async () => {
    await PracticeAttempt.deleteMany({ studentId, teacherId });
    await PastPaperQuestion.deleteMany({ ownerId: teacherId });
    await ExamQuestion.deleteMany({ teacherId });
    await PastPaper.deleteMany({ ownerId: teacherId });
  });

  describe("GET /api/practice/set", () => {
    it("returns 400 without specKey or topicKey", async () => {
      await request(app)
        .get("/api/practice/set")
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(400);
    });

    it("returns items for topic (exam + past paper question)", async () => {
      const res = await request(app)
        .get(`/api/practice/set?specKey=${SPEC}&topicKey=${TOPIC}&count=10`)
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body).toHaveProperty("items");
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThanOrEqual(2);

      const types = res.body.items.map((i) => i.sourceType);
      expect(types).toContain("examQuestion");
      expect(types).toContain("pastPaperQuestion");

      const first = res.body.items[0];
      expect(first).toHaveProperty("sourceType");
      expect(first).toHaveProperty("sourceId");
      expect(first).toHaveProperty("teacherId");
      expect(first).toHaveProperty("question");
      expect(first).toHaveProperty("topicKey");
      expect(String(first.topicKey)).toMatch(new RegExp(`^${SPEC}:`));
    });
  });

  describe("POST /api/practice/attempt", () => {
    it("requires auth", async () => {
      await request(app)
        .post("/api/practice/attempt")
        .set("Content-Type", "application/json")
        .send({
          specKey: SPEC,
          topicKey: TOPIC,
          sourceType: "examQuestion",
          sourceId: examQuestionId,
          outcome: "correct",
          teacherId: teacherId,
        })
        .expect(401);
    });

    it("stores attempt with namespaced topicKey", async () => {
      const res = await request(app)
        .post("/api/practice/attempt")
        .set("Authorization", `Bearer ${studentToken}`)
        .set("Content-Type", "application/json")
        .send({
          specKey: SPEC,
          topicKey: TOPIC,
          sourceType: "examQuestion",
          sourceId: examQuestionId,
          outcome: "correct",
          confidence: 2,
          teacherId: String(teacherId),
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.attemptId).toBeTruthy();

      const attempt = await PracticeAttempt.findById(res.body.attemptId).lean();
      expect(attempt).toBeTruthy();
      expect(String(attempt.studentId)).toBe(String(studentId));
      expect(String(attempt.teacherId)).toBe(String(teacherId));
      expect(attempt.topicKey).toBe(`${SPEC}:${TOPIC}`);
      expect(attempt.outcome).toBe("correct");
      expect(attempt.confidence).toBe(2);
    });

    it("rejects invalid outcome", async () => {
      await request(app)
        .post("/api/practice/attempt")
        .set("Authorization", `Bearer ${studentToken}`)
        .set("Content-Type", "application/json")
        .send({
          specKey: SPEC,
          topicKey: TOPIC,
          sourceType: "examQuestion",
          sourceId: examQuestionId,
          outcome: "invalid",
          teacherId: String(teacherId),
        })
        .expect(400);
    });
  });

  describe("GET /api/practice/stats/topics", () => {
    it("returns 403 for non-teacher", async () => {
      await request(app)
        .get(`/api/practice/stats/topics?specKey=${SPEC}`)
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(403);
    });

    it("aggregates correctly for teacher", async () => {
      const res = await request(app)
        .get(`/api/practice/stats/topics?specKey=${SPEC}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .expect(200);

      expect(res.body.specKey).toBe(SPEC);
      expect(res.body).toHaveProperty("topics");
      expect(Array.isArray(res.body.topics)).toBe(true);

      const cellTopic = res.body.topics.find(
        (t) => t.topicKey === `${SPEC}:${TOPIC}` || t.topicKey === TOPIC
      );
      expect(cellTopic).toBeTruthy();
      expect(cellTopic.attempts).toBeGreaterThanOrEqual(1);
      expect(cellTopic.correct).toBeGreaterThanOrEqual(1);
      expect(cellTopic).toHaveProperty("accuracy");
      expect(cellTopic).toHaveProperty("lastAttempt");
    });
  });
});
