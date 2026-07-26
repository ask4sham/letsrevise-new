/**
 * Phase 3A: student leave, teacher remove, class-source STL reconciliation.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
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

describe("Class membership removal Phase 3A", () => {
  let teacher;
  let teacherB;
  let student;
  let otherStudent;
  let teacherToken;
  let teacherBToken;
  let studentToken;
  let otherToken;
  const userIds = [];

  beforeAll(async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    const stamp = Date.now();
    [teacher, teacherB, student, otherStudent] = await Promise.all([
      User.create({
        email: `p3a-rm-t-${stamp}@test.com`,
        password: pw,
        firstName: "Tina",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: `p3a-rm-tb-${stamp}@test.com`,
        password: pw,
        firstName: "Bob",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: `p3a-rm-s-${stamp}@test.com`,
        password: pw,
        firstName: "Sam",
        lastName: "Student",
        userType: "student",
      }),
      User.create({
        email: `p3a-rm-o-${stamp}@test.com`,
        password: pw,
        firstName: "Ollie",
        lastName: "Other",
        userType: "student",
      }),
    ]);
    userIds.push(teacher._id, teacherB._id, student._id, otherStudent._id);

    const logins = await Promise.all([
      request(app).post("/api/auth/login").send({ email: teacher.email, password: "Pass123!" }),
      request(app).post("/api/auth/login").send({ email: teacherB.email, password: "Pass123!" }),
      request(app).post("/api/auth/login").send({ email: student.email, password: "Pass123!" }),
      request(app).post("/api/auth/login").send({ email: otherStudent.email, password: "Pass123!" }),
    ]);
    teacherToken = logins[0].body.token;
    teacherBToken = logins[1].body.token;
    studentToken = logins[2].body.token;
    otherToken = logins[3].body.token;
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

  async function makeClass(name) {
    return StudentClass.create({ teacherId: teacher._id, name, status: "active" });
  }

  async function inviteAndAccept(classDoc) {
    const invitation = await StudentClassInvitation.create({
      classId: classDoc._id,
      teacherId: teacher._id,
      targetEmail: student.email,
      status: "pending",
    });
    const accept = await request(app)
      .post(`/api/student-class-invitations/${invitation.publicId}/accept`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(accept.status).toBe(200);
    const membership = await StudentClassMembership.findOne({
      classId: classDoc._id,
      studentId: student._id,
    }).lean();
    return { invitation, membership };
  }

  test("leave/remove reconcile class-source; preserve direct; keep other class", async () => {
    await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
    await StudentClassMembership.deleteMany({ studentId: student._id });

    const classA = await makeClass("Leave A");
    const classB = await makeClass("Leave B");
    const { membership: memA } = await inviteAndAccept(classA);
    const invB = await StudentClassInvitation.create({
      classId: classB._id,
      teacherId: teacher._id,
      targetEmail: student.email,
      status: "pending",
    });
    await request(app)
      .post(`/api/student-class-invitations/${invB.publicId}/accept`)
      .set("Authorization", `Bearer ${studentToken}`);

    const link = await StudentTeacherLink.findOne({
      studentId: student._id,
      teacherId: teacher._id,
    }).lean();
    expect(link.source).toBe("class");
    expect(link.status).toBe("accepted");

    const memB = await StudentClassMembership.findOne({
      classId: classB._id,
      studentId: student._id,
    }).lean();

    const leave = await request(app)
      .delete(`/api/student-class-memberships/${memA.publicId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(leave.status).toBe(200);
    expect(leave.body.membership.status).toBe("removed");
    assertNoRawMongoIds(leave.body);
    expect(await StudentClassInvitation.countDocuments({ classId: classA._id })).toBe(1);
    await expect(
      hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })
    ).resolves.toBe(true);

    const remove = await request(app)
      .delete(`/api/student-classes/${classB.publicId}/students/${memB.publicId}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(remove.status).toBe(200);
    expect(remove.body.membership.status).toBe("removed");

    const linkEnd = await StudentTeacherLink.findOne({
      studentId: student._id,
      teacherId: teacher._id,
    }).lean();
    expect(linkEnd.status).toBe("revoked");
    expect(linkEnd.source).toBe("class");
    await expect(
      hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })
    ).resolves.toBe(false);

    expect(
      (
        await request(app)
          .delete(`/api/student-class-memberships/${memA.publicId}`)
          .set("Authorization", `Bearer ${studentToken}`)
      ).status
    ).toBe(200);
    expect(
      (
        await request(app)
          .delete(`/api/student-classes/${classB.publicId}/students/${memB.publicId}`)
          .set("Authorization", `Bearer ${teacherToken}`)
      ).status
    ).toBe(200);

    expect(
      (
        await request(app)
          .delete(`/api/student-class-memberships/${memA.publicId}`)
          .set("Authorization", `Bearer ${otherToken}`)
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete(`/api/student-class-memberships/${memA.publicId}`)
          .set("Authorization", `Bearer ${teacherToken}`)
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .delete(`/api/student-classes/${classB.publicId}/students/${memB.publicId}`)
          .set("Authorization", `Bearer ${studentToken}`)
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .delete(`/api/student-classes/${classB.publicId}/students/${memB.publicId}`)
          .set("Authorization", `Bearer ${teacherBToken}`)
      ).status
    ).toBe(404);

    await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
    await StudentClassMembership.deleteMany({ studentId: student._id });
    const classC = await makeClass("Direct Preserve");
    await StudentTeacherLink.create({
      studentId: student._id,
      teacherId: teacher._id,
      status: "accepted",
      source: "direct",
    });
    const memC = await StudentClassMembership.create({
      classId: classC._id,
      teacherId: teacher._id,
      studentId: student._id,
      status: "active",
    });
    await request(app)
      .delete(`/api/student-class-memberships/${memC.publicId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    const direct = await StudentTeacherLink.findOne({
      studentId: student._id,
      teacherId: teacher._id,
    }).lean();
    expect(direct.source).toBe("direct");
    expect(direct.status).toBe("accepted");
    await expect(
      hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })
    ).resolves.toBe(true);
  });
});
