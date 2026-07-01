/**
 * LetsRevise Approved catalogue — list, submit, approve, reject, retire (approved-lessons-v1).
 */
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const LessonApproval = require("../models/LessonApproval");

const TEACHER_LIBRARY_STATUSES = ["none", "pending_review", "approved", "rejected", "retired"];

const BLOCKED_LESSON_STATUSES = ["archived", "flagged"];

function getTeacherLibraryStatus(lesson) {
  const raw = lesson?.teacherLibrary?.status;
  if (raw && TEACHER_LIBRARY_STATUSES.includes(String(raw))) {
    return String(raw);
  }
  return "none";
}

function isApprovedCatalogueLesson(lesson) {
  if (!lesson) return false;
  const workflow = String(lesson.status || (lesson.isPublished ? "published" : "draft")).toLowerCase();
  if (workflow !== "published" || !lesson.isPublished) return false;
  if (BLOCKED_LESSON_STATUSES.includes(workflow)) return false;
  return getTeacherLibraryStatus(lesson) === "approved";
}

function isNotSetBoard(board) {
  const b = String(board || "").trim().toLowerCase();
  return !b || b === "not set" || b === "none";
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function levelToRegex(levelStr) {
  const s = String(levelStr || "").trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower.includes("gcse")) return /gcse/i;
  if (lower.includes("a-level") || lower.includes("alevel") || lower.includes("a level")) {
    return /a[-\s]?level/i;
  }
  if (lower.includes("igcse")) return /igcse/i;
  if (lower.includes("ks3")) return /ks3/i;
  return new RegExp(`^${escapeRegex(s)}$`, "i");
}

function buildApprovedLessonsQuery(filters = {}) {
  const query = {
    status: "published",
    isPublished: true,
    "teacherLibrary.status": "approved",
  };

  const { subject, level, topic, board, tier, q, search } = filters;
  const searchTerm = (q || search || "").trim();

  if (subject) query.subject = { $regex: `^${escapeRegex(String(subject).trim())}$`, $options: "i" };

  if (board !== undefined && board !== "") {
    if (isNotSetBoard(board)) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { board: { $exists: false } },
          { board: null },
          { board: "" },
          { board: { $regex: /^not set$/i } },
          { board: { $regex: /^none$/i } },
        ],
      });
    } else {
      query.board = { $regex: `^${escapeRegex(String(board).trim())}$`, $options: "i" };
    }
  }

  if (level) {
    const re = levelToRegex(level);
    if (re) query.level = re;
  }

  if (topic) {
    query.topic = { $regex: String(topic).trim(), $options: "i" };
  }

  if (tier) {
    query.tier = { $regex: `^${escapeRegex(String(tier).trim())}$`, $options: "i" };
  }

  if (searchTerm) {
    const re = new RegExp(escapeRegex(searchTerm), "i");
    query.$and = query.$and || [];
    query.$and.push({
      $or: [{ title: re }, { topic: re }, { subject: re }, { teacherName: re }, { description: re }],
    });
  }

  return query;
}

function toApprovedLessonCard(lesson) {
  const tl = lesson.teacherLibrary || {};
  const libraryStatus = getTeacherLibraryStatus(lesson);
  return {
    _id: lesson._id,
    id: String(lesson._id),
    title: lesson.title,
    subject: lesson.subject,
    level: lesson.level,
    board: lesson.board || "",
    examBoard: lesson.board || lesson.examBoard || "",
    topic: lesson.topic || "",
    tier: lesson.tier || "",
    status: lesson.status,
    isPublished: !!lesson.isPublished,
    teacherId: lesson.teacherId ? String(lesson.teacherId) : "",
    teacherName: lesson.teacherName || "",
    letsReviseApproved: libraryStatus === "approved",
    teacherLibraryStatus: libraryStatus,
    catalogueVersion: tl.version ?? null,
    submittedAt: tl.submittedAt || null,
    submittedBy: tl.submittedBy ? String(tl.submittedBy) : null,
    approvedAt: tl.approvedAt || null,
    approvedBy: tl.approvedBy ? String(tl.approvedBy) : null,
    rejectedAt: tl.rejectedAt || null,
    rejectionNotes: tl.rejectionNotes || "",
    retiredAt: tl.retiredAt || null,
    updatedAt: lesson.updatedAt,
    createdAt: lesson.createdAt,
    averageRating: lesson.averageRating ?? 0,
    totalRatings: lesson.totalRatings ?? 0,
  };
}

