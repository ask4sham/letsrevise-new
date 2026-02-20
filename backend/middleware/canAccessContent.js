/**
 * canAccessContent — Single choke-point middleware for lesson content access.
 * Removes entitlement logic duplication; use on all lesson/student content endpoints.
 *
 * Delegates to utils/canAccessContent for: subscription, purchase, free preview.
 * Returns 402 for NOT_ENTITLED (subscription/purchase required), 403 for other forbiddens.
 * allowBody: default false — only set true where lessonId cannot come from params/query (e.g. uploads).
 */
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const { canAccessContent: checkAccess } = require("../utils/canAccessContent");
const { getLessonOwnerId } = require("../utils/lessonPayload");

function resolveLessonId(req, allowBody = false) {
  return (
    req.params.lessonId ||
    req.params.id ||
    req.query.lessonId ||
    (allowBody ? req.body?.lessonId : undefined)
  );
}

function isAdmin(user) {
  const t = (user?.userType || user?.role || user?.isAdmin);
  return t === "admin" || t === true;
}

function isTeacher(user) {
  return user?.userType === "teacher";
}

/** Stable deny body for debugging and frontend consistency. */
function denyBody(lessonId, reason, error, published) {
  return {
    error: error || "FORBIDDEN",
    reason: reason || "FORBIDDEN",
    lessonId: lessonId != null ? String(lessonId) : undefined,
    published: !!published,
  };
}

module.exports = function canAccessContent(options = {}) {
  const {
    requirePublished = true,
    allowDraftForTeacher = true,
    allowAdmin = true,
    allowBody = false,
  } = options;

  return async function (req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthenticated" });
      }

      const lessonId = resolveLessonId(req, allowBody);
      if (!lessonId) {
        return res.status(400).json({ error: "Missing lessonId" });
      }
      if (!mongoose.Types.ObjectId.isValid(String(lessonId))) {
        return res.status(400).json({ error: "Invalid lessonId" });
      }

      const lesson = await Lesson.findById(lessonId).lean();
      if (!lesson) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      const lessonIdStr = String(lessonId);
      const status = (lesson.status || (lesson.isPublished ? "published" : "draft")).toString().toLowerCase();
      const isPublished = status === "published";

      if (allowAdmin && isAdmin(req.user)) {
        req.lesson = lesson;
        req.accessDecision = { allowed: true, reason: "ADMIN" };
        if (process.env.NODE_ENV !== "production") {
          console.info("[canAccessContent]", { userId: req.user._id?.toString(), lessonId: lessonIdStr, reason: "ADMIN" });
        }
        return next();
      }

      const ownerId = getLessonOwnerId(lesson);
      const isOwner =
        ownerId != null &&
        String(ownerId) === String(req.user._id || req.user.id);

      if (requirePublished && !isPublished) {
        if (
          allowDraftForTeacher &&
          (isTeacher(req.user) || req.user?.isTeacher) &&
          isOwner
        ) {
          req.lesson = lesson;
          req.accessDecision = { allowed: true, reason: "OWNER_DRAFT" };
          if (process.env.NODE_ENV !== "production") {
            console.info("[canAccessContent]", { userId: req.user._id?.toString(), lessonId: lessonIdStr, reason: "OWNER_DRAFT" });
          }
          return next();
        }
        return res.status(403).json(
          denyBody(lessonIdStr, "NOT_PUBLISHED", "Lesson not published", false)
        );
      }

      // Owner of a published lesson always gets full content (e.g. flashcards); avoids FREE_PREVIEW for own lesson.
      if (isOwner) {
        req.lesson = lesson;
        req.accessDecision = { allowed: true, reason: "OWNER" };
        if (process.env.NODE_ENV !== "production") {
          console.info("[canAccessContent]", { userId: req.user._id?.toString(), lessonId: lessonIdStr, reason: "OWNER" });
        }
        return next();
      }

      const decision = await checkAccess(req.user, {
        _id: lesson._id,
        id: lesson._id?.toString(),
        status,
        isPublished,
        isFreePreview: !!lesson.isFreePreview,
      });

      req.lesson = lesson;
      req.accessDecision = decision;

      if (process.env.NODE_ENV !== "production") {
        console.info("[canAccessContent]", { userId: req.user._id?.toString(), lessonId: lessonIdStr, reason: decision.reason });
      }

      if (!decision.allowed) {
        if (decision.reason === "NOT_ENTITLED") {
          return res.status(402).json(
            denyBody(lessonIdStr, "NOT_ENTITLED", "Subscription required", isPublished)
          );
        }
        if (decision.reason === "UNAUTHENTICATED") {
          return res.status(401).json({ error: "Unauthenticated" });
        }
        // FREE_PREVIEW: serve preview payload (handler uses reason to return first page only)
        if (decision.reason === "FREE_PREVIEW") {
          return next();
        }
        return res.status(403).json(
          denyBody(lessonIdStr, decision.reason, "FORBIDDEN", isPublished)
        );
      }

      return next();
    } catch (err) {
      console.error("canAccessContent middleware error:", err);
      return res.status(500).json({ error: "Access check failed" });
    }
  };
};
