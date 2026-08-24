/**
 * Practice regression: link + active class membership authorisation.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const StudentClass = require("../models/StudentClass");
const StudentClassInvitation = require("../models/StudentClassInvitation");
const StudentClassMembership = require("../models/StudentClassMembership");
const PracticeAttempt = require("../models/PracticeAttempt");
const { hasAcceptedStudentTeacherLink } = require("../utils/hasAcceptedStudentTeacherLink");

jest.setTimeout(60000);

describe("Practice authorisation via hasAcceptedStudentTeacherLink (Phase 2)", () => {
  let teacher;
  let student;
  let studentToken;
  const stamp = Date.now();
  const ids = [];

  beforeAll(async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    [teacher, student] = await Promise.all([
      User.create({
        email: `prac2-link-t-${stamp}@test.com`,
        password: pw,
        firstName: "T",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: `prac2-link-s-${stamp}@test.com`,
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
    await StudentClassMembership.deleteMany({ studentId: student._id });
    await StudentClassInvitation.deleteMany({ teacherId: teacher._id });
    await StudentClass.deleteMany({ teacherId: teacher._id });
    await User.deleteMany({ _id: { $in: ids } });
  });

  afterEach(async () => {
    await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
    await StudentClassMembership.deleteMany({ studentId: student._id });
    await StudentClassInvitation.deleteMany({ teacherId: teacher._id });
    await StudentClass.deleteMany({ teacherId: teacher._id });
    await PracticeAttempt.deleteMany({ studentId: student._id });
  });

  async function submitAttempt(teacherId = teacher._id) {
    return request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-biology:cell-structure",
        contentType: "exam_question",
        contentId: new mongoose.Types.ObjectId().toString(),
        isCorrect: true,
        teacherId: teacherId.toString(),
      });
  }

  async function makeActiveMembership({ archived = false } = {}) {
    const cls = await StudentClass.create({
      teacherId: teacher._id,
      name: "Practice Membership Class",
      status: archived ? "archived" : "active",
      archivedAt: archived ? new Date() : null,
    });
    const membership = await StudentClassMembership.create({
      classId: cls._id,
      teacherId: teacher._id,
      studentId: student._id,
      status: "active",
    });
    return { cls, membership };
  }

  test("legacy StudentTeacherLink authorises", async () => {
    await StudentTeacherLink.create({ studentId: student._id, teacherId: teacher._id });
    expect(await hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })).toBe(
      true
    );
    expect((await submitAttempt()).status).toBe(200);
  });

  test("accepted StudentTeacherLink authorises", async () => {
    await StudentTeacherLink.create({
      studentId: student._id,
      teacherId: teacher._id,
      status: "accepted",
      source: "admin",
    });
    expect((await submitAttempt()).status).toBe(200);
  });

  test("revoked link with no membership denied", async () => {
    await StudentTeacherLink.create({
      studentId: student._id,
      teacherId: teacher._id,
      status: "revoked",
      source: "class",
    });
    expect(await hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })).toBe(
      false
    );
    expect((await submitAttempt()).status).toBe(403);
  });

  test("active class membership authorises", async () => {
    await makeActiveMembership();
    expect(await hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })).toBe(
      true
    );
    expect((await submitAttempt()).status).toBe(200);
  });

  test("archived class membership denied", async () => {
    await makeActiveMembership({ archived: true });
    expect(await hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })).toBe(
      false
    );
    expect((await submitAttempt()).status).toBe(403);
  });

  test("removed membership denied", async () => {
    const { membership } = await makeActiveMembership();
    await StudentClassMembership.updateOne(
      { _id: membership._id },
      { $set: { status: "removed", leftAt: new Date() } }
    );
    expect(await hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })).toBe(
      false
    );
    expect((await submitAttempt()).status).toBe(403);
  });

  test("pending/declined/cancelled/expired invitation denied", async () => {
    const cls = await StudentClass.create({ teacherId: teacher._id, name: "Invite Only" });
    for (const status of ["pending", "declined", "cancelled"]) {
      await StudentClassInvitation.deleteMany({ classId: cls._id });
      await StudentClassInvitation.create({
        classId: cls._id,
        teacherId: teacher._id,
        targetEmail: student.email,
        status,
      });
      expect(
        await hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })
      ).toBe(false);
    }
    await StudentClassInvitation.deleteMany({ classId: cls._id });
    await StudentClassInvitation.create({
      classId: cls._id,
      teacherId: teacher._id,
      targetEmail: student.email,
      status: "pending",
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })).toBe(
      false
    );
    expect((await submitAttempt()).status).toBe(403);
  });

  test("forged teacher ID denied", async () => {
    await makeActiveMembership();
    const forged = new mongoose.Types.ObjectId();
    expect((await submitAttempt(forged)).status).toBe(403);
  });

  test("legacy STL still authorises when unrelated class is archived", async () => {
    await StudentTeacherLink.create({ studentId: student._id, teacherId: teacher._id });
    await makeActiveMembership({ archived: true });
    expect(await hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })).toBe(
      true
    );
    expect((await submitAttempt()).status).toBe(200);
  });

  test("class-source STL alone does not authorise after class archived", async () => {
    const { cls } = await makeActiveMembership({ archived: true });
    await StudentTeacherLink.create({
      studentId: student._id,
      teacherId: teacher._id,
      status: "accepted",
      source: "class",
    });
    void cls;
    expect(await hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })).toBe(
      false
    );
    expect((await submitAttempt()).status).toBe(403);
  });
});
