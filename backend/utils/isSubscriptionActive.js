/**
 * Determine whether a user's subscription is currently active (Phase B).
 *
 * This helper is the authoritative check for subscription expiry:
 * - Prefers Phase B object model `subscriptionV2.expiresAt` when present.
 * - Falls back to `subscription.expiresAt` if some callers still use that shape.
 * - Does NOT trust string flags or status fields on their own.
 * - Safe to call from any backend layer (routes, services, hooks).
 *
 * @param {Object|null|undefined} user - The user document or plain object.
 * @returns {boolean} true if subscription is active (expiresAt is a future date), otherwise false.
 */
function isSubscriptionActive(user) {
  if (!user) {
    return false;
  }

  const sub = user.subscriptionV2 || user.subscription;
  if (!sub) {
    return false;
  }

  const expiresAt = sub.expiresAt;

  if (!expiresAt) {
    return false;
  }

  const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiryDate.getTime())) {
    return false;
  }

  const now = new Date();
  return expiryDate.getTime() > now.getTime();
}

module.exports = { isSubscriptionActive };

