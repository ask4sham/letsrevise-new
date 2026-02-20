/**
 * PR-W6: Needs marking queue — teacher sees attempts with unmarked short answers; disappears after marking.
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

describe("Worksheet Needs Marking (PR-W6)", () => {
  let ownerToken;
  let ownerId;
  let otherTeacherToken;
  let assignmentId;
  let shareId;
  let attemptId;
  let shortId;

  beforeAll(async () => {
    const [owner, otherTeacher] = await Promise.all([
      User.create({
        firstName: "NeedsMark",
        lastName: "Owner",
        email: "needs-mark-owner@test.com",
        password: hashedPassword,
        userType: "teacher",
      }),
      User.create({
        firstName: "Other",
        lastName: "Teacher",
        email: "needs-mark-other@test.com",
        password: hashedPassword,
        userType: "teacher",
      }),
    ]);
    ownerId = owner._id;

    const [ownerLogin, otherLogin] = await Promise.all([
      request(app).post("/api/auth/login").send({ email: "needs-mark-owner@test.com", password: "password123" }),
      request(app).post("/api/auth/login").send({ email: "needs-mark-other@test.com", password: "password123" }),
    ]);
    ownerToken = ownerLogin.body?.token;
    otherTeacherToken = otherLogin.body?.token;
    if (!ownerToken || !otherTeacherToken) throw new Error("Failed to get tokens");

    const short = await ExamQuestion.create({
      teacherId: ownerId,
      subject: "Biology",
      type: "short",
      marks: 2,
      question: "Short answer?",
      status: "draft",
    });
    shortId = short._id.toString();

    const ws = await Worksheet.create({
      ownerId,
      title: "Needs Marking WS",
      questionItems: [{ examQuestionId: short._id }],
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
      .send({ studentName: "Aisha" });
    attemptId = attRes.body.attemptId;

    await request(app).post(`/api/worksheet-attempts/${attemptId}/submit`).send({
      answers: [{ examQuestionId: shortId, answerIndex: null, shortText: "My answer" }],
    });
  }, 15000);

  test("teacher GET needs-marking returns 1 item with unmarkedCount=1", async () => {
    const res = await request(app)
      .get("/api/worksheet-reports/needs-marking")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].attemptId).toBe(attemptId);
    expect(res.body.items[0].unmarkedCount).toBe(1);
    expect(res.body.items[0].totalShortCount).toBe(1);
    expect(res.body.items[0].worksheetTitle).toBe("Needs Marking WS");
    expect(res.body.items[0].studentName).toBe("Aisha");
  });

  test("after marking, GET needs-marking returns empty", async () => {
    await request(app)
      .post(`/api/worksheet-attempts/${attemptId}/mark`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        marks: [{ examQuestionId: shortId, awardedMarks: 1, teacherFeedback: "" }],
      });

    const res = await request(app)
      .get("/api/worksheet-reports/needs-marking")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  test("non-owner teacher gets empty list (filtered by owner)", async () => {
    const res = await request(app)
      .get("/api/worksheet-reports/needs-marking")
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(0);
  });
});
