/**
 * Unit: canonical Practice link + membership helper (mocked models).
 */
const mongoose = require("mongoose");

jest.mock("../models/StudentTeacherLink", () => ({
  findOne: jest.fn(),
}));
jest.mock("../models/StudentClassMembership", () => ({
  find: jest.fn(),
}));
jest.mock("../models/StudentClass", () => ({
  findOne: jest.fn(),
}));

const StudentTeacherLink = require("../models/StudentTeacherLink");
const StudentClassMembership = require("../models/StudentClassMembership");
const StudentClass = require("../models/StudentClass");
const { hasAcceptedStudentTeacherLink } = require("../utils/hasAcceptedStudentTeacherLink");

function leanOne(doc) {
  return {
    select: () => ({
      lean: async () => doc,
    }),
  };
}

function leanFind(docs) {
  return {
    select: () => ({
      lean: async () => docs,
    }),
  };
}

describe("hasAcceptedStudentTeacherLink", () => {
  const studentId = new mongoose.Types.ObjectId();
  const teacherId = new mongoose.Types.ObjectId();
  const classId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    StudentTeacherLink.findOne.mockReset();
    StudentClassMembership.find.mockReset();
    StudentClass.findOne.mockReset();
  });

  test("legacy missing status accepted", async () => {
    StudentTeacherLink.findOne.mockReturnValue(leanOne({ status: undefined }));
    await expect(hasAcceptedStudentTeacherLink({ studentId, teacherId })).resolves.toBe(true);
  });

  test("explicit accepted link accepted", async () => {
    StudentTeacherLink.findOne.mockReturnValue(leanOne({ status: "accepted", source: "admin" }));
    await expect(hasAcceptedStudentTeacherLink({ studentId, teacherId })).resolves.toBe(true);
  });

  test("revoked link with no membership denied", async () => {
    StudentTeacherLink.findOne.mockReturnValue(leanOne({ status: "revoked" }));
    StudentClassMembership.find.mockReturnValue(leanFind([]));
    await expect(hasAcceptedStudentTeacherLink({ studentId, teacherId })).resolves.toBe(false);
  });

  test("active membership accepted", async () => {
    StudentTeacherLink.findOne.mockReturnValue(leanOne(null));
    StudentClassMembership.find.mockReturnValue(leanFind([{ classId }]));
    StudentClass.findOne.mockReturnValue(leanOne({ _id: classId }));
    await expect(hasAcceptedStudentTeacherLink({ studentId, teacherId })).resolves.toBe(true);
  });

  test("removed membership denied", async () => {
    StudentTeacherLink.findOne.mockReturnValue(leanOne(null));
    StudentClassMembership.find.mockReturnValue(leanFind([]));
    await expect(hasAcceptedStudentTeacherLink({ studentId, teacherId })).resolves.toBe(false);
  });

  test("active membership in archived class denied", async () => {
    StudentTeacherLink.findOne.mockReturnValue(leanOne(null));
    StudentClassMembership.find.mockReturnValue(leanFind([{ classId }]));
    StudentClass.findOne.mockReturnValue(leanOne(null));
    await expect(hasAcceptedStudentTeacherLink({ studentId, teacherId })).resolves.toBe(false);
  });

  test("class-source accepted link requires active membership in active class", async () => {
    StudentTeacherLink.findOne.mockReturnValue(leanOne({ status: "accepted", source: "class" }));
    StudentClassMembership.find.mockReturnValue(leanFind([{ classId }]));
    StudentClass.findOne.mockReturnValue(leanOne(null)); // archived / missing
    await expect(hasAcceptedStudentTeacherLink({ studentId, teacherId })).resolves.toBe(false);
  });

  test("revoked direct link plus active class membership accepted", async () => {
    StudentTeacherLink.findOne.mockReturnValue(leanOne({ status: "revoked", source: "direct" }));
    StudentClassMembership.find.mockReturnValue(leanFind([{ classId }]));
    StudentClass.findOne.mockReturnValue(leanOne({ _id: classId }));
    await expect(hasAcceptedStudentTeacherLink({ studentId, teacherId })).resolves.toBe(true);
  });

  test("pending invitation alone denied (no link/membership)", async () => {
    StudentTeacherLink.findOne.mockReturnValue(leanOne(null));
    StudentClassMembership.find.mockReturnValue(leanFind([]));
    await expect(hasAcceptedStudentTeacherLink({ studentId, teacherId })).resolves.toBe(false);
  });

  test("invalid identifiers handled safely", async () => {
    await expect(hasAcceptedStudentTeacherLink({ studentId: "bad", teacherId })).resolves.toBe(
      false
    );
    expect(StudentTeacherLink.findOne).not.toHaveBeenCalled();
  });
});
