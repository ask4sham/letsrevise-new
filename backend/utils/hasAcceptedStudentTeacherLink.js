/**
 * Canonical Practice authorisation.
 *
 * Authorises when:
 * 1. StudentTeacherLink is accepted/legacy AND source is not class-only, OR
 * 2. StudentTeacherLink source=class AND an active membership exists in an active class, OR
 * 3. An active StudentClassMembership exists in an active class (covers revoked direct/admin)
 *
 * Class-source links alone do not keep Practice open after the class is archived.
 * Pending invitations never authorise Practice.
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

async function hasActiveMembershipInActiveClass(studentIdObj, teacherIdObj) {
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
    .select("status source")
    .lean();

  if (link) {
    const statusOk = link.status == null || link.status === "" || link.status === "accepted";
    if (statusOk) {
      if (link.source === "class") {
        // Class-managed link: require live membership in an active class
        return hasActiveMembershipInActiveClass(studentIdObj, teacherIdObj);
      }
      // Legacy / direct / admin — independent of class archive
      return true;
    }
    // revoked — membership may still authorise
  }

  return hasActiveMembershipInActiveClass(studentIdObj, teacherIdObj);
}

module.exports = {
  hasAcceptedStudentTeacherLink,
  toObjectIdOrNull,
};
