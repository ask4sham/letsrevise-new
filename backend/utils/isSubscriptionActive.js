/**
 * Determine whether a user's subscription is currently active (Phase B + Phase 9 lock).
 *
 * - Prefers subscriptionV2, falls back to subscription.
 * - If sub has a `status` field: only allowlist counts (active, trialing). Reject past_due, canceled, etc.
 * - If expiresAt is present: must be a future date.
 * - Encode as allowlist, not "!= inactive", so new statuses default to denied.
 *
 * @param {Object|null|undefined} user - The user document or plain object.
 * @returns {boolean} true if subscription is active.
 */
const ENTITLED_STATUSES = ["active", "trialing"];

function isSubscriptionActive(user) {
  if (!user) return false;

  const sub = user.subscriptionV2 || user.subscription;
  if (!sub) return false;

  const status = (sub.status || "").toString().toLowerCase();
  if (status && !ENTITLED_STATUSES.includes(status)) {
    return false;
  }

  const expiresAt = sub.expiresAt;
  if (!expiresAt) {
    return ENTITLED_STATUSES.includes(status);
  }

  const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiryDate.getTime())) return false;

  const now = new Date();
  return expiryDate.getTime() > now.getTime();
}

module.exports = { isSubscriptionActive };

