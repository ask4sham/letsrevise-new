/**
 * PR-W1: Worksheet model + APIs — create (401 if not auth), update items order, owner-only access.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Worksheet = require("../models/Worksheet");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Worksheets API (PR-W1)", () => {
  let teacherToken;
  let teacherId;
  let otherTeacherToken;
  let otherTeacherId;
  let studentToken;

  beforeAll(async () => {
    const [teacher, otherTeacher, student] = await Promise.all([
      User.create({
        firstName: "Worksheet",
        lastName: "Teacher",
        email: "worksheet-teacher@test.com",
        password: hashedPassword,
        userType: "teacher",
      }),
      User.create({
        firstName: "Other",
        lastName: "Teacher",
        email: "other-ws-teacher@test.com",
        password: hashedPassword,
        userType: "teacher",
      }),
      User.create({
        firstName: "Student",
        lastName: "User",
        email: "worksheet-student@test.com",
        password: hashedPassword,
        userType: "student",
      }),
    ]);
    teacherId = teacher._id;
    otherTeacherId = otherTeacher._id;

    const [loginTeacher, loginOther, loginStudent] = await Promise.all([
      request(app).post("/api/auth/login").send({ email: "worksheet-teacher@test.com", password: "password123" }),
      request(app).post("/api/auth/login").send({ email: "other-ws-teacher@test.com", password: "password123" }),
      request(app).post("/api/auth/login").send({ email: "worksheet-student@test.com", password: "password123" }),
    ]);
    teacherToken = loginTeacher.body?.token;
    otherTeacherToken = loginOther.body?.token;
    studentToken = loginStudent.body?.token;
    if (!teacherToken || !otherTeacherToken || !studentToken) throw new Error("Failed to get tokens");
  });

  test("POST /api/worksheets without token returns 401", async () => {
    const res = await request(app)
      .post("/api/worksheets")
      .send({ title: "Test" });
    expect(res.status).toBe(401);
  });

  test("POST /api/worksheets as student returns 403", async () => {
    const res = await request(app)
      .post("/api/worksheets")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ title: "Test" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Teacher|admin/i);
  });

  test("Teacher can create — 201 and default fields", async () => {
    const res = await request(app)
      .post("/api/worksheets")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "My Biology Sheet",
        subject: "Biology",
        examBoard: "AQA",
        level: "GCSE",
        topicKey: "cell-structure",
      });
    expect(res.status).toBe(201);
    expect(res.body.worksheet).toBeDefined();
    expect(res.body.worksheet.title).toBe("My Biology Sheet");
    expect(res.body.worksheet.subject).toBe("Biology");
    expect(res.body.worksheet.examBoard).toBe("AQA");
    expect(res.body.worksheet.level).toBe("GCSE");
    expect(res.body.worksheet.topicKey).toBe("cell-structure");
    expect(res.body.worksheet.status).toBe("DRAFT");
    expect(Array.isArray(res.body.worksheet.questionItems)).toBe(true);
    expect(res.body.worksheet.questionItems.length).toBe(0);
    expect(res.body.worksheet.ownerId).toBeDefined();
  });

  test("Create without title uses default", async () => {
    const res = await request(app)
      .post("/api/worksheets")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.worksheet.title).toBe("Untitled worksheet");
    expect(res.body.worksheet.status).toBe("DRAFT");
    expect(res.body.worksheet.questionItems.length).toBe(0);
  });

  test("Owner can fetch — GET as same teacher → 200", async () => {
    const createRes = await request(app)
      .post("/api/worksheets")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ title: "Fetch Test" });
    expect(createRes.status).toBe(201);
    const id = createRes.body.worksheet._id;
    const getRes = await request(app)
      .get(`/api/worksheets/${id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.worksheet._id).toBe(id);
    expect(getRes.body.worksheet.title).toBe("Fetch Test");
  });

  test("PUT /api/worksheets/:id updates items and order persists", async () => {
    const createRes = await request(app)
      .post("/api/worksheets")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ title: "Order Test" });
    expect(createRes.status).toBe(201);
    const id = createRes.body.worksheet._id;

    const q1 = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "mcq",
      marks: 1,
      question: "Q1?",
      options: ["A", "B"],
      correctIndex: 0,
      status: "draft",
    });
    const q2 = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "mcq",
      marks: 2,
      question: "Q2?",
      options: ["X", "Y"],
      correctIndex: 1,
      status: "draft",
    });

    const order1 = [
      { examQuestionId: q2._id, marksOverride: 3, notes: "Hard" },
      { examQuestionId: q1._id },
    ];
    const putRes = await request(app)
      .put(`/api/worksheets/${id}`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ questionItems: order1 });
    expect(putRes.status).toBe(200);
    expect(putRes.body.worksheet.questionItems.length).toBe(2);
    expect(putRes.body.worksheet.questionItems[0].examQuestionId.toString()).toBe(q2._id.toString());
    expect(putRes.body.worksheet.questionItems[0].marksOverride).toBe(3);
    expect(putRes.body.worksheet.questionItems[0].notes).toBe("Hard");
    expect(putRes.body.worksheet.questionItems[1].examQuestionId.toString()).toBe(q1._id.toString());

    const getRes = await request(app)
      .get(`/api/worksheets/${id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.worksheet.questionItems[0].examQuestionId.toString()).toBe(q2._id.toString());
    expect(getRes.body.worksheet.questionItems[1].examQuestionId.toString()).toBe(q1._id.toString());
  });

  test("PUT with duplicate examQuestionId returns 400", async () => {
    const createRes = await request(app)
      .post("/api/worksheets")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ title: "Duplicate Test" });
    expect(createRes.status).toBe(201);
    const id = createRes.body.worksheet._id;
    const q1 = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "mcq",
      marks: 1,
      question: "Q?",
      options: ["A", "B"],
      correctIndex: 0,
      status: "draft",
    });
    const putRes = await request(app)
      .put(`/api/worksheets/${id}`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        questionItems: [
          { examQuestionId: q1._id },
          { examQuestionId: q1._id },
        ],
      });
    expect(putRes.status).toBe(400);
    expect(putRes.body.error).toBe("Duplicate examQuestionId in questionItems");
  });

  test("PUT with status in body returns 400", async () => {
    const createRes = await request(app)
      .post("/api/worksheets")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ title: "Status Reject" });
    expect(createRes.status).toBe(201);
    const id = createRes.body.worksheet._id;
    const res = await request(app)
      .put(`/api/worksheets/${id}`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ title: "Updated", status: "PUBLISHED" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("status is read-only; use /publish");
  });

  test("GET /api/worksheets/:id by non-owner returns 403", async () => {
    const createRes = await request(app)
      .post("/api/worksheets")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ title: "Private" });
    expect(createRes.status).toBe(201);
    const id = createRes.body.worksheet._id;

    const res = await request(app)
      .get(`/api/worksheets/${id}`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/own|access/i);
  });

  test("PUT /api/worksheets/:id by non-owner returns 403", async () => {
    const createRes = await request(app)
      .post("/api/worksheets")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ title: "Mine" });
    expect(createRes.status).toBe(201);
    const id = createRes.body.worksheet._id;

    const res = await request(app)
      .put(`/api/worksheets/${id}`)
      .set("Authorization", `Bearer ${otherTeacherToken}`)
      .send({ title: "Hacked" });
    expect(res.status).toBe(403);
  });

  test("POST /api/worksheets/:id/publish sets status to PUBLISHED", async () => {
    const createRes = await request(app)
      .post("/api/worksheets")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ title: "To Publish" });
    expect(createRes.status).toBe(201);
    const id = createRes.body.worksheet._id;
    expect(createRes.body.worksheet.status).toBe("DRAFT");

    const res = await request(app)
      .post(`/api/worksheets/${id}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.worksheet.status).toBe("PUBLISHED");
  });

  test("GET /api/worksheets lists only owner worksheets for teacher", async () => {
    const res = await request(app)
      .get("/api/worksheets")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.worksheets)).toBe(true);
    res.body.worksheets.forEach((ws) => {
      expect(ws.ownerId.toString()).toBe(teacherId.toString());
    });
  });
});
