/**
 * PR-W5: Short-answer marking — recalc score, status MARKED, validation, non-owner 403.
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

describe("Worksheet Marking (PR-W5)", () => {
  let ownerToken;
  let ownerId;
  let otherTeacherToken;
  let assignmentId;
  let shareId;
  let attemptId;
  let mcqId;
  let shortId;

  beforeAll(async () => {
    const [owner, otherTeacher] = await Promise.all([
      User.create({
        firstName: "Mark",
        lastName: "Owner",
        email: "mark-owner@test.com",
        password: hashedPassword,
        userType: "teacher",
      }),
      User.create({
        firstName: "Other",
        lastName: "Teacher",
        email: "mark-other-teacher@test.com",
        password: hashedPassword,
        userType: "teacher",
      }),
    ]);
    ownerId = owner._id;

    const [ownerLogin, otherLogin] = await Promise.all([
      request(app).post("/api/auth/login").send({ email: "mark-owner@test.com", password: "password123" }),
      request(app).post("/api/auth/login").send({ email: "mark-other-teacher@test.com", password: "password123" }),
    ]);
    ownerToken = ownerLogin.body?.token;
    otherTeacherToken = otherLogin.body?.token;
    if (!ownerToken || !otherTeacherToken) throw new Error("Failed to get tokens");

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
      title: "Marking Test WS",
      questionItems: [
        { examQuestionId: mcq._id },
        { examQuestionId: short._id },
      ],
      status: "PUBLISHED",
    });

    const createRes = await request(app)
      .post("/api/worksheet-assignments")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ worksheetId: ws._id.toString() });
    if (createRes.status !== 201) throw new Error("Failed to create assignment: " + JSON.stringify(createRes.body));
    assignmentId = createRes.body.assignment._id;
    shareId = createRes.body.assignment.shareId;

    const attRes = await request(app)
      .post(`/api/worksheet-assignments/share/${shareId}/attempts`)
      .send({ studentName: "Student" });
    attemptId = attRes.body.attemptId;

    await request(app).post(`/api/worksheet-attempts/${attemptId}/submit`).send({
      answers: [
        { examQuestionId: mcqId, answerIndex: 0, shortText: "" },
        { examQuestionId: shortId, answerIndex: null, shortText: "My answer" },
      ],
    });
  });

  test("after submit: score 1, maxScore 3, status SUBMITTED", async () => {
    const res = await request(app)
      .get(`/api/worksheet-attempts/${attemptId}/teacher`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.attempt.status).toBe("SUBMITTED");
    expect(res.body.attempt.score).toBe(1);
    expect(res.body.attempt.maxScore).toBe(3);
  });

  test("teacher marks short as 2: score 3, status MARKED", async () => {
    const res = await request(app)
      .post(`/api/worksheet-attempts/${attemptId}/mark`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        marks: [
          { examQuestionId: shortId, awardedMarks: 2, teacherFeedback: "Good." },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.attempt).toBeDefined();
    expect(res.body.attempt.status).toBe("MARKED");
    expect(res.body.attempt.score).toBe(3);
    expect(res.body.attempt.maxScore).toBe(3);
    const shortAns = res.body.attempt.answers.find((a) => String(a.examQuestionId) === shortId);
    expect(shortAns).toBeDefined();
    expect(shortAns.awardedMarks).toBe(2);
    expect(shortAns.teacherFeedback).toBe("Good.");
    expect(shortAns.markedAt).toBeDefined();
  });

  test("awardedMarks > question.marks returns 400", async () => {
    const res = await request(app)
      .post(`/api/worksheet-attempts/${attemptId}/mark`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        marks: [{ examQuestionId: shortId, awardedMarks: 99, teacherFeedback: "" }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/0 and 2|between/);
  });

  test("marking MCQ via mark endpoint returns 400", async () => {
    const res = await request(app)
      .post(`/api/worksheet-attempts/${attemptId}/mark`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        marks: [{ examQuestionId: mcqId, awardedMarks: 1, teacherFeedback: "" }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/MCQ|auto-scored/i);
  });

  test("non-owner teacher gets 404 on mark (no existence leak)", async () => {
    const res = await request(app)
      .post(`/api/worksheet-attempts/${attemptId}/mark`)
      .set("Authorization", `Bearer ${otherTeacherToken}`)
      .send({
        marks: [{ examQuestionId: shortId, awardedMarks: 1, teacherFeedback: "" }],
      });
    expect(res.status).toBe(404);
  });
});
