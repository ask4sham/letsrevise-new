/**
 * Rate limit for AI composite exam draft generation.
 * Teachers 6/min, admins 20/min.
 */
const rateLimit = require("express-rate-limit");

const aiCompositeDraftRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => {
    const role = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
    if (role === "admin" || req.user?.isAdmin === true) return 20;
    return 6;
  },
  message: { success: false, msg: "Too many AI draft requests. Try again in a minute.", error: "Too many AI draft requests. Try again in a minute." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `aiCompositeDraft:${req.user?._id || req.user?.userId || req.ip}`,
});

module.exports = aiCompositeDraftRateLimit;
