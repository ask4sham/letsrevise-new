/**
 * Student Accept/Decline + membership / STL compatibility.
 *
 * Atomicity strategy: unique indexes + idempotent upserts + guarded status
 * filters + duplicate-key recovery (not multi-doc transactions).
 * Reason: MongoMemoryReplSet transactions hit LockTimeout under parallel
 * collection pressure in this suite; unique (classId,studentId) /
 * (studentId,teacherId) plus final-state verification keeps Accept safe.
 */
"use strict";

const StudentClass = require("../models/StudentClass");
const StudentClassInvitation = require("../models/StudentClassInvitation");
const StudentClassMembership = require("../models/StudentClassMembership");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const User = require("../models/User");
const { generateOpaquePublicId } = require("../utils/opaquePublicId");
const { invitationOwnedByStudent } = require("../utils/invitationOwnership");
const { getSafeUserDisplayName } = require("../utils/userDisplayName");
const { normaliseEmail } = require("../utils/studentEmail");

const NOT_FOUND = { status: 404, body: { error: "Invitation not found" } };

function serializeAcceptedResult({ invitation, membership, classDoc, teacher }) {
  return {
    ok: true,
    invitation: {
      publicId: invitation.publicId,
      status: "accepted",
      respondedAt: invitation.respondedAt || null,
    },
    membership: {
      publicId: membership.publicId,
      status: membership.status,
      joinedAt: membership.joinedAt,
    },
    class: {
      publicId: classDoc.publicId,
      name: classDoc.name,
      description: classDoc.description || "",
      subject: classDoc.subject || null,
      board: classDoc.board || null,
      specKey: classDoc.specKey || null,
      tier: classDoc.tier || null,
      academicYear: classDoc.academicYear || null,
    },
    teacher: {
      displayName: getSafeUserDisplayName(teacher, "Teacher"),
    },
  };
}

function serializeDeclinedResult(invitation) {
  return {
    ok: true,
    invitation: {
      publicId: invitation.publicId,
      status: "declined",
      respondedAt: invitation.respondedAt || null,
    },
  };
}

/**
 * Ensure STL per Phase 2 provenance rules.
 */
async function ensureStudentTeacherLinkForAccept({ studentId, teacherId }) {
  let existing = await StudentTeacherLink.findOne({ studentId, teacherId });

  if (!existing) {
    try {
      return await StudentTeacherLink.create({
        studentId,
        teacherId,
        status: "accepted",
        source: "class",
      });
    } catch (err) {
      if (err && err.code === 11000) {
        existing = await StudentTeacherLink.findOne({ studentId, teacherId });
        if (existing) return existing;
      }
      throw err;
    }
  }

  if (existing.status == null || existing.status === "") {
    return existing;
  }

  if (existing.status === "accepted") {
    return existing;
  }

  if (existing.status === "revoked" && existing.source === "class") {
    existing.status = "accepted";
    await existing.save();
    return existing;
  }

  // Revoked direct/admin/missing — do not rewrite; membership authorises Practice
  return existing;
}

/**
 * Upsert/reactivate membership for classId + studentId.
 * Write order: membership first, then invitation accepted — never leave
 * invitation accepted without an active membership.
 */
async function upsertActiveMembership({ classDoc, studentId }) {
  const now = new Date();
  let membership = await StudentClassMembership.findOne({
    classId: classDoc._id,
    studentId,
  });

  if (!membership) {
    try {
      membership = await StudentClassMembership.create({
        classId: classDoc._id,
        teacherId: classDoc.teacherId,
        studentId,
        publicId: generateOpaquePublicId(),
        status: "active",
        joinedAt: now,
        leftAt: null,
      });
      return membership;
    } catch (err) {
      if (err && err.code === 11000) {
        membership = await StudentClassMembership.findOne({
          classId: classDoc._id,
          studentId,
        });
      } else {
        throw err;
      }
    }
  }

  if (!membership) {
    throw new Error("Failed to upsert membership");
  }

  if (membership.status === "active" && !membership.leftAt) {
    return membership;
  }

  membership.status = "active";
  membership.joinedAt = now;
  membership.leftAt = null;
  membership.teacherId = classDoc.teacherId;
  await membership.save();
  return membership;
}