const ADMIN_CATALOGUE_TAB_STATUSES = {
  pending: "pending_review",
  pending_review: "pending_review",
  approved: "approved",
  rejected: "rejected",
  retired: "retired",
};

function normalizeAdminCatalogueTabStatus(tab) {
  const key = String(tab || "pending").toLowerCase();
  return ADMIN_CATALOGUE_TAB_STATUSES[key] || null;
}

function buildAdminCatalogueSort(libraryStatus, sort) {
  if (libraryStatus === "pending_review") {
    return sort === "oldest"
      ? { "teacherLibrary.submittedAt": 1, updatedAt: -1 }
      : { "teacherLibrary.submittedAt": -1, updatedAt: -1 };
  }
  if (libraryStatus === "approved") {
    return { "teacherLibrary.approvedAt": -1, updatedAt: -1 };
  }
  if (libraryStatus === "rejected") {
    return { "teacherLibrary.rejectedAt": -1, updatedAt: -1 };
  }
  if (libraryStatus === "retired") {
    return { "teacherLibrary.retiredAt": -1, updatedAt: -1 };
  }
  return { updatedAt: -1 };
}

async function listApprovedLessons(filters = {}) {
  const query = buildApprovedLessonsQuery(filters);
  const limit = Math.min(Math.max(parseInt(String(filters.limit || "50"), 10) || 50, 1), 100);
  const offset = Math.max(parseInt(String(filters.offset || "0"), 10) || 0, 0);

  const lessons = await Lesson.find(query)
    .select(
      "title subject level board topic tier status isPublished teacherId teacherName teacherLibrary averageRating totalRatings createdAt updatedAt"
    )
    .sort({ updatedAt: -1, createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  return lessons.map(toApprovedLessonCard);
}

async function listPendingCatalogueApprovals(options = {}) {
  return listCatalogueLessonsForAdmin("pending_review", options);
}

async function listCatalogueLessonsForAdmin(libraryStatus, options = {}) {
  const sort = options.sort === "oldest" ? "oldest" : "newest";
  const limit = Math.min(Math.max(parseInt(String(options.limit || "100"), 10) || 100, 1), 200);
  const offset = Math.max(parseInt(String(options.offset || "0"), 10) || 0, 0);

  const lessons = await Lesson.find({
    "teacherLibrary.status": libraryStatus,
    status: { $nin: BLOCKED_LESSON_STATUSES },
  })
    .select(
      "title subject level board topic tier status isPublished teacherId teacherName teacherLibrary averageRating totalRatings createdAt updatedAt"
    )
    .sort(buildAdminCatalogueSort(libraryStatus, sort))
    .skip(offset)
    .limit(limit)
    .lean();

  return lessons.map(toApprovedLessonCard);
}

async function getCatalogueStatusCounts() {
  const statuses = ["pending_review", "approved", "rejected", "retired"];
  const baseFilter = { status: { $nin: BLOCKED_LESSON_STATUSES } };
  const entries = await Promise.all(
    statuses.map(async (libraryStatus) => {
      const count = await Lesson.countDocuments({
        ...baseFilter,
        "teacherLibrary.status": libraryStatus,
      });
      return [libraryStatus, count];
    })
  );
  const counts = Object.fromEntries(entries);
  return {
    pending_review: counts.pending_review || 0,
    approved: counts.approved || 0,
    rejected: counts.rejected || 0,
    retired: counts.retired || 0,
    pending: counts.pending_review || 0,
  };
}

async function recordApprovalAudit({ lessonId, action, actorId, notes, internalNotes, previousStatus, newStatus }) {
  return LessonApproval.create({
    lessonId,
    action,
    actorId,
    notes: (notes || "").toString(),
    internalNotes: (internalNotes || "").toString(),
    previousStatus,
    newStatus,
  });
}

async function submitLessonForApproval({ lessonId, userId }) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw Object.assign(new Error("Lesson not found"), { status: 404 });
  }

  const ownerId = lesson.teacherId?._id ?? lesson.teacherId;
  if (String(ownerId) !== String(userId)) {
    throw Object.assign(new Error("Only the lesson owner can submit for approval"), { status: 403 });
  }

  const workflow = String(lesson.status || "draft").toLowerCase();
  if (BLOCKED_LESSON_STATUSES.includes(workflow)) {
    throw Object.assign(new Error("Archived or flagged lessons cannot be submitted for approval"), {
      status: 400,
      code: "LESSON_NOT_SUBMITTABLE",
    });
  }

  const current = getTeacherLibraryStatus(lesson);
  if (current === "approved") {
    throw Object.assign(new Error("Lesson is already approved for the catalogue"), {
      status: 409,
      code: "ALREADY_APPROVED",
    });
  }
  if (current === "pending_review") {
    return {
      alreadyPending: true,
      lesson: { id: String(lesson._id), teacherLibraryStatus: "pending_review" },
    };
  }

  const previousStatus = current;
  const action = previousStatus === "none" ? "submitted" : "resubmitted";
  const now = new Date();

  lesson.teacherLibrary = lesson.teacherLibrary || {};
  lesson.teacherLibrary.status = "pending_review";
  lesson.teacherLibrary.submittedAt = now;
  lesson.teacherLibrary.submittedBy = userId;
  lesson.teacherLibrary.rejectedAt = undefined;
  lesson.teacherLibrary.rejectedBy = undefined;
  lesson.teacherLibrary.rejectionNotes = undefined;
  lesson.markModified("teacherLibrary");
  await lesson.save();

  await recordApprovalAudit({
    lessonId: lesson._id,
    action,
    actorId: userId,
    previousStatus,
    newStatus: "pending_review",
  });

  return {
    alreadyPending: false,
    lesson: { id: String(lesson._id), teacherLibraryStatus: "pending_review" },
  };
}

