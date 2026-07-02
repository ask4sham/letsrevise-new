const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");
const { getLessonOwnerId } = require("../utils/lessonPayload");
const { canAccessContent: checkStudentEntitlement } = require("../utils/canAccessContent");
const { collectExamQuestionIdsFromLesson } = require("../utils/collectExamQuestionIdsFromLesson");
const {
  findActiveViewShare,
  findActiveTeachShare,
  isLessonShareable,
} = require("../services/lessonShareService");

function isAdmin(user) {
  const t = (user?.userType || user?.role || user?.isAdmin || "").toString().toLowerCase();
  return t === "admin" || user?.isAdmin === true;
}

function isLessonReviewer(user) {
  if (isAdmin(user)) return true;
  return (user?.staffRole || "").toString().toLowerCase() === "content_manager";
}

function isTeacher(user) {
  return user?.userType === "teacher";
}

function lessonIsPublished(lesson) {
  const status = (lesson?.status || (lesson?.isPublished ? "published" : "draft")).toString().toLowerCase();
  return status === "published";
}

async function resolveTeacherShareAccess(lessonId, userId, lesson, { classroomMode = false } = {}) {
  if (!userId || !lesson || !isLessonShareable(lesson)) return null;
  const teachShare = await findActiveTeachShare(lessonId, userId);
  if (classroomMode && teachShare) return { reason: "SHARED_TEACH" };
  if (teachShare) return { reason: "SHARED_TEACH" };
  const viewShare = await findActiveViewShare(lessonId, userId);
  if (viewShare) return { reason: "SHARED_REVIEW" };
  return null;
}

async function resolveLessonEmbedViewAccess(user, lesson, { classroomMode = false } = {}) {
  if (!user || !lesson) return { allowed: false, reason: "UNAUTHENTICATED" };
  if (isLessonReviewer(user)) return { allowed: true, reason: "ADMIN" };

  const lessonId = lesson._id;
  const userId = user._id ?? user.id ?? user.userId;
  const ownerId = getLessonOwnerId(lesson);
  const isOwner = ownerId != null && userId != null && String(ownerId) === String(userId);
  const isPublished = lessonIsPublished(lesson);
  const isTeacherUser = isTeacher(user);

  if (!isPublished) {
    if (isTeacherUser && isOwner) return { allowed: true, reason: "OWNER_DRAFT" };
    const shared = userId ? await resolveTeacherShareAccess(lessonId, userId, lesson, { classroomMode }) : null;
    if (shared) return { allowed: true, reason: shared.reason };
    return { allowed: false, reason: "NOT_PUBLISHED" };
  }

  if (isOwner) return { allowed: true, reason: "OWNER" };
  const shared = userId ? await resolveTeacherShareAccess(lessonId, userId, lesson, { classroomMode }) : null;
  if (shared) return { allowed: true, reason: shared.reason };

  const ent = await checkStudentEntitlement(user, {
    _id: lessonId,
    id: lessonId,
    isPublished: true,
    isFreePreview: lesson.isFreePreview,
    status: lesson.status,
  });
  if (ent.allowed || ent.reason === "FREE_PREVIEW") {
    return { allowed: true, reason: ent.reason };
  }
  if (isTeacherUser) return { allowed: false, reason: "ACCESS_DENIED" };
  return { allowed: false, reason: ent.reason || "NOT_ENTITLED" };
}

function viewerMaySeeDraftEmbedQuestions(user, lesson, access) {
  if (isLessonReviewer(user)) return true;
  const ownerId = getLessonOwnerId(lesson);
  const userId = user?._id ?? user?.id ?? user?.userId;
  const isOwner = ownerId != null && userId != null && String(ownerId) === String(userId);
  if (isOwner && isTeacher(user)) return true;
  if (!lessonIsPublished(lesson) && access?.allowed && ["SHARED_TEACH", "SHARED_REVIEW"].includes(access.reason)) {
    return true;
  }
  return false;
}

function normalizeRequestedIds(ids) {
  if (!Array.isArray(ids)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of ids) {
    const id = String(raw ?? "").trim();
    if (!mongoose.Types.ObjectId.isValid(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 50) break;
  }
  return out;
}

/**
 * Fetch exam questions embedded in a lesson, with lesson-context access control.
 * Only returns ids that appear in lesson blocks; never exposes unrelated bank rows.
 */
async function fetchEmbeddedExamQuestionsForLesson(user, lessonId, requestedIds, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(lessonId))) {
    return { ok: false, status: 400, error: "Invalid lessonId" };
  }
  const lesson = await Lesson.findById(lessonId)
    .select("_id teacherId status isPublished isFreePreview pages organisationId")
    .lean();
  if (!lesson) return { ok: false, status: 404, error: "Lesson not found" };

  const access = await resolveLessonEmbedViewAccess(user, lesson, options);
  if (!access.allowed) {
    return { ok: false, status: 404, error: "LESSON_NOT_FOUND", reason: access.reason };
  }

  const embedded = collectExamQuestionIdsFromLesson(lesson);
  const wanted = normalizeRequestedIds(requestedIds).filter((id) => embedded.has(id));
  if (!wanted.length) {
    return { ok: true, questions: [], access };
  }

  const allowDraft = viewerMaySeeDraftEmbedQuestions(user, lesson, access);
  const query = {
    _id: { $in: wanted },
    isArchived: { $ne: true },
  };
  if (!allowDraft) query.status = "published";

  const questions = await ExamQuestion.find(query).lean();
  return { ok: true, questions, access, allowDraft };
}

/** Teacher editor: fetch own bank questions by id (not lesson-embedded). */
async function fetchTeacherOwnedExamQuestionsByIds(user, requestedIds) {
  if (!isTeacher(user) && !isLessonReviewer(user)) {
    return { ok: false, status: 403, error: "Teachers only" };
  }
  const teacherId = user.userId || user._id || user.id;
  const wanted = normalizeRequestedIds(requestedIds);
  if (!wanted.length) return { ok: true, questions: [] };

  const query = {
    _id: { $in: wanted },
    isArchived: { $ne: true },
  };
  if (!isLessonReviewer(user)) query.teacherId = teacherId;

  const questions = await ExamQuestion.find(query).lean();
  return { ok: true, questions };
}

module.exports = {
  collectExamQuestionIdsFromLesson,
  fetchEmbeddedExamQuestionsForLesson,
  fetchTeacherOwnedExamQuestionsByIds,
  resolveLessonEmbedViewAccess,
};