async function loadInvitationForStudentAction(invitationPublicId, studentUser) {
  const publicId = String(invitationPublicId || "").trim();
  if (!publicId) return { error: NOT_FOUND };

  const invitation = await StudentClassInvitation.findOne({ publicId });
  if (!invitation) return { error: NOT_FOUND };
  if (!invitationOwnedByStudent(invitation, studentUser)) {
    return { error: NOT_FOUND };
  }

  const classDoc = await StudentClass.findById(invitation.classId);
  if (!classDoc) return { error: NOT_FOUND };

  return { invitation, classDoc };
}

async function buildAcceptedResponse(invitation, classDoc, studentId) {
  const membership = await StudentClassMembership.findOne({
    classId: classDoc._id,
    studentId,
    status: "active",
  });
  if (!membership) return null;
  const teacher = await User.findById(classDoc.teacherId).select("firstName lastName").lean();
  return serializeAcceptedResult({
    invitation,
    membership,
    classDoc,
    teacher,
  });
}

/**
 * Accept invitation.
 */
async function acceptInvitation({ invitationPublicId, studentUser, studentId }) {
  const loaded = await loadInvitationForStudentAction(invitationPublicId, studentUser);
  if (loaded.error) return loaded;

  const { invitation, classDoc } = loaded;
  const now = new Date();
  const effective = StudentClassInvitation.effectiveStatus(invitation, now);

  if (effective === "accepted" || invitation.status === "accepted") {
    if (invitation.studentId && String(invitation.studentId) !== String(studentId)) {
      return { error: NOT_FOUND };
    }
    if (classDoc.status === "active") {
      const existing = await buildAcceptedResponse(invitation, classDoc, studentId);
      if (existing) return { result: existing };
    } else {
      return {
        error: {
          status: 409,
          body: { error: "Invitation cannot be accepted", code: "CLASS_ARCHIVED" },
        },
      };
    }
  }

  if (effective === "expired") {
    return {
      error: {
        status: 410,
        body: { error: "Invitation has expired", code: "INVITATION_EXPIRED" },
      },
    };
  }

  if (effective !== "pending" && invitation.status !== "accepted") {
    return {
      error: {
        status: 409,
        body: { error: "Invitation cannot be accepted", code: "INVITATION_NOT_ACTIONABLE" },
      },
    };
  }

  if (classDoc.status !== "active") {
    return {
      error: {
        status: 409,
        body: { error: "Class is archived", code: "CLASS_ARCHIVED" },
      },
    };
  }

  if (String(invitation.teacherId) !== String(classDoc.teacherId)) {
    return { error: NOT_FOUND };
  }

  // 1) Membership first — never mark accepted without an active membership
  const membership = await upsertActiveMembership({ classDoc, studentId });

  // 2) STL compatibility (may leave revoked direct/admin alone)
  await ensureStudentTeacherLinkForAccept({
    studentId,
    teacherId: classDoc.teacherId,
  });

  // 3) Guarded invitation transition
  if (invitation.status === "pending") {
    const updated = await StudentClassInvitation.findOneAndUpdate(
      { _id: invitation._id, status: "pending" },
      {
        $set: {
          status: "accepted",
          studentId,
          respondedAt: now,
        },
      },
      { new: true }
    );
    if (updated) {
      const teacher = await User.findById(classDoc.teacherId).select("firstName lastName").lean();
      return {
        result: serializeAcceptedResult({
          invitation: updated,
          membership,
          classDoc,
          teacher,
        }),
      };
    }
    // Race: another writer transitioned — verify final state
    const fresh = await StudentClassInvitation.findById(invitation._id);
    if (
      fresh &&
      fresh.status === "accepted" &&
      (!fresh.studentId || String(fresh.studentId) === String(studentId))
    ) {
      const result = await buildAcceptedResponse(fresh, classDoc, studentId);
      if (result) return { result };
    }
    return {
      error: {
        status: 409,
        body: { error: "Invitation cannot be accepted", code: "INVITATION_NOT_ACTIONABLE" },
      },
    };
  }

  // Heal already-accepted without active membership path
  if (invitation.status === "accepted") {
    invitation.studentId = invitation.studentId || studentId;
    invitation.respondedAt = invitation.respondedAt || now;
    await invitation.save();
    const teacher = await User.findById(classDoc.teacherId).select("firstName lastName").lean();
    return {
      result: serializeAcceptedResult({
        invitation,
        membership,
        classDoc,
        teacher,
      }),
    };
  }

  return {
    error: {
      status: 409,
      body: { error: "Invitation cannot be accepted", code: "INVITATION_NOT_ACTIONABLE" },
    },
  };
}

