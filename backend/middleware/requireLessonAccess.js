/**
 * requireLessonAccess — API-level gate for lesson content (Phase 9).
 *
 * @deprecated Prefer middleware/canAccessContent() for new routes. This helper remains for
 *   routes that need allowBody (e.g. uploads) until they are migrated. Kept in sync: returns
 *   402 for NOT_ENTITLED (subscription required), 403 for other forbiddens; stable deny body.
 *
 * Fetches the lesson, runs canAccessContent(req.user, lesson). Sets req.lesson and req.accessDecision.
 *
 * @param {{ allowBody?: boolean }} [opts] - If allowBody: true, lessonId may be taken from req.body.lessonId (e.g. uploads). Default: only params/query.
 */
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const { canAccessContent } = require("../utils/canAccessContent");
const { getLessonOwnerId } = require("../utils/lessonPayload");

function isAdmin(user) {
  const t = (user?.userType || user?.role || "").toString().toLowerCase();
  return t === "admin";
}

function denyBody(lessonId, reason, error, published) {
  return {
    error: error || "FORBIDDEN",
    reason: reason || "FORBIDDEN",
    lessonId: lessonId != null ? String(lessonId) : undefined,
    published: !!published,
  };
}

function requireLessonAccess(opts = {}) {
  const allowBody = opts && opts.allowBody === true;

  return async (req, res, next) => {
    let lessonId =
      req.params.id ||
      req.params.lessonId ||
      req.query.lessonId;
    if ((!lessonId || typeof lessonId !== "string") && allowBody && req.body?.lessonId) {
      lessonId = req.body.lessonId;
    }

    if (!lessonId || typeof lessonId !== "string") {
      return res.status(400).json({ error: "MISSING_LESSON_ID" });
    }
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lesson id" });
    }

    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) {
      return res.status(404).json({ error: "LESSON_NOT_FOUND" });
    }

    const ownerId = getLessonOwnerId(lesson);
    const isOwner =
      req.user &&
      ownerId != null &&
      ownerId === String(req.user._id || req.user.id);
    if (isOwner || isAdmin(req.user)) {
      req.lesson = lesson;
      req.accessDecision = { allowed: true, reason: isAdmin(req.user) ? "ADMIN" : "OWNER" };
      return next();
    }

    const status = lesson.status || (lesson.isPublished ? "published" : "draft");
    const isPublished = String(status).toLowerCase() === "published";
    const decision = await canAccessContent(req.user ?? null, {
      id: lesson._id?.toString() ?? lesson.id,
      _id: lesson._id,
      status,
      isFreePreview: !!lesson.isFreePreview,
      isPublished,
    });

    req.lesson = lesson;
    req.accessDecision = decision;

    if (!decision.allowed) {
      const lessonIdStr = String(lessonId);
      if (decision.reason === "NOT_ENTITLED") {
        return res.status(402).json(
          denyBody(lessonIdStr, "NOT_ENTITLED", "Subscription required", isPublished)
        );
      }
      return res.status(403).json(
        denyBody(lessonIdStr, decision.reason, "FORBIDDEN", isPublished)
      );
    }

    return next();
  };
}

module.exports = requireLessonAccess;
