/**
 * Student leave / teacher remove + class-managed STL reconciliation.
 */
"use strict";

const StudentClass = require("../models/StudentClass");
const StudentClassMembership = require("../models/StudentClassMembership");

const NOT_FOUND = { status: 404, body: { error: "Membership not found" } };

function reconcileAfterRemoval({ studentId, teacherId }) {
  // Lazy require keeps invitation lifecycle usable before removal helper lands.
  const {
    reconcileClassManagedStudentTeacherLink,
  } = require("../utils/reconcileClassManagedStudentTeacherLink");
  return reconcileClassManagedStudentTeacherLink({ studentId, teacherId });
}

function serializeRemoved(membership) {
  return {
    ok: true,
    membership: {
      publicId: membership.publicId,
      status: "removed",
      leftAt: membership.leftAt,
    },
  };
}

/**
 * Student leaves their own membership.
 */
async function studentLeaveMembership({ membershipPublicId, studentId }) {
  const publicId = String(membershipPublicId || "").trim();
  if (!publicId) return { error: NOT_FOUND };

  const membership = await StudentClassMembership.findOne({ publicId });
  if (!membership) return { error: NOT_FOUND };
  if (String(membership.studentId) !== String(studentId)) {
    return { error: NOT_FOUND };
  }

  if (membership.status === "removed") {
    return { result: serializeRemoved(membership) };
  }

  const now = new Date();
  membership.status = "removed";
  membership.leftAt = now;
  await membership.save();

  await reconcileAfterRemoval({
    studentId: membership.studentId,
    teacherId: membership.teacherId,
  });

  return { result: serializeRemoved(membership) };
}

/**
 * Teacher removes a student from a class.
 */
async function teacherRemoveMembership({ classDoc, membershipPublicId }) {
  const publicId = String(membershipPublicId || "").trim();
  if (!publicId) return { error: NOT_FOUND };

  const membership = await StudentClassMembership.findOne({
    publicId,
    classId: classDoc._id,
  });
  if (!membership) return { error: NOT_FOUND };

  if (membership.status === "removed") {
    return { result: serializeRemoved(membership) };
  }

  const now = new Date();
  membership.status = "removed";
  membership.leftAt = now;
  await membership.save();

  await reconcileAfterRemoval({
    studentId: membership.studentId,
    teacherId: membership.teacherId || classDoc.teacherId,
  });

  return { result: serializeRemoved(membership) };
}

/**
 * Explicit invitation resend (declined/cancelled/expired → pending).
 */
async function resendInvitation({ classDoc, invitationPublicId }) {
  const StudentClassInvitation = require("../models/StudentClassInvitation");
  const publicId = String(invitationPublicId || "").trim();
  if (!publicId) {
    return { error: { status: 404, body: { error: "Invitation not found" } } };
  }

  if (classDoc.status === "archived") {
    return {
      error: {
        status: 400,
        body: { error: "Archived classes cannot resend invitations", code: "CLASS_ARCHIVED" },
      },
    };
  }

  const inv = await StudentClassInvitation.findOne({
    publicId,
    classId: classDoc._id,
  });
  if (!inv) {
    return { error: { status: 404, body: { error: "Invitation not found" } } };
  }

  const now = new Date();
  const effective = StudentClassInvitation.effectiveStatus(inv, now);

  if (effective === "accepted" || inv.status === "accepted") {
    return {
      error: {
        status: 409,
        body: { error: "Accepted invitations cannot be resent", code: "INVITATION_ACCEPTED" },
      },
    };
  }

  const canResend =
    effective === "declined" ||
    effective === "cancelled" ||
    effective === "expired" ||
    inv.status === "declined" ||
    inv.status === "cancelled" ||
    inv.status === "expired" ||
    inv.status === "pending";

  if (!canResend) {
    return {
      error: {
        status: 409,
        body: { error: "Invitation cannot be resent", code: "INVITATION_NOT_ACTIONABLE" },
      },
    };
  }

  const expiresAt = new Date(now.getTime() + StudentClassInvitation.INVITATION_TTL_MS);

  if (inv.status === "pending" && effective === "pending") {
    // Idempotent pending resend — refresh expiry
    inv.requestedAt = now;
    inv.expiresAt = expiresAt;
    await inv.save();
  } else {
    inv.status = "pending";
    inv.requestedAt = now;
    inv.expiresAt = expiresAt;
    inv.respondedAt = null;
    inv.cancelledAt = null;
    inv.studentId = null;
    await inv.save();
  }

  return {
    result: {
      ok: true,
      invitation: {
        publicId: inv.publicId,
        targetEmail: inv.targetEmail,
        status: "pending",
        requestedAt: inv.requestedAt,
        expiresAt: inv.expiresAt,
      },
    },
  };
}

/**
 * Apply PATCH fields to a class document (in-memory); returns validation error or null.
 */
function applyClassPatch(cls, body) {
  const StudentClass = require("../models/StudentClass");
  if (!body || typeof body !== "object") {
    return { error: { status: 400, body: { error: "Invalid body" } } };
  }

  // Forbidden fields
  for (const banned of ["teacherId", "publicId", "status", "archivedAt", "_id", "id"]) {
    if (Object.prototype.hasOwnProperty.call(body, banned)) {
      return {
        error: {
          status: 400,
          body: { error: `${banned} cannot be changed`, code: "FIELD_FORBIDDEN" },
        },
      };
    }
  }

  if (body.name != null) {
    if (typeof body.name !== "string") {
      return { error: { status: 400, body: { error: "name must be a string" } } };
    }
    const name = body.name.trim();
    if (!name) {
      return { error: { status: 400, body: { error: "name is required" } } };
    }
    if (name.length > StudentClass.NAME_MAX) {
      return {
        error: {
          status: 400,
          body: { error: `name must be at most ${StudentClass.NAME_MAX} characters` },
        },
      };
    }
    cls.name = name;
  }

  if (body.description != null) {
    const description = String(body.description).trim();
    if (description.length > StudentClass.DESCRIPTION_MAX) {
      return {
        error: {
          status: 400,
          body: {
            error: `description must be at most ${StudentClass.DESCRIPTION_MAX} characters`,
          },
        },
      };
    }
    cls.description = description;
  }

  // board alias: examBoard → board
  const boardValue = body.board != null ? body.board : body.examBoard;
  const optionalKeys = [
    ["subject", body.subject],
    ["board", boardValue],
    ["specKey", body.specKey],
    ["tier", body.tier],
    ["academicYear", body.academicYear],
  ];

  for (const [key, value] of optionalKeys) {
    if (value === undefined) continue;
    if (value == null || value === "") {
      cls[key] = null;
      continue;
    }
    const trimmed = String(value).trim();
    if (trimmed.length > 100) {
      return {
        error: {
          status: 400,
          body: { error: `${key} must be at most 100 characters` },
        },
      };
    }
    cls[key] = trimmed;
  }

  return null;
}

async function archiveClass(classDoc) {
  if (classDoc.status === "archived") {
    return classDoc;
  }
  const updated = await StudentClass.findByIdAndUpdate(
    classDoc._id,
    { $set: { status: "archived", archivedAt: new Date() } },
    { new: true }
  ).lean();
  return updated || classDoc;
}

module.exports = {
  studentLeaveMembership,
  teacherRemoveMembership,
  resendInvitation,
  applyClassPatch,
  archiveClass,
};