/**
 * Decline invitation.
 */
async function declineInvitation({ invitationPublicId, studentUser, studentId }) {
  const loaded = await loadInvitationForStudentAction(invitationPublicId, studentUser);
  if (loaded.error) return loaded;

  const { invitation } = loaded;
  const now = new Date();
  const effective = StudentClassInvitation.effectiveStatus(invitation, now);

  if (effective === "declined" || invitation.status === "declined") {
    if (invitation.studentId && String(invitation.studentId) !== String(studentId)) {
      return { error: NOT_FOUND };
    }
    return { result: serializeDeclinedResult(invitation) };
  }

  if (effective === "expired") {
    return {
      error: {
        status: 410,
        body: { error: "Invitation has expired", code: "INVITATION_EXPIRED" },
      },
    };
  }

  if (effective === "accepted" || invitation.status === "accepted") {
    return {
      error: {
        status: 409,
        body: { error: "Accepted invitations cannot be declined", code: "INVITATION_ACCEPTED" },
      },
    };
  }

  if (effective !== "pending") {
    return {
      error: {
        status: 409,
        body: { error: "Invitation cannot be declined", code: "INVITATION_NOT_ACTIONABLE" },
      },
    };
  }

  const updated = await StudentClassInvitation.findOneAndUpdate(
    { _id: invitation._id, status: "pending" },
    {
      $set: {
        status: "declined",
        studentId,
        respondedAt: now,
      },
    },
    { new: true }
  );

  if (updated) {
    return { result: serializeDeclinedResult(updated) };
  }

  const fresh = await StudentClassInvitation.findById(invitation._id);
  if (fresh && fresh.status === "declined") {
    if (fresh.studentId && String(fresh.studentId) !== String(studentId)) {
      return { error: NOT_FOUND };
    }
    return { result: serializeDeclinedResult(fresh) };
  }

  return {
    error: {
      status: 409,
      body: { error: "Invitation cannot be declined", code: "INVITATION_NOT_ACTIONABLE" },
    },
  };
}

/**
 * Incoming pending invitations for authenticated student email.
 */
async function listIncomingInvitations(studentUser) {
  const norm = normaliseEmail(studentUser.email);
  if (!norm.ok) {
    return { invitations: [] };
  }

  const now = new Date();
  const rows = await StudentClassInvitation.find({
    targetEmail: norm.email,
    status: "pending",
    expiresAt: { $gt: now },
  })
    .sort({ requestedAt: -1 })
    .lean();

  if (!rows.length) return { invitations: [] };

  const classIds = [...new Set(rows.map((r) => String(r.classId)))];
  const classes = await StudentClass.find({
    _id: { $in: classIds },
    status: "active",
  }).lean();
  const classById = new Map(classes.map((c) => [String(c._id), c]));

  const teacherIds = [...new Set(classes.map((c) => String(c.teacherId)))];
  const teachers = await User.find({ _id: { $in: teacherIds } })
    .select("firstName lastName")
    .lean();
  const teacherById = new Map(teachers.map((t) => [String(t._id), t]));

  const invitations = [];
  for (const row of rows) {
    const cls = classById.get(String(row.classId));
    if (!cls) continue;
    if (StudentClassInvitation.effectiveStatus(row, now) !== "pending") continue;
    const teacher = teacherById.get(String(cls.teacherId));
    invitations.push({
      publicId: row.publicId,
      status: "pending",
      requestedAt: row.requestedAt,
      expiresAt: row.expiresAt,
      class: {
        publicId: cls.publicId,
        name: cls.name,
        description: cls.description || "",
        subject: cls.subject || null,
        board: cls.board || null,
        specKey: cls.specKey || null,
        tier: cls.tier || null,
        academicYear: cls.academicYear || null,
      },
      teacher: {
        displayName: getSafeUserDisplayName(teacher, "Teacher"),
      },
    });
  }

  return { invitations };
}

