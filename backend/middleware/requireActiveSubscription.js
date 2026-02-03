const { isSubscriptionActive } = require("../utils/isSubscriptionActive");

/**
 * Require an active subscription for student/parent access to protected APIs.
 *
 * - Teachers and admins are always allowed through (no subscription check).
 * - Students/parents (and other non-admin roles) must have an active subscription
 *   as determined by `isSubscriptionActive(user)`.
 *
 * This middleware is intentionally used at the API layer so entitlement
 * rules stay consistent across all clients.
 */
function requireActiveSubscription(req, res, next) {
  const user = req.user;

  // Teachers/admins bypass subscription checks
  if (user && (user.userType === "teacher" || user.userType === "admin")) {
    return next();
  }

  // Students/parents (or any other non-admin roles) must have an active subscription
  if (!user || !isSubscriptionActive(user)) {
    return res.status(403).json({ message: "Subscription required" });
  }

  return next();
}

module.exports = requireActiveSubscription;

