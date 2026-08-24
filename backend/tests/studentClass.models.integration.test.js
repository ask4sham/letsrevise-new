/**
 * Model constraints for StudentClass / Invitation / Membership + STL compatibility.
 */
const mongoose = require("mongoose");
const StudentClass = require("../models/StudentClass");
const StudentClassInvitation = require("../models/StudentClassInvitation");
const StudentClassMembership = require("../models/StudentClassMembership");
const StudentTeacherLink = require("../models/StudentTeacherLink");

jest.setTimeout(30000);

beforeAll(async () => {
  await Promise.all([
    StudentClass.syncIndexes(),
    StudentClassInvitation.syncIndexes(),
    StudentClassMembership.syncIndexes(),
    StudentTeacherLink.syncIndexes(),
  ]);
});

describe("StudentClass model", () => {
  const teacherId = new mongoose.Types.ObjectId();

  afterEach(async () => {
    await StudentClass.deleteMany({ teacherId });
  });

  test("requires owner, name, publicId; valid status; unique publicId", async () => {
    await expect(StudentClass.create({})).rejects.toThrow();

    const cls = await StudentClass.create({ teacherId, name: " Year 10 Bio " });
    expect(cls.name).toBe("Year 10 Bio");
    expect(cls.publicId).toBeTruthy();
    expect(cls.status).toBe("active");

    await expect(
      StudentClass.create({ teacherId, name: "Other", publicId: cls.publicId })
    ).rejects.toThrow();

    await expect(
      StudentClass.create({ teacherId, name: "Bad", status: "deleted" })
    ).rejects.toThrow();
  });
});

describe("StudentClassInvitation model", () => {
  const teacherId = new mongoose.Types.ObjectId();
  const classId = new mongoose.Types.ObjectId();

  afterEach(async () => {
    await StudentClassInvitation.deleteMany({ classId });
  });

  test("unique class/email; statuses; default expiry; studentId optional", async () => {
    const inv = await StudentClassInvitation.create({
      classId,
      teacherId,
      targetEmail: "Student@Ex.COM",
      status: "pending",
    });
    expect(inv.targetEmail).toBe("student@ex.com");
    expect(inv.studentId).toBeNull();
    expect(inv.expiresAt).toBeInstanceOf(Date);
    expect(inv.expiresAt.getTime()).toBeGreaterThan(Date.now());

    await expect(
      StudentClassInvitation.create({
        classId,
        teacherId,
        targetEmail: "student@ex.com",
        status: "pending",
      })
    ).rejects.toThrow();

    for (const status of StudentClassInvitation.STATUSES) {
      const row = await StudentClassInvitation.create({
        classId: new mongoose.Types.ObjectId(),
        teacherId,
        targetEmail: `${status}@ex.com`,
        status,
      });
      expect(row.status).toBe(status);
    }

    expect(StudentClassInvitation.effectiveStatus(inv)).toBe("pending");
    expect(
      StudentClassInvitation.effectiveStatus({
        ...inv.toObject(),
        expiresAt: new Date(Date.now() - 1000),
      })
    ).toBe("expired");
  });
});

describe("StudentClassMembership model", () => {
  const teacherId = new mongoose.Types.ObjectId();
  const classId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();

  afterEach(async () => {
    await StudentClassMembership.deleteMany({ classId });
  });

  test("unique class/student; statuses", async () => {
    const m = await StudentClassMembership.create({
      classId,
      teacherId,
      studentId,
      status: "active",
    });
    expect(m.publicId).toBeTruthy();

    await expect(
      StudentClassMembership.create({
        classId,
        teacherId,
        studentId,
        status: "removed",
      })
    ).rejects.toThrow();

    const m2 = await StudentClassMembership.create({
      classId: new mongoose.Types.ObjectId(),
      teacherId,
      studentId,
      status: "removed",
    });
    expect(m2.status).toBe("removed");
  });
});

describe("StudentTeacherLink compatibility", () => {
  const studentId = new mongoose.Types.ObjectId();
  const teacherId = new mongoose.Types.ObjectId();

  afterEach(async () => {
    await StudentTeacherLink.deleteMany({ studentId, teacherId });
  });

  test("missing status and source remain valid/compatible", async () => {
    const link = await StudentTeacherLink.create({ studentId, teacherId });
    expect(link.status).toBeUndefined();
    expect(link.source).toBeUndefined();
    const lean = await StudentTeacherLink.findById(link._id).lean();
    expect(lean.status).toBeUndefined();
    expect(lean.source).toBeUndefined();
  });
});
