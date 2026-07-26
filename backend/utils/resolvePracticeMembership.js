/**
 * Resolve Practice content-owner teacher from an opaque membershipPublicId.
 * Never trust client teacherId/classId/studentId for this path.
 */
"use strict";

const StudentClass = require("../models/StudentClass");
const StudentClassMembership = require("../models/StudentClassMembership");

const NOT_FOUND = {
  status: 404,
  body: { error: "This class link is no longer available.", code: "MEMBERSHIP_NOT_FOUND" },
};

/**
 * @param {{ studentId: unknown, membershipPublicId: unknown }} args
 * @returns {Promise<{ teacherIdObj: import("mongoose").Types.ObjectId, membershipPublicId: string, resolution: "class-membership" } | { error: { status: number, body: object } }>}
 */
async function resolvePracticeMembership({ studentId, membershipPublicId }) {
  const publicId = String(membershipPublicId || "").trim();
  if (!publicId) return { error: NOT_FOUND };

  const membership = await StudentClassMembership.findOne({ publicId }).lean();
  if (!membership) return { error: NOT_FOUND };

  if (String(membership.studentId) !== String(studentId)) {
    return { error: NOT_FOUND };
  }

  if (membership.status !== "active") {
    return {
      error: {
        status: 404,
        body: {
          error: "This class link is no longer active.",
          code: "MEMBERSHIP_REMOVED",
        },
      },
    };
  }

  const classDoc = await StudentClass.findById(membership.classId).lean();
  if (!classDoc) return { error: NOT_FOUND };

  if (String(membership.classId) !== String(classDoc._id)) {
    return { error: NOT_FOUND };
  }

  if (String(membership.teacherId) !== String(classDoc.teacherId)) {
    return { error: NOT_FOUND };
  }

  if (classDoc.status !== "active") {
    return {
      error: {
        status: 400,
        body: {
          error: "This class is no longer active.",
          code: "CLASS_ARCHIVED",
        },
      },
    };
  }

  return {
    teacherIdObj: classDoc.teacherId,
    membershipPublicId: publicId,
    resolution: "class-membership",
  };
}

module.exports = {
  resolvePracticeMembership,
};
