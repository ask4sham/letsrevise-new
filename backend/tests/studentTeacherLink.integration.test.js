/**
 * PR-PRACTICE-LOOP-1 Slice 3: Student–teacher link — create via admin/teacher; enforce on practice flows.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const PracticeAttempt = require("../models/PracticeAttempt");

jest.setTimeout(20000);

describe("Student-teacher link", () => {
  let teacherToken;
  let teacherId;
  let studentId;

  afterAll(async () => {
    await PracticeAttempt.deleteMany({ studentId });
    await StudentTeacherLink.deleteMany({ studentId });
  });

  test("teacher can create link via POST /api/admin/student-teacher-links", async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    const [teacher, student] = await Promise.all([
      User.create({
        email: "link-teacher@test.com",
        password: pw,
        firstName: "T",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: "link-student@test.com",
        password: pw,
        firstName: "S",
        lastName: "Student",
        userType: "student",
      }),
    ]);
    teacherId = teacher._id;
    studentId = student._id;

    const login = await request(app).post("/api/auth/login").send({
      email: "link-teacher@test.com",
      password: "Pass123!",
    });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Teacher login failed");

    const res = await request(app)
      .post("/api/admin/student-teacher-links")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ studentId: studentId.toString(), teacherId: teacherId.toString() });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.linkId).toBeDefined();

    const link = await StudentTeacherLink.findOne({ studentId, teacherId }).lean();
    expect(link).toBeTruthy();
  });

  test("after link created, student can submit practice attempt", async () => {
    const studentLogin = await request(app).post("/api/auth/login").send({
      email: "link-student@test.com",
      password: "Pass123!",
    });
    const studentToken = studentLogin.body?.token;

    const contentId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-biology:cell-structure",
        contentType: "exam_question",
        contentId: contentId.toString(),
        isCorrect: true,
        teacherId: teacherId.toString(),
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.attemptId).toBeDefined();
    expect(res.body.isCorrect).toBe(true);
  });
});
