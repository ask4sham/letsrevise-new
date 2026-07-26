/**
 * Canonical Practice authorisation: accepted (or legacy) StudentTeacherLink only.
 * Pending class invitations never authorise Practice.
 */
"use strict";

const mongoose = require("mongoose");
const StudentTeacherLink = require("../models/StudentTeacherLink");

function toObjectIdOrNull(value) {
  if (value == null || value === "") return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  const s = String(value);
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return new mongoose.Types.ObjectId(s);
}

/**
 * @param {{ studentId: unknown, teacherId: unknown }} args
 * @returns {Promise<boolean>}
 */
async function hasAcceptedStudentTeacherLink({ studentId, teacherId }) {
  const studentIdObj = toObjectIdOrNull(studentId);
  const teacherIdObj = toObjectIdOrNull(teacherId);
  if (!studentIdObj || !teacherIdObj) return false;

  const link = await StudentTeacherLink.findOne({
    studentId: studentIdObj,
    teacherId: teacherIdObj,
  })
    .select("status")
    .lean();

  if (!link) return false;
  if (link.status == null || link.status === "") return true; // legacy
  return link.status === "accepted";
}

module.exports = {
  hasAcceptedStudentTeacherLink,
  toObjectIdOrNull,
};
