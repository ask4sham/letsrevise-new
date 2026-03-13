/**
 * PR-BULK-INGEST-4: Admin bulk import past paper questions — topic validation, pastPaperId, namespaced topicKey.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const PastPaper = require("../models/PastPaper");
const PastPaperQuestion = require("../models/PastPaperQuestion");
const { pastPaperFingerprint } = require("../utils/pastPaperDedupe");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("POST /api/admin/bulk-import/past-paper-questions", () => {
  let teacherToken;
  let teacherId;
  let pastPaperId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "PPQ",
      lastName: "Teacher",
      email: "ppq-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "ppq-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    const fp = pastPaperFingerprint({
      specKey: "aqa-gcse-biology",
      examBoard: "AQA",
      level: "GCSE",
      year: "2024",
      paperCode: "Paper 1",
      series: "June",
    });
    const paper = await PastPaper.create({
      ownerId: teacherId,
      specKey: "aqa-gcse-biology",
      examBoard: "AQA",
      level: "GCSE",
      year: "2024",
      paperCode: "Paper 1",
      series: "June",
      fingerprint: fp,
    });
    pastPaperId = paper._id.toString();
  }, 15000);

  afterAll(async () => {
    await PastPaperQuestion.deleteMany({ ownerId: teacherId });
    await PastPaper.deleteMany({ ownerId: teacherId });
  });

  it("invalid topicKey -> 200 with INVALID_TOPIC_KEY in report", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/past-paper-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        dryRun: true,
        items: [
          {
            pastPaperId,
            topicKey: "not-a-real-topic",
            question: "Q?",
          },
        ],
      })
      .expect(200);

    expect(res.body).toHaveProperty("invalid", 1);
    expect(res.body.errors[0]).toHaveProperty("code", "INVALID_TOPIC_KEY");
  });

  it("invalid pastPaperId -> 200 with INVALID_PAST_PAPER_ID", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/past-paper-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        dryRun: true,
        items: [
          {
            pastPaperId: "000000000000000000000000",
            topicKey: "cell-structure",
            question: "Q?",
          },
        ],
      })
      .expect(200);

    expect(res.body).toHaveProperty("invalid", 1);
    expect(res.body.errors[0]).toHaveProperty("code", "INVALID_PAST_PAPER_ID");
  });

  it("valid dryRun -> would_insert and namespaced topicKey", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/past-paper-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        dryRun: true,
        items: [
          {
            pastPaperId,
            topicKey: "cell-structure",
            questionNumber: "1(a)",
            marks: 2,
            question: "Describe the function of the nucleus.",
            markScheme: "Award 1 mark for control of cell activities.",
          },
        ],
      })
      .expect(200);

    expect(res.body).toHaveProperty("valid", 1);
    expect(res.body.preview[0]).toHaveProperty("action", "would_insert");
    expect(res.body.preview[0].topicKey).toMatch(/^aqa-gcse-biology:/);
  });

  it("valid dryRun with metadata -> preview includes metadata when provided", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/past-paper-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        dryRun: true,
        items: [
          {
            pastPaperId,
            topicKey: "cell-structure",
            question: "Meta PPQ " + Date.now(),
            markScheme: "MS",
            difficulty: 2,
            skill: "recall",
            estimatedTimeSec: 60,
          },
        ],
      })
      .expect(200);
    expect(res.body.valid).toBe(1);
    expect(res.body.preview[0].difficulty).toBe(2);
    expect(res.body.preview[0].skill).toBe("recall");
    expect(res.body.preview[0].estimatedTimeSec).toBe(60);
  });
});
