/**
 * Share for Review — grant/revoke/list active VIEW shares via LessonShare collection.
 */
const mongoose = require("mongoose");
const LessonShare = require("../models/LessonShare");
const Lesson = require("../models/Lesson");
const User = require("../models/User");

const VIEW_PERMISSION = "VIEW";
const ACTIVE_STATUS = "active";
const REVOKED_STATUS = "revoked";

const BLOCKED_SHARE_LESSON_STATUSES = ["archived", "flagged"];

function getLessonWorkflowStatus(lesson) {
  return String(lesson?.status || (lesson?.isPublished ? "published" : "draft")).toLowerCase();
}

function isLessonShareable(lesson) {
  return !BLOCKED_SHARE_LESSON_STATUSES.includes(getLessonWorkflowStatus(lesson));
}

function assertLessonShareable(lesson) {
  if (!lesson) {
    throw Object.assign(new Error("Lesson not found"), { status: 404 });
  }
  if (!isLessonShareable(lesson)) {
    throw Object.assign(
      new Error("Archived or moderated lessons cannot be shared for review"),
      { status: 400, code: "LESSON_NOT_SHAREABLE" }
    );
  }
}

function isAdminUser(user) {
  const t = user?.userType || user?.role || user?.isAdmin;
  return t === "admin" || t === true;
}

function canManageShares(user, lesson) {
  if (!user || !lesson) return false;
  if (isAdminUser(user)) return true;
  const ownerId = lesson.teacherId?._id ?? lesson.teacherId;
  return ownerId != null && String(ownerId) === String(user._id);
}

async function findActiveViewShare(lessonId, teacherUserId) {
  if (!lessonId || !teacherUserId) return null;
  if (!mongoose.Types.ObjectId.isValid(String(lessonId))) return null;
  if (!mongoose.Types.ObjectId.isValid(String(teacherUserId))) return null;
  return LessonShare.findOne({
    lessonId,
    teacherId: teacherUserId,
    status: ACTIVE_STATUS,
    permission: VIEW_PERMISSION,
  }).lean();
}

async function grantViewShare({ lessonId, teacherId, sharedBy }) {
  if (!mongoose.Types.ObjectId.isValid(String(lessonId))) {
    throw Object.assign(new Error("Invalid lesson id"), { status: 400 });
  }
  if (!mongoose.Types.ObjectId.isValid(String(teacherId))) {
    throw Object.assign(new Error("Invalid teacher id"), { status: 400 });
  }
  if (String(teacherId) === String(sharedBy)) {
    throw Object.assign(new Error("Cannot share a lesson with yourself"), { status: 400 });
  }

  const target = await User.findById(teacherId).select("userType email firstName lastName").lean();
  if (!target || target.userType !== "teacher") {
    throw Object.assign(new Error("Reviewer must be a teacher account"), { status: 400 });
  }

  const lesson = await Lesson.findById(lessonId).select("teacherId title status isPublished").lean();
  if (!lesson) {
    throw Object.assign(new Error("Lesson not found"), { status: 404 });
  }
  assertLessonShareable(lesson);
  if (String(lesson.teacherId) === String(teacherId)) {
    throw Object.assign(new Error("Cannot share a lesson with its owner"), { status: 400 });
  }

  const now = new Date();
  const existing = await LessonShare.findOne({ lessonId, teacherId });
  if (existing) {
    existing.status = ACTIVE_STATUS;
    existing.permission = VIEW_PERMISSION;
    existing.sharedBy = sharedBy;
    existing.sharedAt = now;
    existing.revokedBy = null;
    existing.revokedAt = null;
    await existing.save();
    return existing.toObject();
  }

  const created = await LessonShare.create({
    lessonId,
    teacherId,
    permission: VIEW_PERMISSION,
    sharedBy,
    sharedAt: now,
    status: ACTIVE_STATUS,
  });
  return created.toObject();
}

async function revokeShare({ lessonId, teacherId, revokedBy }) {
  const share = await LessonShare.findOne({ lessonId, teacherId, status: ACTIVE_STATUS });
  if (!share) {
    throw Object.assign(new Error("Active share not found"), { status: 404 });
  }
  share.status = REVOKED_STATUS;
  share.revokedBy = revokedBy;
  share.revokedAt = new Date();
  await share.save();
  return share.toObject();
}

async function listSharesForLesson(lessonId, { includeRevoked = false } = {}) {
  const query = { lessonId };
  if (!includeRevoked) query.status = ACTIVE_STATUS;
  const shares = await LessonShare.find(query).sort({ sharedAt: -1 }).lean();
  const userIds = [
    ...new Set(
      shares
        .flatMap((s) => [s.teacherId, s.sharedBy, s.revokedBy])
        .filter(Boolean)
        .map(String)
    ),
  ];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("_id firstName lastName email schoolName institution")
        .lean()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  return shares.map((s) => formatShareRow(s, userMap));
}

