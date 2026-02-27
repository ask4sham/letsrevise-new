/**
 * PR-Q1 + quizImportFormat: CSV preview uses canonical parser (utils/quizImportFormat).
 * Asserts: valid CSV passes, invalid rows return in invalid[] (row index, reason, raw), no 500.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(15000);

describe("Topic Quiz Questions CSV preview (quizImportFormat)", () => {
  let teacherToken;
  const specKey = "aqa-gcse-biology";
  const topicKey = "diffusion";

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "CSV",
      lastName: "Teacher",
      email: "csv-preview-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "csv-preview-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  });

  test("MCQ with 2 choices passes and appears in preview", async () => {
    const csv = [
      "question,choicea,choiceb,correct",
      "What is diffusion?,Option A,Option B,B",
    ].join("\n");
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, format: "csv", text: csv });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.invalid).toHaveLength(0);
    expect(res.body.summary.validCount).toBeGreaterThanOrEqual(1);
    expect(res.body.previewItems).toBeDefined();
    expect(res.body.previewItems.length).toBeGreaterThanOrEqual(1);
  });

  test("MCQ with 1 choice fails with error mentioning 2-6", async () => {
    const csv = [
      "question,choicea,correct",
      "Only one choice?,Single,A",
    ].join("\n");
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, format: "csv", text: csv });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.invalid).toHaveLength(1);
    expect(res.body.invalid[0].reason).toMatch(/2-6|choices/);
    expect(res.body.invalid[0].index).toBeDefined();
  });

  test("correct out of range fails clearly", async () => {
    const csv = [
      "question,choicea,choiceb,correct",
      "Pick C?,A,B,C",
    ].join("\n");
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, format: "csv", text: csv });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.invalid).toHaveLength(1);
    expect(res.body.invalid[0].reason).toMatch(/correctIndex|range|2-6|choices/);
  });

  test("short-answer with empty acceptableAnswers fails clearly", async () => {
    const csv = [
      "question,acceptable",
      "Name it,",
    ].join("\n");
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, format: "csv", type: "short-answer", text: csv });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.invalid).toHaveLength(1);
    expect(res.body.invalid[0].reason).toMatch(/acceptable|1/);
  });

  test("preview returns invalid[] and does not 500 on mixed valid/invalid rows", async () => {
    const csv = [
      "question,choicea,choiceb,correct",
      "Valid one?,A,B,A",
      ",A,B,A",
      "Another valid?,X,Y,B",
    ].join("\n");
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, format: "csv", text: csv });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.invalid)).toBe(true);
    expect(res.body.summary.validCount).toBe(2);
    expect(res.body.summary.invalidCount).toBe(1);
    expect(res.body.invalid[0]).toMatchObject({
      index: expect.any(Number),
      reason: expect.any(String),
    });
  });
});
