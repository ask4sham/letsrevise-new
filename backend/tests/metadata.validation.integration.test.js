/**
 * PR-METADATA-1: Metadata validation — invalid difficulty/skill rejected; valid metadata persists on POST and bulk import.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const PastPaper = require("../models/PastPaper");
const PastPaperQuestion = require("../models/PastPaperQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const { pastPaperFingerprint } = require("../utils/pastPaperDedupe");
const { normalizeDifficulty, normalizeSkill, normalizeEstimatedTimeSec, normalizeMetadata } = require("../utils/metadataValidation");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("metadataValidation utils", () => {
  test("normalizeDifficulty rejects invalid", () => {
    expect(() => normalizeDifficulty(0)).toThrow();
    expect(() => normalizeDifficulty(6)).toThrow();
    expect(() => normalizeDifficulty("x")).toThrow();
    try {
      normalizeDifficulty(0);
    } catch (e) {
      expect(e.code).toBe("INVALID_DIFFICULTY");
    }
  });
  test("normalizeDifficulty accepts 1-5 and null", () => {
    expect(normalizeDifficulty(null)).toBeNull();
    expect(normalizeDifficulty(undefined)).toBeNull();
    expect(normalizeDifficulty("")).toBeNull();
    expect(normalizeDifficulty(1)).toBe(1);
    expect(normalizeDifficulty(5)).toBe(5);
    expect(normalizeDifficulty("3")).toBe(3);
  });
  test("normalizeSkill rejects invalid", () => {
    expect(() => normalizeSkill("unknown")).toThrow();
    try {
      normalizeSkill("unknown");
    } catch (e) {
      expect(e.code).toBe("INVALID_SKILL");
    }
  });
  test("normalizeSkill accepts enum and null", () => {
    expect(normalizeSkill(null)).toBeNull();
    expect(normalizeSkill("recall")).toBe("recall");
    expect(normalizeSkill("application")).toBe("application");
    expect(normalizeSkill("ANALYSIS")).toBe("analysis");
  });
  test("normalizeEstimatedTimeSec rejects invalid", () => {
    expect(() => normalizeEstimatedTimeSec(0)).toThrow();
    expect(() => normalizeEstimatedTimeSec(-1)).toThrow();
    try {
      normalizeEstimatedTimeSec(0);
    } catch (e) {
      expect(e.code).toBe("INVALID_ESTIMATED_TIME");
    }
  });
  test("normalizeEstimatedTimeSec accepts positive and null", () => {
    expect(normalizeEstimatedTimeSec(null)).toBeNull();
    expect(normalizeEstimatedTimeSec(30)).toBe(30);
    expect(normalizeEstimatedTimeSec("120")).toBe(120);
  });
  test("normalizeMetadata returns object", () => {
    const out = normalizeMetadata({ difficulty: 2, skill: "recall", estimatedTimeSec: 60 });
    expect(out).toEqual({ difficulty: 2, skill: "recall", estimatedTimeSec: 60 });
    expect(normalizeMetadata({})).toEqual({ difficulty: null, skill: null, estimatedTimeSec: null });
  });
});

describe("POST /api/past-paper-questions metadata", () => {
  let token;
  let pastPaperId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Meta",
      lastName: "Teacher",
      email: `meta_ppq_${Date.now()}@example.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: teacher.email, password: "password123" })
      .expect(200);
    token = login.body.token;
    const paper = await PastPaper.create({
      ownerId: teacher._id,
      specKey: "aqa-gcse-biology",
      examBoard: "AQA",
      level: "GCSE",
      year: "2024",
      paperCode: "Paper 1",
      fingerprint: pastPaperFingerprint({ specKey: "aqa-gcse-biology", examBoard: "AQA", level: "GCSE", year: "2024", paperCode: "Paper 1", series: "June" }),
    });
    pastPaperId = paper._id.toString();
  }, 15000);

  afterAll(async () => {
    await PastPaperQuestion.deleteMany({ pastPaperId });
    await PastPaper.deleteMany({ _id: pastPaperId });
  });

  test("invalid difficulty -> 400", async () => {
    const res = await request(app)
      .post("/api/past-paper-questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        pastPaperId,
        topicKey: "cell-structure",
        question: "Q?",
        markScheme: "MS",
        difficulty: 10,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/difficulty/);
  });

  test("invalid skill -> 400", async () => {
    const res = await request(app)
      .post("/api/past-paper-questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        pastPaperId,
        topicKey: "cell-structure",
        question: "Q?",
        markScheme: "MS",
        skill: "invalid-skill",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/skill/);
  });

  test("valid metadata persists on create", async () => {
    const res = await request(app)
      .post("/api/past-paper-questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        pastPaperId,
        topicKey: "cell-structure",
        question: "Meta question " + Date.now(),
        markScheme: "Answer",
        difficulty: 3,
        skill: "application",
        estimatedTimeSec: 90,
      })
      .expect(201);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.difficulty).toBe(3);
    expect(res.body.item.skill).toBe("application");
    expect(res.body.item.estimatedTimeSec).toBe(90);
  });
});

describe("bulk import exam questions dryRun with metadata", () => {
  let token;

  beforeAll(async () => {
    const user = await User.create({
      firstName: "Bulk",
      lastName: "Meta",
      email: `bulk_meta_${Date.now()}@example.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "password123" })
      .expect(200);
    token = login.body.token;
  }, 15000);

  test("dryRun would_insert includes metadata in preview", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        specKey: "aqa-gcse-biology",
        dryRun: true,
        items: [
          {
            topicKey: "cell-structure",
            question: "Unique meta question " + Date.now(),
            markScheme: "MS",
            difficulty: 2,
            skill: "recall",
            estimatedTimeSec: 45,
          },
        ],
      })
      .expect(200);
    expect(res.body.valid).toBe(1);
    expect(res.body.preview[0].action).toBe("would_insert");
    expect(res.body.preview[0].difficulty).toBe(2);
    expect(res.body.preview[0].skill).toBe("recall");
    expect(res.body.preview[0].estimatedTimeSec).toBe(45);
  });

  test("invalid metadata in bulk item -> INVALID_* in report", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        specKey: "aqa-gcse-biology",
        dryRun: true,
        items: [
          {
            topicKey: "cell-structure",
            question: "Q",
            markScheme: "MS",
            difficulty: 99,
          },
        ],
      })
      .expect(200);
    expect(res.body.invalid).toBe(1);
    expect(res.body.errors[0].code).toBe("INVALID_DIFFICULTY");
  });
});
