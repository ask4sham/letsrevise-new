const { isSubscriptionActive } = require("./isSubscriptionActive");
const LessonUnlock = require("../models/LessonUnlock");

/**
 * Check if user has a single-lesson unlock (credit/admin/promo) for this lesson.
 */
async function hasLessonUnlock(userId, lessonId) {
  if (!userId || !lessonId) return false;
  return !!(await LessonUnlock.exists({
    userId,
    lessonId,
  }));
}

/**
 * Single source of truth for lesson content access (Phase 9 — backend-first).
 * Deny-by-default; explicit reasons for allow/deny for logging and 403 responses.
 *
 * All routes that gate lesson content must use this so rules stay in one place.
 * Pure function: no Express, no req/res. Order: subscription > unlock > purchased > preview > deny.
 *
 * @param {Object|null|undefined} userOrOpts - User object, or { user, lesson } for legacy call style
 * @param {Object} [lesson] - Lesson access fields: id or _id, isFreePreview?, isPublished?
 * @returns {Promise<{ allowed: boolean, reason: string }>} AccessDecision
 */
async function canAccessContent(userOrOpts, lessonParam) {
  const opts = userOrOpts && typeof userOrOpts === "object" && "user" in userOrOpts && "lesson" in userOrOpts;
  const user = opts ? userOrOpts.user : userOrOpts;
  const lesson = opts ? userOrOpts.lesson : lessonParam;

  // Deny-by-default
  if (!user) {
    return { allowed: false, reason: "UNAUTHENTICATED" };
  }

  // Admin override
  const role = (user.userType || user.role || "").toString().toLowerCase();
  if (role === "admin") {
    return { allowed: true, reason: "ADMIN" };
  }

  // Published-only visibility (Phase 9D: status is source of truth when present)
  const status = lesson?.status != null ? String(lesson.status).toLowerCase() : null;
  const isPublished =
    status !== null ? status === "published" : (lesson?.isPublished !== false);
  if (!isPublished) {
    return { allowed: false, reason: "NOT_PUBLISHED" };
  }

  // 1) Active subscription always wins
  if (isSubscriptionActive(user)) {
    return { allowed: true, reason: "SUB_ACTIVE" };
  }

  // 2) Single-lesson unlock (credit/admin/promo)
  const lessonId = lesson?._id ?? lesson?.id;
  const userId = user._id ?? user.id;
  if (lessonId && userId && (await hasLessonUnlock(userId, lessonId))) {
    return { allowed: true, reason: "LESSON_UNLOCK" };
  }

  // 3) Purchased lesson (normalize IDs once to avoid ObjectId/string mismatches)
  const purchased = new Set(
    (user.purchasedLessons ?? []).map((pl) => String(pl?.lessonId ?? pl))
  );
  if (lessonId && purchased.has(String(lessonId))) {
    return { allowed: true, reason: "PURCHASED" };
  }

  // 4) Free preview (partial content)
  if (lesson?.isFreePreview === true) {
    return { allowed: true, reason: "FREE_PREVIEW" };
  }

  // 5) Not entitled
  return { allowed: false, reason: "NOT_ENTITLED" };
}

module.exports = { canAccessContent };
