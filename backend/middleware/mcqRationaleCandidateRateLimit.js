/**
 * Short-window rate limit for V2.3A rationale candidate generation.
 * Per authenticated actor; conservative pilot defaults.
 */
const rateLimit = require("express-rate-limit");

const mcqRationaleCandidateRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => {
    const role = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
    if (role === "admin" || req.user?.isAdmin === true) return 10;
    return 6;
  },
  message: {
    error: "Too many rationale candidate requests. Try again in a minute.",
    code: "RATE_LIMITED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    `mcqRationaleCandidate:${req.user?._id || req.user?.userId || req.ip}`,
});

module.exports = mcqRationaleCandidateRateLimit;
