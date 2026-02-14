/**
 * Phase 9B — /api/me: current user non-sensitive info (entitlements debug).
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

router.get("/entitlements", auth, (req, res) => {
  const user = req.user;
  const sub = user.subscriptionV2 ?? user.entitlements?.subscriptionV2 ?? null;
  const purchasedLessons = user.purchasedLessons ?? user.entitlements?.purchasedLessons ?? [];
  res.json({
    role: user.userType || user.role || null,
    shamCoinsBalance: user.shamCoins != null ? user.shamCoins : 0,
    subscription: sub
      ? {
          status: sub.status,
          expiresAt: sub.expiresAt ?? null,
          currentPeriodEnd: sub.currentPeriodEnd ?? null,
        }
      : null,
    purchasedLessonsCount: Array.isArray(purchasedLessons) ? purchasedLessons.length : 0,
  });
});

module.exports = router;
