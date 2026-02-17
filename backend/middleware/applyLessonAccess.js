// backend/middleware/applyLessonAccess.js
const canAccessContent = require("./canAccessContent");

/**
 * Standard lesson access gate. Prefer this in routes to avoid option drift.
 * Pass options through to canAccessContent({ ...options }).
 */
module.exports = function applyLessonAccess(options = {}) {
  return canAccessContent(options);
};
