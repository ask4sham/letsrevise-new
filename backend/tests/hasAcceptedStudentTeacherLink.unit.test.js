/**
 * Unit: canonical Practice link helper (mocked StudentTeacherLink).
 */
const mongoose = require("mongoose");

jest.mock("../models/StudentTeacherLink", () => ({
  findOne: jest.fn(),
}));

const StudentTeacherLink = require("../models/StudentTeacherLink");
const { hasAcceptedStudentTeacherLink } = require("../utils/hasAcceptedStudentTeacherLink");

function leanResult(doc) {
  return {
    select: () => ({
      lean: async () => doc,
    }),
  };
}

describe("hasAcceptedStudentTeacherLink", () => {
  const studentId = new mongoose.Types.ObjectId();
  const teacherId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    StudentTeacherLink.findOne.mockReset();
  });

  test("missing status is accepted (legacy)", async () => {
    StudentTeacherLink.findOne.mockReturnValue(leanResult({ status: undefined }));
    await expect(hasAcceptedStudentTeacherLink({ studentId, teacherId })).resolves.toBe(true);
  });

  test("accepted status authorises", async () => {
    StudentTeacherLink.findOne.mockReturnValue(leanResult({ status: "accepted" }));
    await expect(hasAcceptedStudentTeacherLink({ studentId, teacherId })).resolves.toBe(true);
  });

  test("revoked rejects", async () => {
    StudentTeacherLink.findOne.mockReturnValue(leanResult({ status: "revoked" }));
    await expect(hasAcceptedStudentTeacherLink({ studentId, teacherId })).resolves.toBe(false);
  });

  test("no link rejects", async () => {
    StudentTeacherLink.findOne.mockReturnValue(leanResult(null));
    await expect(hasAcceptedStudentTeacherLink({ studentId, teacherId })).resolves.toBe(false);
  });

  test("invalid identifiers rejected safely without query", async () => {
    await expect(hasAcceptedStudentTeacherLink({ studentId: "bad", teacherId })).resolves.toBe(false);
    await expect(hasAcceptedStudentTeacherLink({ studentId, teacherId: null })).resolves.toBe(false);
    expect(StudentTeacherLink.findOne).not.toHaveBeenCalled();
  });
});
