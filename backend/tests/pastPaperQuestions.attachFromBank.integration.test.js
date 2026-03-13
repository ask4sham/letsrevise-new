/**
 * PR-PAST-PAPERS-UI-3: POST /api/past-paper-questions/attach-from-bank
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const PastPaper = require("../models/PastPaper");
const ExamQuestion = require("../models/ExamQuestion");
const PastPaperQuestion = require("../models/PastPaperQuestion");

const hashedPassword = bcrypt.hashSync("Password123!", 10);

describe("POST /api/past-paper-questions/attach-from-bank", () => {
  let token;
  let teacherId;
  let pastPaperId;
  let examQuestionId;

  beforeAll(async () => {
    const email = `teacher_attach_${Date.now()}@example.com`;
    const teacher = await User.create({
      firstName: "Test",
      lastName: "Teacher",
      email,
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const login = await request(app).post("/api/auth/login").send({ email, password: "Password123!" }).expect(200);
    token = login.body.token;
    if (!token) throw new Error("Login failed");

    const paper = await PastPaper.create({
      ownerId: teacherId,
      specKey: "aqa-gcse-biology",
      subject: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      year: "2024",
      series: "June",
      paperCode: "Paper 1",
      tier: "higher",
      title: "My Paper",
      pdf: { mediaId: null, url: null, mimeType: "application/pdf" },
      fingerprint: `fp_attach_${Date.now()}`,
    });
    pastPaperId = paper._id;

    const q = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      topicKey: "aqa-gcse-biology:cell-structure",
      question: "Explain the function of the nucleus.",
      markScheme: ["Controls cell activities", "Contains genetic material"],
      marks: 2,
      status: "published",
      fingerprint: `eq_attach_${Date.now()}`,
    });
    examQuestionId = q._id;
  }, 15000);

  afterAll(async () => {
    await PastPaperQuestion.deleteMany({ ownerId: teacherId });
    await ExamQuestion.deleteMany({ teacherId });
    await PastPaper.deleteMany({ ownerId: teacherId });
  });

  it("requires auth", async () => {
    await request(app)
      .post("/api/past-paper-questions/attach-from-bank")
      .set("Content-Type", "application/json")
      .send({ pastPaperId: String(pastPaperId), examQuestionIds: [String(examQuestionId)] })
      .expect(401);
  });

  it("attaches teacher-owned exam question and creates PastPaperQuestion", async () => {
    const res = await request(app)
      .post("/api/past-paper-questions/attach-from-bank")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ pastPaperId: String(pastPaperId), examQuestionIds: [String(examQuestionId)] })
      .expect(200);

    expect(res.body.inserted).toBe(1);
    expect(res.body.total).toBe(1);

    const linked = await PastPaperQuestion.findOne({ ownerId: teacherId, pastPaperId }).lean();
    expect(linked).toBeTruthy();
    expect(linked.topicKey).toMatch(/^aqa-gcse-biology:/);
    expect(linked.question).toContain("nucleus");
  });

  it("second attach dedupes", async () => {
    const res = await request(app)
      .post("/api/past-paper-questions/attach-from-bank")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({ pastPaperId: String(pastPaperId), examQuestionIds: [String(examQuestionId)] })
      .expect(200);

    expect(res.body.inserted).toBe(0);
    expect(res.body.skippedDuplicates).toBeGreaterThanOrEqual(1);
  });
});
