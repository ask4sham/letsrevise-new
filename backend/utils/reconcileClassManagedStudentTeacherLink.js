/**
 * After leave/remove: revoke class-source STL only when no active membership remains
 * in an active class. Never touch direct/admin/legacy links.
 */
"use strict";

const mongoose = require("mongoose");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const StudentClassMembership = require("../models/StudentClassMembership");
const StudentClass = require("../models/StudentClass");

function toObjectIdOrNull(value) {
  if (value == null || value === "") return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  const s = String(value);
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return new mongoose.Types.ObjectId(s);
}

async function hasAuthorisingActiveMembership(studentIdObj, teacherIdObj) {
  const memberships = await StudentClassMembership.find({
    studentId: studentIdObj,
    teacherId: teacherIdObj,
    status: "active",
  })
    .select("classId")
    .lean();

  if (!memberships.length) return false;

  const activeClass = await StudentClass.findOne({
    _id: { $in: memberships.map((m) => m.classId) },
    status: "active",
  })
    .select("_id")
    .lean();

  return !!activeClass;
}

/**
 * @param {{ studentId: unknown, teacherId: unknown }} args
 * @returns {Promise<{ ok: boolean, action: 'kept'|'revoked'|'noop'|'invalid' }>}
 */
async function reconcileClassManagedStudentTeacherLink({ studentId, teacherId }) {
  const studentIdObj = toObjectIdOrNull(studentId);
  const teacherIdObj = toObjectIdOrNull(teacherId);
  if (!studentIdObj || !teacherIdObj) {
    return { ok: false, action: "invalid" };
  }

  if (await hasAuthorisingActiveMembership(studentIdObj, teacherIdObj)) {
    return { ok: true, action: "kept" };
  }

  const link = await StudentTeacherLink.findOne({
    studentId: studentIdObj,
    teacherId: teacherIdObj,
  });

  if (!link) {
    return { ok: true, action: "noop" };
  }

  if (link.source !== "class") {
    return { ok: true, action: "noop" };
  }

  if (link.status === "revoked") {
    return { ok: true, action: "noop" };
  }

  const statusOk = link.status == null || link.status === "" || link.status === "accepted";
  if (!statusOk) {
    return { ok: true, action: "noop" };
  }

  // Re-check after load — another concurrent membership may have been created
  if (await hasAuthorisingActiveMembership(studentIdObj, teacherIdObj)) {
    return { ok: true, action: "kept" };
  }

  link.status = "revoked";
  await link.save();
  return { ok: true, action: "revoked" };
}

module.exports = {
  reconcileClassManagedStudentTeacherLink,
  hasAuthorisingActiveMembership,
  toObjectIdOrNull,
};
