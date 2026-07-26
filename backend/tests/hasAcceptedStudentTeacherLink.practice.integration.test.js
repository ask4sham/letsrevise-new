/**
 * Practice regression: accepted-link helper + invitation alone never authorises.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const StudentClass = require("../models/StudentClass");
const StudentClassInvitation = require("../models/StudentClassInvitation");
const PracticeAttempt = require("../models/PracticeAttempt");
const { hasAcceptedStudentTeacherLink } = require("../utils/hasAcceptedStudentTeacherLink");

jest.setTimeout(60000);

describe("Practice authorisation via hasAcceptedStudentTeacherLink", () => {
  let teacher;
  let student;
  let studentToken;
  const stamp = Date.now();
  const ids = [];

  beforeAll(async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    [teacher, student] = await Promise.all([
      User.create({
        email: `prac-link-t-${stamp}@test.com`,
        password: pw,
        firstName: "T",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: `prac-link-s-${stamp}@test.com`,
        password: pw,
        firstName: "S",
        lastName: "Student",
        userType: "student",
      }),
    ]);
    ids.push(teacher._id, student._id);
    const login = await request(app).post("/api/auth/login").send({
      email: student.email,
      password: "Pass123!",
    });
    studentToken = login.body.token;
  });

  afterAll(async () => {
    await PracticeAttempt.deleteMany({ studentId: student._id });
    await StudentTeacherLink.deleteMany({ studentId: student._id });
    await StudentClassInvitation.deleteMany({ teacherId: teacher._id });
    await StudentClass.deleteMany({ teacherId: teacher._id });
    await User.deleteMany({ _id: { $in: ids } });
  });

  afterEach(async () => {
    await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
    await PracticeAttempt.deleteMany({ studentId: student._id });
  });

  async function submitAttempt() {
    return request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-biology:cell-structure",
        contentType: "exam_question",
        contentId: new mongoose.Types.ObjectId().toString(),
        isCorrect: true,
        teacherId: teacher._id.toString(),
      });
  }

  test("legacy missing-status link authorises", async () => {
    await StudentTeacherLink.create({ studentId: student._id, teacherId: teacher._id });
    await expect(
      hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })
    ).resolves.toBe(true);
    const res = await submitAttempt();
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("accepted status authorises", async () => {
    await StudentTeacherLink.create({
      studentId: student._id,
      teacherId: teacher._id,
      status: "accepted",
      source: "admin",
    });
    const res = await submitAttempt();
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("revoked link does not authorise", async () => {
    await StudentTeacherLink.create({
      studentId: student._id,
      teacherId: teacher._id,
      status: "revoked",
      source: "class",
    });
    await expect(
      hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })
    ).resolves.toBe(false);
    const res = await submitAttempt();
    expect(res.status).toBe(403);
  });

  test("pending invitation alone does not authorise", async () => {
    const cls = await StudentClass.create({
      teacherId: teacher._id,
      name: "Pending Invite Class",
    });
    await StudentClassInvitation.create({
      classId: cls._id,
      teacherId: teacher._id,
      targetEmail: student.email,
      status: "pending",
    });
    await expect(
      hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })
    ).resolves.toBe(false);
    const res = await submitAttempt();
    expect(res.status).toBe(403);
  });
});
