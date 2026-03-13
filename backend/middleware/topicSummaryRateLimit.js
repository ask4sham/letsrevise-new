/**
 * PR-024: Rate limit for topic summary — teachers 6/min, admins 20/min.
 * PR-024.1: students 3/min.
 */
const rateLimit = require("express-rate-limit");

const topicSummaryRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => {
    const role = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
    if (role === "admin" || req.user?.isAdmin === true) return 20;
    if (role === "student") return 3;
    return 6;
  },
  message: { error: "Too many topic summary requests. Try again in a minute." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `topicSummary:${req.user?._id || req.user?.userId || req.ip}`,
  skip: (req) => {
    const role = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
    return role !== "teacher" && role !== "admin" && role !== "student" && !req.user?.isAdmin;
  },
});

module.exports = topicSummaryRateLimit;
