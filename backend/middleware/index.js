// Shared Express middleware index:
// - Central export point for auth, subscription, and AI job-related middleware.
// - `requireAiJobAccess` is deprecated (re-exports auth). Prefer `auth` +
//   mount-level `checkAdmin` for AI-generation-job routes.

const auth = require("./auth");
const requireActiveSubscription = require("./requireActiveSubscription");
const requireAdmin = require("./requireAdmin");
const requireAiJobAccess = require("./requireAiJobAccess");
const requireLessonAccess = require("./requireLessonAccess");
const requireLessonMediaUploader = require("./requireLessonMediaUploader");
const canAccessContent = require("./canAccessContent");
const applyLessonAccess = require("./applyLessonAccess");

module.exports = {
  auth,
  requireActiveSubscription,
  requireAdmin,
  requireAiJobAccess,
  requireLessonAccess,
  requireLessonMediaUploader,
  canAccessContent,
  applyLessonAccess,
};

