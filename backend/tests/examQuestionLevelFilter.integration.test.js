/**
 * Integration: Edexcel IGCSE level filter + topicKey selector fallback.
 * - Legacy GCSE-labelled Edexcel rows match IGCSE lesson filter.
 * - Legacy rows with correct topic text but missing/mismatched topicKey are
 *   still found by the lesson-block selector (topic-text fallback).
 * - Unrelated topics and AQA behaviour unaffected.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(20000);

const REPRO_TOPIC_KEY = "edexcel-igcse-biology:human-male-and-female-reproductive-systems";

describe("GET /api/exam-questions level + topicKey selector", () => {
  let teacherToken;
  let teacherId;
  let legacyGcseId; // Edexcel, GCSE-labelled, MISMATCHED topicKey, correct topic text
  let missingKeyId; // Edexcel, IGCSE, MISSING topicKey, correct topic text
  let correctKeyId; // Edexcel, IGCSE, correct canonical topicKey
  let unrelatedId; // Edexcel, missing topicKey, DIFFERENT topic text
  let aqaGcseId; // AQA control

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Level",
      lastName: "Filter",
      email: "level-filter-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "level-filter-teacher@test.com", password: "password123" });
    teacherToken = loginRes.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    const legacy = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      examBoard: "Edexcel",
      level: "GCSE",
      topic: "Human Male & Female Reproductive Systems",
      topicKey: "edexcel-igcse-biology:human-male-female-reproductive-systems", // mismatched (no "and")
      type: "short",
      marks: 3,
      question: "Label the sperm cell.",
      markScheme: ["Acrosome"],
      status: "published",
    });
    legacyGcseId = String(legacy._id);

    const missingKey = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Human Male and Female Reproductive Systems", // "and" spelled out
      topicKey: null,
      type: "short",
      marks: 2,
      question: "Describe the function of the oviduct.",
      markScheme: ["Site of fertilisation"],
      status: "published",
    });
    missingKeyId = String(missingKey._id);

    const correctKey = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Human Male & Female Reproductive Systems",
      topicKey: REPRO_TOPIC_KEY,
      type: "short",
      marks: 2,
      question: "State where sperm are produced.",
      markScheme: ["Testes"],
      status: "published",
    });
    correctKeyId = String(correctKey._id);

    const unrelated = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Photosynthesis",
      topicKey: null,
      type: "short",
      marks: 2,
      question: "Word equation for photosynthesis?",
      markScheme: ["CO2 + water -> glucose + oxygen"],
      status: "published",
    });
    unrelatedId = String(unrelated._id);

    const aqa = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      topic: "Cell structure",
      topicKey: "aqa-gcse-biology:cell-structure",
      type: "short",
      marks: 2,
      question: "Name an organelle.",
      markScheme: ["Nucleus"],
      status: "published",
    });
    aqaGcseId = String(aqa._id);
  });

  test("IGCSE + Edexcel IGCSE spec finds legacy GCSE-labelled Edexcel question", async () => {
    const res = await request(app)
      .get("/api/exam-questions")
      .query({
        level: "IGCSE",
        examBoard: "Edexcel",
        specKey: "edexcel-igcse-biology",
        mineOnly: "1",
      })
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    const ids = (res.body.questions || []).map((q) => String(q._id));
    expect(ids).toContain(legacyGcseId);
    expect(ids).not.toContain(aqaGcseId);
  });

  test("selector topicKey finds correct-key, mismatched-key AND missing-key questions via topic-text fallback", async () => {
    const res = await request(app)
      .get("/api/exam-questions")
      .query({
        specKey: "edexcel-igcse-biology",
        topicKey: REPRO_TOPIC_KEY,
        examBoard: "Edexcel",
        mineOnly: "1",
      })
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    const ids = (res.body.questions || []).map((q) => String(q._id));
    expect(ids).toContain(correctKeyId);
    expect(ids).toContain(legacyGcseId);
    expect(ids).toContain(missingKeyId);
    // Unrelated same-board topic must NOT leak in via the fallback.
    expect(ids).not.toContain(unrelatedId);
    expect(ids).not.toContain(aqaGcseId);
  });

  test("AQA GCSE filter does not return Edexcel legacy row when level is GCSE", async () => {
    const res = await request(app)
      .get("/api/exam-questions")
      .query({
        level: "GCSE",
        examBoard: "AQA",
        specKey: "aqa-gcse-biology",
        mineOnly: "1",
      })
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    const ids = (res.body.questions || []).map((q) => String(q._id));
    expect(ids).toContain(aqaGcseId);
    expect(ids).not.toContain(legacyGcseId);
  });
});
