// Shared Express middleware index:
// - Central export point for auth, subscription, and AI job-related middleware.
// - `requireAiJobAccess` is currently a no-op placeholder; enforcement for
//   AI generation jobs will be added incrementally in later phases.

const auth = require("./auth");
const requireActiveSubscription = require("./requireActiveSubscription");
const requireAdmin = require("./requireAdmin");
const requireAiJobAccess = require("./requireAiJobAccess");
const requireLessonAccess = require("./requireLessonAccess");

module.exports = {
  auth,
  requireActiveSubscription,
  requireAdmin,
  requireAiJobAccess,
  requireLessonAccess,
};

