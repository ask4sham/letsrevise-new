/**
 * PR-W4.2: Worksheet reports — attempts list + teacher attempt detail (owner vs non-owner).
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

describe("Worksheet Reports (PR-W4.2)", () => {
  let ownerToken;
  let ownerId;
  let otherTeacherToken;
  let otherTeacherId;
  let assignmentId;
  let shareId;
  let attempt1Id;
  let attempt2Id;

  beforeAll(async () => {
    const [owner, otherTeacher] = await Promise.all([
      User.create({
        firstName: "Report",
        lastName: "Owner",
        email: "report-owner@test.com",
        password: hashedPassword,
        userType: "teacher",
      }),
      User.create({
        firstName: "Other",
        lastName: "Teacher",
        email: "report-other-teacher@test.com",
        password: hashedPassword,
        userType: "teacher",
      }),
    ]);
    ownerId = owner._id;
    otherTeacherId = otherTeacher._id;

    const [ownerLogin, otherLogin] = await Promise.all([
      request(app).post("/api/auth/login").send({ email: "report-owner@test.com", password: "password123" }),
      request(app).post("/api/auth/login").send({ email: "report-other-teacher@test.com", password: "password123" }),
    ]);
    ownerToken = ownerLogin.body?.token;
    otherTeacherToken = otherLogin.body?.token;
    if (!ownerToken || !otherTeacherToken) throw new Error("Failed to get tokens");

    const eq = await ExamQuestion.create({
      teacherId: ownerId,
      subject: "Biology",
      type: "mcq",
      marks: 1,
      question: "Test?",
      options: ["A", "B", "C"],
      correctIndex: 0,
      status: "draft",
    });
    const ws = await Worksheet.create({
      ownerId,
      title: "Report Test WS",
      questionItems: [{ examQuestionId: eq._id }],
      status: "PUBLISHED",
    });

    const createRes = await request(app)
      .post("/api/worksheet-assignments")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ worksheetId: ws._id.toString() });
    if (createRes.status !== 201) throw new Error("Failed to create assignment: " + JSON.stringify(createRes.body));
    assignmentId = createRes.body.assignment._id;
    shareId = createRes.body.assignment.shareId;

    const att1Res = await request(app)
      .post(`/api/worksheet-assignments/share/${shareId}/attempts`)
      .send({ studentName: "Student One" });
    attempt1Id = att1Res.body.attemptId;

    const att2Res = await request(app)
      .post(`/api/worksheet-assignments/share/${shareId}/attempts`)
      .send({ studentName: "Student Two" });
    attempt2Id = att2Res.body.attemptId;

    await request(app)
      .post(`/api/worksheet-attempts/${attempt1Id}/submit`)
      .send({
        answers: [{ examQuestionId: eq._id.toString(), answerIndex: 0, shortText: "" }],
      });
  });

  test("owner teacher can fetch attempts list (200, includes both, newest first)", async () => {
    const res = await request(app)
      .get(`/api/worksheet-reports/assignment/${assignmentId}/attempts`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.attempts)).toBe(true);
    expect(res.body.attempts.length).toBe(2);
    // Newest first: submitted attempt (Student One) has more recent updatedAt
    expect(res.body.attempts[0].studentName).toBe("Student One");
    expect(res.body.attempts[0].status).toBe("SUBMITTED");
    expect(res.body.attempts[0].score).toBe(1);
    expect(res.body.attempts[0].maxScore).toBe(1);
    expect(res.body.attempts[1].studentName).toBe("Student Two");
    expect(res.body.attempts[1].status).toBe("IN_PROGRESS");
  });

  test("owner teacher can fetch attempt detail via /teacher (200, attempt + worksheet + questions)", async () => {
    const res = await request(app)
      .get(`/api/worksheet-attempts/${attempt1Id}/teacher`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.attempt).toBeDefined();
    expect(res.body.attempt._id).toBe(attempt1Id);
    expect(res.body.attempt.status).toBe("SUBMITTED");
    expect(res.body.worksheet).toBeDefined();
    expect(res.body.worksheet._id).toBeDefined();
    expect(res.body.worksheet.title).toBe("Report Test WS");
    expect(Array.isArray(res.body.worksheet.questionItems)).toBe(true);
    expect(res.body.questions).toBeDefined();
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBe(1);
    expect(res.body.questions[0].question).toBe("Test?");
    expect(res.body.questions[0].correctIndex).toBe(0);
  });

  test("non-owner teacher gets 403 on attempts list", async () => {
    const res = await request(app)
      .get(`/api/worksheet-reports/assignment/${assignmentId}/attempts`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    expect(res.status).toBe(403);
  });

  test("non-owner teacher gets 403 on attempt detail /teacher", async () => {
    const res = await request(app)
      .get(`/api/worksheet-attempts/${attempt1Id}/teacher`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    expect(res.status).toBe(403);
  });
});
