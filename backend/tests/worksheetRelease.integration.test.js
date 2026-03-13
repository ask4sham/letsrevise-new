/**
 * PR-W7: Release results to students — locked until teacher releases; then score/feedback visible.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Worksheet = require("../models/Worksheet");
const WorksheetAssignment = require("../models/WorksheetAssignment");
const WorksheetAttempt = require("../models/WorksheetAttempt");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(20000);

describe("Worksheet Release (PR-W7)", () => {
  let ownerToken;
  let ownerId;
  let assignmentId;
  let shareId;
  let attemptId;
  let mcqId;
  let shortId;

  beforeAll(async () => {
    const owner = await User.create({
      firstName: "Release",
      lastName: "Owner",
      email: "release-owner@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const loginRes = await request(app).post("/api/auth/login").send({
      email: "release-owner@test.com",
      password: "password123",
    });
    ownerToken = loginRes.body?.token;
    if (!ownerToken) throw new Error("Failed to get token");

    const mcq = await ExamQuestion.create({
      teacherId: ownerId,
      subject: "Biology",
      type: "mcq",
      marks: 1,
      question: "MCQ?",
      options: ["A", "B"],
      correctIndex: 0,
      status: "draft",
    });
    mcqId = mcq._id.toString();

    const short = await ExamQuestion.create({
      teacherId: ownerId,
      subject: "Biology",
      type: "short",
      marks: 2,
      question: "Short?",
      status: "draft",
    });
    shortId = short._id.toString();

    const ws = await Worksheet.create({
      ownerId,
      title: "Release Test WS",
      questionItems: [{ examQuestionId: mcq._id }, { examQuestionId: short._id }],
      status: "PUBLISHED",
    });

    const createRes = await request(app)
      .post("/api/worksheet-assignments")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ worksheetId: ws._id.toString() });
    if (createRes.status !== 201) throw new Error("Failed to create assignment");
    assignmentId = createRes.body.assignment._id;
    shareId = createRes.body.assignment.shareId;

    const attRes = await request(app)
      .post(`/api/worksheet-assignments/share/${shareId}/attempts`)
      .send({ studentName: "Student" });
    attemptId = attRes.body.attemptId;

    await request(app).post(`/api/worksheet-attempts/${attemptId}/submit`).send({
      answers: [
        { examQuestionId: mcqId, answerIndex: 0, shortText: "" },
        { examQuestionId: shortId, answerIndex: null, shortText: "Answer" },
      ],
    });

    await request(app)
      .post(`/api/worksheet-attempts/${attemptId}/mark`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        marks: [{ examQuestionId: shortId, awardedMarks: 1, teacherFeedback: "Good." }],
      });
  });

  test("as student/anonymous GET attempt returns resultsLocked true, no score/awardedMarks", async () => {
    const res = await request(app).get(`/api/worksheet-attempts/${attemptId}`);
    expect(res.status).toBe(200);
    expect(res.body.attempt).toBeDefined();
    expect(res.body.attempt.resultsLocked).toBe(true);
    expect(res.body.attempt.score).toBeNull();
    expect(res.body.attempt.maxScore).toBeNull();
    const shortAns = res.body.attempt.answers.find((a) => String(a.examQuestionId) === shortId);
    expect(shortAns).toBeDefined();
    expect(shortAns.awardedMarks).toBeUndefined();
    expect(shortAns.teacherFeedback).toBeUndefined();
  });

  test("teacher POST release returns isReleased true", async () => {
    const res = await request(app)
      .post(`/api/worksheet-attempts/${attemptId}/release`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.attempt).toBeDefined();
    expect(res.body.attempt.isReleased).toBe(true);
    expect(res.body.attempt.releasedAt).toBeDefined();
  });

  test("as student GET after release includes score, maxScore, awardedMarks and feedback", async () => {
    const res = await request(app).get(`/api/worksheet-attempts/${attemptId}`);
    expect(res.status).toBe(200);
    expect(res.body.attempt).toBeDefined();
    expect(res.body.attempt.resultsLocked).toBeUndefined();
    expect(res.body.attempt.score).toBe(2);
    expect(res.body.attempt.maxScore).toBe(3);
    const shortAns = res.body.attempt.answers.find((a) => String(a.examQuestionId) === shortId);
    expect(shortAns).toBeDefined();
    expect(shortAns.awardedMarks).toBe(1);
    expect(shortAns.teacherFeedback).toBe("Good.");
  });
});
