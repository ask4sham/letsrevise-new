/**
 * PR-W4.3: Close assignment — share returns isActive, attempts/save/submit reject when closed.
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

jest.setTimeout(15000);

describe("Worksheet Assignments Close (PR-W4.3)", () => {
  let ownerToken;
  let ownerId;
  let assignmentId;
  let shareId;
  let attemptInProgressId;

  beforeAll(async () => {
    const owner = await User.create({
      firstName: "Close",
      lastName: "Owner",
      email: "close-owner@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const loginRes = await request(app).post("/api/auth/login").send({
      email: "close-owner@test.com",
      password: "password123",
    });
    ownerToken = loginRes.body?.token;
    if (!ownerToken) throw new Error("Failed to get token");

    const eq = await ExamQuestion.create({
      teacherId: ownerId,
      subject: "Biology",
      type: "mcq",
      marks: 1,
      question: "Closed test?",
      options: ["Yes", "No"],
      correctIndex: 0,
      status: "draft",
    });
    const ws = await Worksheet.create({
      ownerId,
      title: "Close Test WS",
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
  });

  test("share GET returns 200 with isActive true before close", async () => {
    const res = await request(app).get(`/api/worksheet-assignments/share/${shareId}`);
    expect(res.status).toBe(200);
    expect(res.body.assignment).toBeDefined();
    expect(res.body.assignment.isActive).toBe(true);
  });

  test("owner teacher can close assignment (200, GET /:id shows isActive false)", async () => {
    const closeRes = await request(app)
      .post(`/api/worksheet-assignments/${assignmentId}/close`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.assignment?.isActive).toBe(false);

    const getRes = await request(app)
      .get(`/api/worksheet-assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.assignment).toBeDefined();
    expect(getRes.body.assignment.isActive).toBe(false);
  });

  test("share GET returns 200 with isActive false after close", async () => {
    const res = await request(app).get(`/api/worksheet-assignments/share/${shareId}`);
    expect(res.status).toBe(200);
    expect(res.body.assignment).toBeDefined();
    expect(res.body.assignment.isActive).toBe(false);
  });

  test("POST share/:shareId/attempts returns 403 when assignment closed", async () => {
    const res = await request(app)
      .post(`/api/worksheet-assignments/share/${shareId}/attempts`)
      .send({ studentName: "Student" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/closed/i);
  });
});

describe("Worksheet Assignments Close — save/submit (PR-W4.3)", () => {
  let ownerToken;
  let ownerId;
  let assignmentId;
  let shareId;
  let attemptId;
  let examQuestionId;

  beforeAll(async () => {
    const owner = await User.create({
      firstName: "CloseSave",
      lastName: "Owner",
      email: "close-save-owner@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const loginRes = await request(app).post("/api/auth/login").send({
      email: "close-save-owner@test.com",
      password: "password123",
    });
    ownerToken = loginRes.body?.token;
    if (!ownerToken) throw new Error("Failed to get token");

    const eq = await ExamQuestion.create({
      teacherId: ownerId,
      subject: "Biology",
      type: "mcq",
      marks: 1,
      question: "Save close test?",
      options: ["A", "B"],
      correctIndex: 0,
      status: "draft",
    });
    const ws = await Worksheet.create({
      ownerId,
      title: "Close Save WS",
      questionItems: [{ examQuestionId: eq._id }],
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
      .send({ studentName: "In Progress" });
    attemptId = attRes.body.attemptId;

    await request(app)
      .post(`/api/worksheet-assignments/${assignmentId}/close`)
      .set("Authorization", `Bearer ${ownerToken}`);
  });

  test("POST save returns 403 when assignment closed", async () => {
    const res = await request(app)
      .post(`/api/worksheet-attempts/${attemptId}/save`)
      .send({ answers: [] });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/closed/i);
  });

  test("POST submit returns 403 when assignment closed", async () => {
    const res = await request(app)
      .post(`/api/worksheet-attempts/${attemptId}/submit`)
      .send({ answers: [{ examQuestionId, answerIndex: 0, shortText: "" }] });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/closed/i);
  });
});