function reviewerSchoolLabel(user) {
  if (!user) return "";
  return String(user.schoolName || user.institution || "").trim();
}

function formatShareRow(share, userMap) {
  const reviewer = userMap.get(String(share.teacherId));
  const sharer = userMap.get(String(share.sharedBy));
  const revoker = share.revokedBy ? userMap.get(String(share.revokedBy)) : null;
  const teacherName = reviewer
    ? [reviewer.firstName, reviewer.lastName].filter(Boolean).join(" ").trim() || reviewer.email
    : "";
  return {
    id: String(share._id),
    lessonId: String(share.lessonId),
    teacherId: String(share.teacherId),
    teacherName,
    teacherEmail: reviewer?.email || "",
    schoolName: reviewerSchoolLabel(reviewer),
    permission: share.permission,
    permissionLabel: "VIEW ONLY",
    reviewStatus: share.status === ACTIVE_STATUS ? "waiting_for_review" : "revoked",
    status: share.status,
    sharedBy: String(share.sharedBy),
    sharedByName: sharer
      ? [sharer.firstName, sharer.lastName].filter(Boolean).join(" ").trim() || sharer.email
      : "",
    sharedAt: share.sharedAt,
    revokedBy: share.revokedBy ? String(share.revokedBy) : null,
    revokedByName: revoker
      ? [revoker.firstName, revoker.lastName].filter(Boolean).join(" ").trim() || revoker.email
      : null,
    revokedAt: share.revokedAt || null,
  };
}

function toListSafeLesson(lesson) {
  return {
    _id: lesson._id,
    id: String(lesson._id),
    title: lesson.title,
    subject: lesson.subject,
    level: lesson.level,
    board: lesson.board || "",
    examBoard: lesson.board || lesson.examBoard || "",
    topic: lesson.topic,
    tier: lesson.tier,
    status: lesson.status || (lesson.isPublished ? "published" : "draft"),
    isPublished: !!lesson.isPublished,
    teacherId: lesson.teacherId ? String(lesson.teacherId) : "",
    teacherName: lesson.teacherName || "",
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
  };
}

async function listReviewRequestsForTeacher(teacherUserId) {
  const shares = await LessonShare.find({
    teacherId: teacherUserId,
    status: ACTIVE_STATUS,
    permission: VIEW_PERMISSION,
  })
    .sort({ sharedAt: -1 })
    .lean();

  if (!shares.length) return [];

  const lessonIds = shares.map((s) => s.lessonId);
  const lessons = await Lesson.find({
    _id: { $in: lessonIds },
    status: { $nin: BLOCKED_SHARE_LESSON_STATUSES },
  })
    .select(
      "title subject level board topic tier status isPublished teacherId teacherName createdAt updatedAt"
    )
    .lean();
  const lessonMap = new Map(lessons.map((l) => [String(l._id), l]));

  const sharerIds = [...new Set(shares.map((s) => String(s.sharedBy)))];
  const sharers = sharerIds.length
    ? await User.find({ _id: { $in: sharerIds } }).select("_id firstName lastName email").lean()
    : [];
  const sharerMap = new Map(sharers.map((u) => [String(u._id), u]));

  return shares
    .map((share) => {
      const lesson = lessonMap.get(String(share.lessonId));
      if (!lesson) return null;
      const sharer = sharerMap.get(String(share.sharedBy));
      return {
        ...toListSafeLesson(lesson),
        accessRole: "shared_review",
        shareId: String(share._id),
        permission: share.permission,
        sharedAt: share.sharedAt,
        sharedBy: String(share.sharedBy),
        sharedByName: sharer
          ? [sharer.firstName, sharer.lastName].filter(Boolean).join(" ").trim() || sharer.email
          : lesson.teacherName || "Teacher",
      };
    })
    .filter(Boolean);
}

async function lookupTeacherByEmail(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized || !normalized.includes("@")) return { user: null, reason: "invalid_email" };

  const user = await User.findOne({ email: normalized })
    .select("_id firstName lastName email userType")
    .lean();
  if (!user) {
    return { user: null, reason: "not_found" };
  }
  if (user.userType !== "teacher") {
    return { user: null, reason: "not_teacher", userType: user.userType };
  }
  return {
    user: {
      id: String(user._id),
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email,
    },
    reason: null,
  };
}

module.exports = {
  VIEW_PERMISSION,
  ACTIVE_STATUS,
  BLOCKED_SHARE_LESSON_STATUSES,
  getLessonWorkflowStatus,
  isLessonShareable,
  canManageShares,
  findActiveViewShare,
  grantViewShare,
  revokeShare,
  listSharesForLesson,
  listReviewRequestsForTeacher,
  lookupTeacherByEmail,
};
