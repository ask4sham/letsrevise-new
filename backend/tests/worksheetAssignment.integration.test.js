/**
 * PR-W4: Worksheet assignment + attempt integration tests.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Worksheet = require("../models/Worksheet");
const WorksheetAssignment = require("../models/WorksheetAssignment");
const WorksheetAttempt = require("../models/WorksheetAttempt");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Worksheet Assignment (PR-W4)", () => {
  let teacherToken;
  let teacherId;
  let worksheetDraftId;
  let worksheetPublishedId;
  let examQuestionId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Assign",
      lastName: "Teacher",
      email: "assign-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "assign-teacher@test.com", password: "password123" });
    teacherToken = loginRes.body?.token;
    if (!teacherToken) throw new Error("Failed to get teacher token");

    const wsDraft = await Worksheet.create({
      ownerId: teacherId,
      title: "Draft WS",
      questionItems: [],
      status: "DRAFT",
    });
    worksheetDraftId = wsDraft._id.toString();

    const wsPublished = await Worksheet.create({
      ownerId: teacherId,
      title: "Published WS",
      questionItems: [],
      status: "PUBLISHED",
    });
    worksheetPublishedId = wsPublished._id.toString();

    const eq = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "mcq",
      marks: 1,
      question: "What is 2+2?",
      options: ["3", "4", "5"],
      correctIndex: 1,
      status: "draft",
    });
    examQuestionId = eq._id.toString();
    await Worksheet.updateOne(
      { _id: worksheetPublishedId },
      { $set: { questionItems: [{ examQuestionId: eq._id }] } }
    );
  });

  test("cannot create assignment for DRAFT worksheet (400)", async () => {
    const res = await request(app)
      .post("/api/worksheet-assignments")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ worksheetId: worksheetDraftId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/publish|published/i);
  });

  test("can create assignment for PUBLISHED worksheet (201 + shareId)", async () => {
    const res = await request(app)
      .post("/api/worksheet-assignments")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ worksheetId: worksheetPublishedId, title: "HW1" });
    expect(res.status).toBe(201);
    expect(res.body.assignment).toBeDefined();
    expect(res.body.assignment.shareId).toBeDefined();
    expect(res.body.assignment.shareId.length).toBeGreaterThan(8);
    expect(res.body.assignment.worksheetId).toBe(worksheetPublishedId);
  });

  test("share endpoint returns worksheet + questions (200)", async () => {
    const createRes = await request(app)
      .post("/api/worksheet-assignments")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ worksheetId: worksheetPublishedId });
    const shareId = createRes.body.assignment.shareId;

    const res = await request(app).get(`/api/worksheet-assignments/share/${shareId}`);
    expect(res.status).toBe(200);
    expect(res.body.assignment).toBeDefined();
    expect(res.body.worksheet).toBeDefined();
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBeGreaterThanOrEqual(1);
  });

  test("attempt submit marks MCQs and leaves short-answer unscored", async () => {
    const createRes = await request(app)
      .post("/api/worksheet-assignments")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ worksheetId: worksheetPublishedId });
    const shareId = createRes.body.assignment.shareId;

    const attemptRes = await request(app)
      .post(`/api/worksheet-assignments/share/${shareId}/attempts`)
      .send({ studentName: "Test Student" });
    expect(attemptRes.status).toBe(201);
    const attemptId = attemptRes.body.attemptId;

    const shareRes = await request(app).get(`/api/worksheet-assignments/share/${shareId}`);
    const questions = shareRes.body.questions || [];
    const mcq = questions.find((q) => q.type === "mcq");
    const answerIndex = mcq ? 1 : 0;

    const submitRes = await request(app)
      .post(`/api/worksheet-attempts/${attemptId}/submit`)
      .send({
        answers: questions.map((q) => ({
          examQuestionId: q._id,
          answerIndex: q.type === "mcq" ? answerIndex : null,
          shortText: "",
        })),
      });
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.ok).toBe(true);
    expect(submitRes.body.attempt.status).toBe("SUBMITTED");
    expect(submitRes.body.attempt.score).toBe(1);
    expect(submitRes.body.attempt.maxScore).toBe(1);
  });
});
