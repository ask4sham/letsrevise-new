/**
 * PR-029: Rate limit for topic-summary/to-lesson — teachers 3/min, admins 10/min.
 */
const rateLimit = require("express-rate-limit");

const topicSummaryToLessonRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => {
    const role = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
    if (role === "admin" || req.user?.isAdmin === true) return 10;
    return 3;
  },
  message: { error: "Too many requests. Try again in a minute." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `topicSummaryToLesson:${req.user?._id || req.user?.userId || req.ip}`,
  skip: (req) => {
    const role = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
    return role !== "teacher" && role !== "admin" && !req.user?.isAdmin;
  },
});

module.exports = topicSummaryToLessonRateLimit;