async function approveLessonForCatalogue({ lessonId, adminId, internalNotes }) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw Object.assign(new Error("Lesson not found"), { status: 404 });
  }

  const current = getTeacherLibraryStatus(lesson);
  if (current !== "pending_review") {
    throw Object.assign(new Error("Only pending catalogue submissions can be approved"), {
      status: 409,
      code: "INVALID_STATE",
    });
  }

  const now = new Date();
  lesson.teacherLibrary = lesson.teacherLibrary || {};
  lesson.teacherLibrary.status = "approved";
  lesson.teacherLibrary.approvedAt = now;
  lesson.teacherLibrary.approvedBy = adminId;
  lesson.teacherLibrary.version = (lesson.teacherLibrary.version || 0) + 1;
  lesson.markModified("teacherLibrary");
  await lesson.save();

  await recordApprovalAudit({
    lessonId: lesson._id,
    action: "approved",
    actorId: adminId,
    internalNotes,
    previousStatus: current,
    newStatus: "approved",
  });

  return { lesson: { id: String(lesson._id), teacherLibraryStatus: "approved" } };
}

async function rejectLessonForCatalogue({ lessonId, adminId, notes, internalNotes }) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw Object.assign(new Error("Lesson not found"), { status: 404 });
  }

  const current = getTeacherLibraryStatus(lesson);
  if (current !== "pending_review") {
    throw Object.assign(new Error("Only pending catalogue submissions can be rejected"), {
      status: 409,
      code: "INVALID_STATE",
    });
  }

  const now = new Date();
  lesson.teacherLibrary = lesson.teacherLibrary || {};
  lesson.teacherLibrary.status = "rejected";
  lesson.teacherLibrary.rejectedAt = now;
  lesson.teacherLibrary.rejectedBy = adminId;
  lesson.teacherLibrary.rejectionNotes = (notes || "").toString();
  lesson.teacherLibrary.internalNotes = (internalNotes || lesson.teacherLibrary.internalNotes || "").toString();
  lesson.markModified("teacherLibrary");
  await lesson.save();

  await recordApprovalAudit({
    lessonId: lesson._id,
    action: "rejected",
    actorId: adminId,
    notes,
    internalNotes,
    previousStatus: current,
    newStatus: "rejected",
  });

  return {
    lesson: {
      id: String(lesson._id),
      teacherLibraryStatus: "rejected",
      rejectionNotes: lesson.teacherLibrary.rejectionNotes,
    },
  };
}