/**
 * Teacher invitation list with accepted student display names only after accept.
 */
async function listInvitationsForTeacher(classId, now = new Date()) {
  const rows = await StudentClassInvitation.find({ classId }).sort({ requestedAt: -1 }).lean();
  const acceptedIds = rows
    .filter((r) => StudentClassInvitation.effectiveStatus(r, now) === "accepted" && r.studentId)
    .map((r) => r.studentId);

  const users = acceptedIds.length
    ? await User.find({ _id: { $in: acceptedIds } }).select("firstName lastName").lean()
    : [];
  const userById = new Map(users.map((u) => [String(u._id), u]));

  return rows.map((row) => {
    const status = StudentClassInvitation.effectiveStatus(row, now);
    const base = {
      publicId: row.publicId,
      targetEmail: row.targetEmail,
      status,
      requestedAt: row.requestedAt,
      expiresAt: row.expiresAt,
      respondedAt: row.respondedAt || null,
      cancelledAt: row.cancelledAt || null,
    };
    if (status === "accepted" && row.studentId) {
      base.student = {
        displayName: getSafeUserDisplayName(userById.get(String(row.studentId)), "Student"),
      };
    }
    return base;
  });
}

/**
 * Active roster for a class.
 */
async function listActiveRoster(classDoc) {
  const rows = await StudentClassMembership.find({
    classId: classDoc._id,
    status: "active",
  })
    .sort({ joinedAt: -1 })
    .lean();

  if (!rows.length) return { students: [] };

  const users = await User.find({ _id: { $in: rows.map((r) => r.studentId) } })
    .select("firstName lastName")
    .lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));

  return {
    students: rows.map((row) => ({
      membershipPublicId: row.publicId,
      status: "active",
      joinedAt: row.joinedAt,
      student: {
        displayName: getSafeUserDisplayName(userById.get(String(row.studentId)), "Student"),
      },
    })),
  };
}

/**
 * Student's active memberships (active class only for listing).
 */
async function listMyActiveMemberships(studentId) {
  const rows = await StudentClassMembership.find({
    studentId,
    status: "active",
  })
    .sort({ joinedAt: -1 })
    .lean();

  if (!rows.length) return { classes: [] };

  const classes = await StudentClass.find({
    _id: { $in: rows.map((r) => r.classId) },
    status: "active",
  }).lean();
  const classById = new Map(classes.map((c) => [String(c._id), c]));

  const teacherIds = [...new Set(classes.map((c) => String(c.teacherId)))];
  const teachers = await User.find({ _id: { $in: teacherIds } })
    .select("firstName lastName")
    .lean();
  const teacherById = new Map(teachers.map((t) => [String(t._id), t]));

  const out = [];
  for (const row of rows) {
    const cls = classById.get(String(row.classId));
    if (!cls) continue;
    const teacher = teacherById.get(String(cls.teacherId));
    out.push({
      membershipPublicId: row.publicId,
      joinedAt: row.joinedAt,
      class: {
        publicId: cls.publicId,
        name: cls.name,
        description: cls.description || "",
        subject: cls.subject || null,
        board: cls.board || null,
        specKey: cls.specKey || null,
        tier: cls.tier || null,
        academicYear: cls.academicYear || null,
      },
      teacher: {
        displayName: getSafeUserDisplayName(teacher, "Teacher"),
      },
    });
  }

  return { classes: out };
}

module.exports = {
  acceptInvitation,
  declineInvitation,
  listIncomingInvitations,
  listInvitationsForTeacher,
  listActiveRoster,
  listMyActiveMemberships,
  ensureStudentTeacherLinkForAccept,
  upsertActiveMembership,
};
