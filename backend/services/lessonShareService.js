/**
 * LessonShare grants — review (VIEW) and classroom teaching (TEACH).
 */
const mongoose = require("mongoose");
const LessonShare = require("../models/LessonShare");
const Lesson = require("../models/Lesson");
const User = require("../models/User");

const VIEW_PERMISSION = "VIEW";
const TEACH_PERMISSION = "TEACH";
const ACTIVE_STATUS = "active";
const REVOKED_STATUS = "revoked";

const SHARE_PERMISSION_LABELS = {
  [VIEW_PERMISSION]: "VIEW ONLY",
  [TEACH_PERMISSION]: "TEACH IN CLASSROOM",
};

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
      new Error("Archived or moderated lessons cannot be shared for review or teaching"),
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

function normalizeSharePermission(permission) {
  const p = String(permission || VIEW_PERMISSION).trim().toUpperCase();
  if (p === TEACH_PERMISSION) return TEACH_PERMISSION;
  return VIEW_PERMISSION;
}

async function findActiveShare(lessonId, teacherUserId, permission) {
  if (!lessonId || !teacherUserId) return null;
  if (!mongoose.Types.ObjectId.isValid(String(lessonId))) return null;
  if (!mongoose.Types.ObjectId.isValid(String(teacherUserId))) return null;
  const query = {
    lessonId,
    teacherId: teacherUserId,
    status: ACTIVE_STATUS,
  };
  if (permission) query.permission = permission;
  return LessonShare.findOne(query).lean();
}

async function findActiveViewShare(lessonId, teacherUserId) {
  return findActiveShare(lessonId, teacherUserId, VIEW_PERMISSION);
}

async function findActiveTeachShare(lessonId, teacherUserId) {
  return findActiveShare(lessonId, teacherUserId, TEACH_PERMISSION);
}

async function grantShare({ lessonId, teacherId, sharedBy, permission = VIEW_PERMISSION }) {
  const normalizedPermission = normalizeSharePermission(permission);

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
    throw Object.assign(new Error("Recipient must be a teacher account"), { status: 400 });
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
    existing.permission = normalizedPermission;
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
    permission: normalizedPermission,
    sharedBy,
    sharedAt: now,
    status: ACTIVE_STATUS,
  });
  return created.toObject();
}

async function grantViewShare(args) {
  return grantShare({ ...args, permission: VIEW_PERMISSION });
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
  const permission = share.permission || VIEW_PERMISSION;
  return {
    id: String(share._id),
    lessonId: String(share.lessonId),
    teacherId: String(share.teacherId),
    teacherName,
    teacherEmail: reviewer?.email || "",
    schoolName: reviewerSchoolLabel(reviewer),
    permission,
    permissionLabel: SHARE_PERMISSION_LABELS[permission] || String(permission),
    reviewStatus:
      share.status === ACTIVE_STATUS
        ? permission === TEACH_PERMISSION
          ? "ready_to_teach"
          : "waiting_for_review"
        : "revoked",
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

async function listSharedLessonsForTeacher(teacherUserId, permission) {
  const shares = await LessonShare.find({
    teacherId: teacherUserId,
    status: ACTIVE_STATUS,
    permission,
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

  const accessRole = permission === TEACH_PERMISSION ? "shared_teach" : "shared_review";

  return shares
    .map((share) => {
      const lesson = lessonMap.get(String(share.lessonId));
      if (!lesson) return null;
      const sharer = sharerMap.get(String(share.sharedBy));
      return {
        ...toListSafeLesson(lesson),
        accessRole,
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

async function listReviewRequestsForTeacher(teacherUserId) {
  return listSharedLessonsForTeacher(teacherUserId, VIEW_PERMISSION);
}

async function listTeachingLibraryForTeacher(teacherUserId) {
  return listSharedLessonsForTeacher(teacherUserId, TEACH_PERMISSION);
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

async function getShareMetaForAccess(lessonId, teacherUserId, accessReason) {
  if (!lessonId || !teacherUserId || !accessReason) return null;
  const permission =
    accessReason === "SHARED_TEACH"
      ? TEACH_PERMISSION
      : accessReason === "SHARED_REVIEW"
        ? VIEW_PERMISSION
        : null;
  if (!permission) return null;
  const share = await findActiveShare(lessonId, teacherUserId, permission);
  if (!share) return null;
  const sharer = await User.findById(share.sharedBy).select("firstName lastName email").lean();
  const sharedByName = sharer
    ? [sharer.firstName, sharer.lastName].filter(Boolean).join(" ").trim() || sharer.email
    : "";
  return {
    permission: share.permission,
    sharedAt: share.sharedAt,
    sharedBy: String(share.sharedBy),
    sharedByName,
  };
}

module.exports = {
  VIEW_PERMISSION,
  TEACH_PERMISSION,
  ACTIVE_STATUS,
  BLOCKED_SHARE_LESSON_STATUSES,
  getLessonWorkflowStatus,
  isLessonShareable,
  canManageShares,
  findActiveShare,
  findActiveViewShare,
  findActiveTeachShare,
  grantShare,
  grantViewShare,
  revokeShare,
  listSharesForLesson,
  listReviewRequestsForTeacher,
  listTeachingLibraryForTeacher,
  lookupTeacherByEmail,
  getShareMetaForAccess,
};
