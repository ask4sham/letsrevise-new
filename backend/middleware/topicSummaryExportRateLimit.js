/**
 * PR-025: Rate limit for topic summary PDF export.
 * Students 2/min, teachers 6/min, admins 20/min.
 */
const rateLimit = require("express-rate-limit");

const topicSummaryExportRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => {
    const role = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
    if (role === "admin" || req.user?.isAdmin === true) return 20;
    if (role === "student") return 2;
    return 6;
  },
  message: { error: "Too many PDF export requests. Try again in a minute." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `topicSummaryExport:${req.user?._id || req.user?.userId || req.ip}`,
  skip: (req) => {
    const role = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
    return role !== "teacher" && role !== "admin" && role !== "student" && !req.user?.isAdmin;
  },
});

module.exports = topicSummaryExportRateLimit;
