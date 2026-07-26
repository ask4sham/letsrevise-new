/**
 * Phase 3A: class update/archive, CSV preview, resend.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const StudentClass = require("../models/StudentClass");
const StudentClassInvitation = require("../models/StudentClassInvitation");
const StudentClassMembership = require("../models/StudentClassMembership");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const { hasAcceptedStudentTeacherLink } = require("../utils/hasAcceptedStudentTeacherLink");

jest.setTimeout(90000);

function assertNoRawMongoIds(obj) {
  const json = JSON.stringify(obj);
  expect(json).not.toMatch(/"_id"/);
  expect(json).not.toMatch(/"teacherId"/);
  expect(json).not.toMatch(/"classId"/);
  expect(json).not.toMatch(/"studentId"/);
}

describe("Class linking Phase 3A lifecycle", () => {
  let teacher;
  let teacherB;
  let student;
  let teacherToken;
  let teacherBToken;
  let studentToken;
  const userIds = [];

  beforeAll(async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    const stamp = Date.now();
    [teacher, teacherB, student] = await Promise.all([
      User.create({
        email: `p3a-life-t-${stamp}@test.com`,
        password: pw,
        firstName: "Tina",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: `p3a-life-tb-${stamp}@test.com`,
        password: pw,
        firstName: "Bob",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: `p3a-life-s-${stamp}@test.com`,
        password: pw,
        firstName: "Sam",
        lastName: "Student",
        userType: "student",
      }),
    ]);
    userIds.push(teacher._id, teacherB._id, student._id);

    const logins = await Promise.all([
      request(app).post("/api/auth/login").send({ email: teacher.email, password: "Pass123!" }),
      request(app).post("/api/auth/login").send({ email: teacherB.email, password: "Pass123!" }),
      request(app).post("/api/auth/login").send({ email: student.email, password: "Pass123!" }),
    ]);
    teacherToken = logins[0].body.token;
    teacherBToken = logins[1].body.token;
    studentToken = logins[2].body.token;
  });

  afterAll(async () => {
    await StudentTeacherLink.deleteMany({
      $or: [{ studentId: { $in: userIds } }, { teacherId: { $in: userIds } }],
    });
    await StudentClassMembership.deleteMany({
      $or: [{ studentId: { $in: userIds } }, { teacherId: { $in: userIds } }],
    });
    await StudentClassInvitation.deleteMany({ teacherId: { $in: userIds } });
    await StudentClass.deleteMany({ teacherId: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  });

  async function makeClass(name = "P3A Class") {
    return StudentClass.create({
      teacherId: teacher._id,
      name,
      status: "active",
    });
  }

  test("owner updates class; forbidden fields blocked", async () => {
    const cls = await makeClass("Update Me");
    expect(
      (
        await request(app)
          .patch(`/api/student-classes/${cls.publicId}`)
          .set("Authorization", `Bearer ${teacherToken}`)
          .send({ name: "X", teacherId: new mongoose.Types.ObjectId().toString() })
      ).status
    ).toBe(400);

    const ok = await request(app)
      .patch(`/api/student-classes/${cls.publicId}`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        name: "Updated Name",
        description: "Desc",
        subject: "Biology",
        examBoard: "AQA",
        specKey: "aqa-gcse-biology",
      });
    expect(ok.status).toBe(200);
    expect(ok.body.class.name).toBe("Updated Name");
    expect(ok.body.class.board).toBe("AQA");
    assertNoRawMongoIds(ok.body);

    expect(
      (
        await request(app)
          .patch(`/api/student-classes/${cls.publicId}`)
          .set("Authorization", `Bearer ${teacherBToken}`)
          .send({ name: "Hijack" })
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/api/student-classes/${cls.publicId}`)
          .set("Authorization", `Bearer ${studentToken}`)
          .send({ name: "Nope" })
      ).status
    ).toBe(403);
  });

  test("archive blocks invite/resend/accept; legacy direct still authorises", async () => {
    const cls = await makeClass("Archive Me");
    const inv = await StudentClassInvitation.create({
      classId: cls._id,
      teacherId: teacher._id,
      targetEmail: student.email,
      status: "pending",
    });

    const arch = await request(app)
      .post(`/api/student-classes/${cls.publicId}/archive`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(arch.status).toBe(200);
    expect(arch.body.class.status).toBe("archived");

    expect(
      (
        await request(app)
          .post(`/api/student-classes/${cls.publicId}/archive`)
          .set("Authorization", `Bearer ${teacherToken}`)
      ).status
    ).toBe(200);

    expect(
      (
        await request(app)
          .post(`/api/student-classes/${cls.publicId}/invitations`)
          .set("Authorization", `Bearer ${teacherToken}`)
          .send({ emails: ["x@ex.com"] })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`/api/student-classes/${cls.publicId}/invitations/${inv.publicId}/resend`)
          .set("Authorization", `Bearer ${teacherToken}`)
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`/api/student-class-invitations/${inv.publicId}/accept`)
          .set("Authorization", `Bearer ${studentToken}`)
      ).status
    ).toBe(409);

    const withMember = await makeClass("Archive With Member");
    const invitation = await StudentClassInvitation.create({
      classId: withMember._id,
      teacherId: teacher._id,
      targetEmail: student.email,
      status: "pending",
    });
    expect(
      (
        await request(app)
          .post(`/api/student-class-invitations/${invitation.publicId}/accept`)
          .set("Authorization", `Bearer ${studentToken}`)
      ).status
    ).toBe(200);
    await request(app)
      .post(`/api/student-classes/${withMember.publicId}/archive`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(
      await StudentClassMembership.countDocuments({
        classId: withMember._id,
        studentId: student._id,
      })
    ).toBe(1);
    await expect(
      hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })
    ).resolves.toBe(false);

    await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
    await StudentTeacherLink.create({ studentId: student._id, teacherId: teacher._id });
    await expect(
      hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })
    ).resolves.toBe(true);
    await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
    await StudentClassMembership.deleteMany({ studentId: student._id });
  });

  test("CSV preview is syntax-only with ownership guards", async () => {
    const cls = await makeClass("CSV Class");
    const known = student.email;
    const unknown = `ghost-${Date.now()}@example.com`;
    const csv = `email,firstName\n${known},Sam\n${unknown},Ghost\nbad\n${known},Dup\n`;
    const before = await StudentClassInvitation.countDocuments({ classId: cls._id });

    const res = await request(app)
      .post(`/api/student-classes/${cls.publicId}/invitations/csv/preview`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .attach("file", Buffer.from(csv, "utf8"), "students.csv");
    expect(res.status).toBe(200);
    expect(res.body.summary.validCount).toBe(2);
    expect(res.body.summary.duplicateCount).toBe(1);
    expect(res.body.summary.invalidCount).toBe(1);
    assertNoRawMongoIds(res.body);
    expect(await StudentClassInvitation.countDocuments({ classId: cls._id })).toBe(before);

    expect(
      (
        await request(app)
          .post(`/api/student-classes/${cls.publicId}/invitations/csv/preview`)
          .set("Authorization", `Bearer ${teacherBToken}`)
          .attach("file", Buffer.from("email\na@ex.com\n"), "x.csv")
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(`/api/student-classes/${cls.publicId}/invitations/csv/preview`)
          .set("Authorization", `Bearer ${studentToken}`)
          .attach("file", Buffer.from("email\na@ex.com\n"), "x.csv")
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/api/student-classes/${cls.publicId}/invitations/csv/preview`)
          .set("Authorization", `Bearer ${teacherToken}`)
          .attach("file", Buffer.from("email\na@ex.com\n"), "notes.txt")
      ).status
    ).toBe(400);
  });

  test("resend declines/cancels/expiry; accepted 409; archived blocked", async () => {
    const cls = await makeClass("Resend Class");
    const declined = await StudentClassInvitation.create({
      classId: cls._id,
      teacherId: teacher._id,
      targetEmail: "declined@ex.com",
      status: "declined",
      respondedAt: new Date(),
      studentId: student._id,
    });
    const res = await request(app)
      .post(`/api/student-classes/${cls.publicId}/invitations/${declined.publicId}/resend`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.invitation.status).toBe("pending");

    const cancelled = await StudentClassInvitation.create({
      classId: cls._id,
      teacherId: teacher._id,
      targetEmail: "cancelled@ex.com",
      status: "cancelled",
    });
    expect(
      (
        await request(app)
          .post(`/api/student-classes/${cls.publicId}/invitations/${cancelled.publicId}/resend`)
          .set("Authorization", `Bearer ${teacherToken}`)
      ).status
    ).toBe(200);

    const expired = await StudentClassInvitation.create({
      classId: cls._id,
      teacherId: teacher._id,
      targetEmail: "expired@ex.com",
      status: "pending",
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(
      (
        await request(app)
          .post(`/api/student-classes/${cls.publicId}/invitations/${expired.publicId}/resend`)
          .set("Authorization", `Bearer ${teacherToken}`)
      ).status
    ).toBe(200);

    const accepted = await StudentClassInvitation.create({
      classId: cls._id,
      teacherId: teacher._id,
      targetEmail: "accepted@ex.com",
      status: "accepted",
      studentId: student._id,
    });
    expect(
      (
        await request(app)
          .post(`/api/student-classes/${cls.publicId}/invitations/${accepted.publicId}/resend`)
          .set("Authorization", `Bearer ${teacherToken}`)
      ).status
    ).toBe(409);

    await StudentClass.updateOne(
      { _id: cls._id },
      { $set: { status: "archived", archivedAt: new Date() } }
    );
    const pending = await StudentClassInvitation.create({
      classId: cls._id,
      teacherId: teacher._id,
      targetEmail: "pending-arch@ex.com",
      status: "pending",
    });
    expect(
      (
        await request(app)
          .post(`/api/student-classes/${cls.publicId}/invitations/${pending.publicId}/resend`)
          .set("Authorization", `Bearer ${teacherToken}`)
      ).status
    ).toBe(400);
  });
});
