/**
 * Determine whether a user's subscription is currently active (Phase 9B).
 * Single source: contract isEntitledSubscriptionV2(user.subscriptionV2).
 * Auth middleware sets req.user.subscriptionV2 to normalized shape; use that only.
 *
 * @param {Object|null|undefined} user - User object (must have normalized subscriptionV2 from auth).
 * @returns {boolean} true if subscription is entitled (active/trialing, not expired).
 */
const { isEntitledSubscriptionV2 } = require("../contracts/subscriptionV2");

function isSubscriptionActive(user) {
  if (!user) return false;
  return isEntitledSubscriptionV2(user.subscriptionV2);
}

module.exports = { isSubscriptionActive };

