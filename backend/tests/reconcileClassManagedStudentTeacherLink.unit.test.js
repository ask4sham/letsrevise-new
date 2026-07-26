/**
 * Unit: class-managed STL reconciliation (mocked models).
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
const {
  reconcileClassManagedStudentTeacherLink,
} = require("../utils/reconcileClassManagedStudentTeacherLink");

function leanFind(docs) {
  return {
    select: () => ({
      lean: async () => docs,
    }),
  };
}

function leanOne(doc) {
  return {
    select: () => ({
      lean: async () => doc,
    }),
  };
}

describe("reconcileClassManagedStudentTeacherLink", () => {
  const studentId = new mongoose.Types.ObjectId();
  const teacherId = new mongoose.Types.ObjectId();
  const classId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    StudentTeacherLink.findOne.mockReset();
    StudentClassMembership.find.mockReset();
    StudentClass.findOne.mockReset();
  });

  test("another active class membership keeps class-source link accepted", async () => {
    StudentClassMembership.find.mockReturnValue(leanFind([{ classId }]));
    StudentClass.findOne.mockReturnValue(leanOne({ _id: classId }));
    const r = await reconcileClassManagedStudentTeacherLink({ studentId, teacherId });
    expect(r.action).toBe("kept");
    expect(StudentTeacherLink.findOne).not.toHaveBeenCalled();
  });

  test("final active membership removal revokes class-source link", async () => {
    StudentClassMembership.find.mockReturnValue(leanFind([]));
    const link = {
      source: "class",
      status: "accepted",
      save: jest.fn().mockResolvedValue(undefined),
    };
    StudentTeacherLink.findOne.mockResolvedValue(link);
    const r = await reconcileClassManagedStudentTeacherLink({ studentId, teacherId });
    expect(r.action).toBe("revoked");
    expect(link.status).toBe("revoked");
    expect(link.save).toHaveBeenCalled();
  });

  test("archived-only membership does not keep class-source link accepted", async () => {
    StudentClassMembership.find.mockReturnValue(leanFind([{ classId }]));
    StudentClass.findOne.mockReturnValue(leanOne(null)); // no active class
    const link = {
      source: "class",
      status: "accepted",
      save: jest.fn().mockResolvedValue(undefined),
    };
    StudentTeacherLink.findOne.mockResolvedValue(link);
    const r = await reconcileClassManagedStudentTeacherLink({ studentId, teacherId });
    expect(r.action).toBe("revoked");
  });

  test("direct source never revoked", async () => {
    StudentClassMembership.find.mockReturnValue(leanFind([]));
    StudentTeacherLink.findOne.mockResolvedValue({
      source: "direct",
      status: "accepted",
      save: jest.fn(),
    });
    const r = await reconcileClassManagedStudentTeacherLink({ studentId, teacherId });
    expect(r.action).toBe("noop");
  });

  test("admin source never revoked", async () => {
    StudentClassMembership.find.mockReturnValue(leanFind([]));
    StudentTeacherLink.findOne.mockResolvedValue({
      source: "admin",
      status: "accepted",
      save: jest.fn(),
    });
    const r = await reconcileClassManagedStudentTeacherLink({ studentId, teacherId });
    expect(r.action).toBe("noop");
  });

  test("missing legacy source never revoked", async () => {
    StudentClassMembership.find.mockReturnValue(leanFind([]));
    StudentTeacherLink.findOne.mockResolvedValue({
      source: undefined,
      status: undefined,
      save: jest.fn(),
    });
    const r = await reconcileClassManagedStudentTeacherLink({ studentId, teacherId });
    expect(r.action).toBe("noop");
  });

  test("already revoked is idempotent", async () => {
    StudentClassMembership.find.mockReturnValue(leanFind([]));
    StudentTeacherLink.findOne.mockResolvedValue({
      source: "class",
      status: "revoked",
      save: jest.fn(),
    });
    const r = await reconcileClassManagedStudentTeacherLink({ studentId, teacherId });
    expect(r.action).toBe("noop");
  });

  test("missing link no-op", async () => {
    StudentClassMembership.find.mockReturnValue(leanFind([]));
    StudentTeacherLink.findOne.mockResolvedValue(null);
    const r = await reconcileClassManagedStudentTeacherLink({ studentId, teacherId });
    expect(r.action).toBe("noop");
  });

  test("invalid identifiers fail safely", async () => {
    const r = await reconcileClassManagedStudentTeacherLink({
      studentId: "bad",
      teacherId,
    });
    expect(r.ok).toBe(false);
    expect(r.action).toBe("invalid");
  });
});
