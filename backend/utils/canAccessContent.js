const { isSubscriptionActive } = require("./isSubscriptionActive");
const { hasStripeLetsReviseProAccess } = require("./stripeBillingAccess");
const LessonUnlock = require("../models/LessonUnlock");

/**
 * Whether the lesson allows free preview (first page only, no answers). Authorable via lesson.isFreePreview.
 */
function isFreePreviewAllowed(lesson) {
  return !!lesson?.isFreePreview;
}

/**
 * Check if user has a single-lesson unlock (credit/admin/promo) for this lesson.
 * ctx.unlockSet: optional Set of lessonId strings (preloaded for list endpoints to avoid N+1).
 */
async function hasLessonUnlock(userId, lessonId, ctx = {}) {
  if (!userId || !lessonId) return false;

  // Fast path: caller preloaded unlocks (prevents N+1)
  if (ctx.unlockSet && typeof ctx.unlockSet.has === "function") {
    return ctx.unlockSet.has(String(lessonId));
  }

  return !!(await LessonUnlock.exists({ userId, lessonId }));
}

/**
 * Single source of truth for lesson content access (Phase 9 — backend-first).
 * Deny-by-default; explicit reasons for allow/deny for logging and 403 responses.
 *
 * All routes that gate lesson content must use this so rules stay in one place.
 * Pure function: no Express, no req/res. Order: subscription > unlock > purchased > preview > deny.
 *
 * Signature: canAccessContent(user, lesson, ctx). ctx is exclusively the third parameter
 * and is never inferred from the second (avoids overload regressions).
 * Legacy form: canAccessContent({ user, lesson }) — lesson comes from first arg; to pass
 * ctx use the 3-arg form: canAccessContent({ user, lesson }, undefined, ctx).
 *
 * @param {Object|null|undefined} userOrOpts - User object, or { user, lesson } for legacy call style
 * @param {Object} [lessonParam] - Lesson access fields: id or _id, isFreePreview?, isPublished? (ignored when userOrOpts has .lesson)
 * @param {Object} [ctx] - Optional context, e.g. { unlockSet }; only ever the third argument
 * @returns {Promise<{ allowed: boolean, reason: string }>} AccessDecision
 */
async function canAccessContent(userOrOpts, lessonParam, ctx = {}) {
  const opts = userOrOpts && typeof userOrOpts === "object" && "user" in userOrOpts && "lesson" in userOrOpts;
  const user = opts ? userOrOpts.user : userOrOpts;
  const lesson = opts ? userOrOpts.lesson : lessonParam;
  // ctx is never read from lessonParam; always the third parameter

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

  // 1) subscriptionV2 admin grant / trial (platform-wide V1)
  if (isSubscriptionActive(user)) {
    return { allowed: true, reason: "SUB_ACTIVE" };
  }

  // 2) LetsRevise Pro via Stripe (universal premium; paidThrough is payment proof)
  if (hasStripeLetsReviseProAccess(user)) {
    return { allowed: true, reason: "STRIPE_LETSREVISE_PRO" };
  }

  // 3) Single-lesson unlock (credit/admin/promo)
  const lessonId = lesson?._id ?? lesson?.id;
  const userId = user._id ?? user.id;
  if (lessonId && userId && (await hasLessonUnlock(userId, lessonId, ctx))) {
    return { allowed: true, reason: "LESSON_UNLOCK" };
  }

  // 4) Purchased lesson (normalize IDs once to avoid ObjectId/string mismatches)
  const purchased = new Set(
    (user.purchasedLessons ?? []).map((pl) => String(pl?.lessonId ?? pl))
  );
  if (lessonId && purchased.has(String(lessonId))) {
    return { allowed: true, reason: "PURCHASED" };
  }

  // 5) Free preview (partial content) — authorable via lesson.isFreePreview. allowed: false so preview is never treated as full entitlement.
  if (isFreePreviewAllowed(lesson)) {
    return { allowed: false, reason: "FREE_PREVIEW" };
  }

  // 6) Not entitled
  return { allowed: false, reason: "NOT_ENTITLED" };
}

module.exports = { canAccessContent };