async function retireLessonFromCatalogue({ lessonId, adminId, internalNotes }) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw Object.assign(new Error("Lesson not found"), { status: 404 });
  }

  const current = getTeacherLibraryStatus(lesson);
  if (current !== "approved") {
    throw Object.assign(new Error("Only approved catalogue lessons can be retired"), {
      status: 409,
      code: "INVALID_STATE",
    });
  }

  const now = new Date();
  lesson.teacherLibrary = lesson.teacherLibrary || {};
  lesson.teacherLibrary.status = "retired";
  lesson.teacherLibrary.retiredAt = now;
  lesson.teacherLibrary.retiredBy = adminId;
  if (internalNotes) {
    lesson.teacherLibrary.internalNotes = internalNotes.toString();
  }
  lesson.markModified("teacherLibrary");
  await lesson.save();

  await recordApprovalAudit({
    lessonId: lesson._id,
    action: "retired",
    actorId: adminId,
    internalNotes,
    previousStatus: current,
    newStatus: "retired",
  });

  return { lesson: { id: String(lesson._id), teacherLibraryStatus: "retired" } };
}

/**
 * Option A: approved catalogue lessons return to pending_review when edited.
 * Call before persisting lesson content changes (or on unpublish).
 */
function markCataloguePendingReReview(lesson, { actorId } = {}) {
  const current = getTeacherLibraryStatus(lesson);
  if (current !== "approved") {
    return { changed: false };
  }

  const now = new Date();
  lesson.teacherLibrary = lesson.teacherLibrary || {};
  lesson.teacherLibrary.status = "pending_review";
  lesson.teacherLibrary.submittedAt = now;
  if (actorId) lesson.teacherLibrary.submittedBy = actorId;
  lesson.markModified("teacherLibrary");
  return { changed: true, previousStatus: current };
}

async function recordCatalogueReReviewAfterEdit({ lessonId, actorId, previousStatus = "approved" }) {
  return recordApprovalAudit({
    lessonId,
    action: "resubmitted",
    actorId,
    notes: "Catalogue re-review required after lesson edit",
    previousStatus,
    newStatus: "pending_review",
  });
}

module.exports = {
  TEACHER_LIBRARY_STATUSES,
  getTeacherLibraryStatus,
  isApprovedCatalogueLesson,
  buildApprovedLessonsQuery,
  listApprovedLessons,
  listPendingCatalogueApprovals,
  listCatalogueLessonsForAdmin,
  getCatalogueStatusCounts,
  normalizeAdminCatalogueTabStatus,
  submitLessonForApproval,
  approveLessonForCatalogue,
  rejectLessonForCatalogue,
  retireLessonFromCatalogue,
  markCataloguePendingReReview,
  recordCatalogueReReviewAfterEdit,
  toApprovedLessonCard,
};
