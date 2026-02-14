const { isSubscriptionActive } = require("./isSubscriptionActive");

/**
 * Single source of truth for lesson content access (Phase 9 — backend-first).
 * Deny-by-default; explicit reasons for allow/deny for logging and 403 responses.
 *
 * All routes that gate lesson content must use this so rules stay in one place.
 * Pure function: no Express, no req/res.
 *
 * @param {Object|null|undefined} userOrOpts - User object, or { user, lesson } for legacy call style
 * @param {Object} [lesson] - Lesson access fields: id or _id, isFreePreview?, isPublished?
 * @returns {{ allowed: boolean, reason: string }} AccessDecision
 */
function canAccessContent(userOrOpts, lessonParam) {
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

  // Published-only visibility (optional product rule)
  const isPublished = lesson?.isPublished !== false;
  if (!isPublished) {
    return { allowed: false, reason: "NOT_PUBLISHED" };
  }

  // Rule 1: active subscription (uses normalized user.subscriptionV2; deny if missing — Phase 9B)
  if (isSubscriptionActive(user)) {
    return { allowed: true, reason: "SUB_ACTIVE" };
  }

  // Rule 2: purchased lesson (normalize IDs once to avoid ObjectId/string mismatches)
  const lessonId = lesson?._id ?? lesson?.id;
  const purchased = new Set(
    (user.purchasedLessons ?? []).map((pl) => String(pl?.lessonId ?? pl))
  );
  if (lessonId && purchased.has(String(lessonId))) {
    return { allowed: true, reason: "PURCHASED" };
  }

  // Rule 3: free preview (partial content)
  if (lesson?.isFreePreview === true) {
    return { allowed: true, reason: "FREE_PREVIEW" };
  }

  return { allowed: false, reason: "NOT_ENTITLED" };
}

module.exports = { canAccessContent };
