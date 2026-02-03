const { isSubscriptionActive } = require("./isSubscriptionActive");

/**
 * Single source of truth for lesson content access.
 * All routes that gate lesson content (full vs preview) should use this helper
 * so rules stay in one place and stay consistent (subscription → purchase → preview).
 *
 * IMPORTANT:
 * - Expiry enforcement is delegated to `isSubscriptionActive(user)`.
 * - We do NOT trust string flags or status fields on their own.
 *
 * Pure function: no Express, no req/res.
 *
 * @param {Object} opts
 * @param {Object} opts.user - Authenticated user (subscription, purchasedLessons)
 * @param {Object} opts.lesson - Lesson document (_id, isFreePreview)
 * @returns {{ allowed: true | false | "preview" }}
 */
function canAccessContent({ user, lesson }) {
  if (!user) {
    return { allowed: false };
  }

  // Subscription active (based on expiry) → full access to all content.
  if (isSubscriptionActive(user)) {
    return { allowed: true };
  }

  // User bought this lesson (purchasedLessons may be { lessonId } or raw id).
  const lessonId = lesson?._id ?? lesson?.id;
  const hasPurchased = Array.isArray(user.purchasedLessons) && user.purchasedLessons.some(
    (pl) => String(pl?.lessonId ?? pl) === String(lessonId)
  );
  if (hasPurchased) {
    return { allowed: true };
  }

  // Lesson allows free preview → caller can show limited content.
  if (lesson?.isFreePreview === true) {
    return { allowed: "preview" };
  }

  return { allowed: false };
}

module.exports = { canAccessContent };
