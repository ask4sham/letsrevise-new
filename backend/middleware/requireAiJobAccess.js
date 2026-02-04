// AI generation job access control middleware (placeholder — no enforcement yet).
// In future phases this will enforce AI job ownership and visibility rules
// (e.g. only job owners, relevant teachers, or admins may access a job).
// It is intentionally a no-op during groundwork; enforcement will be added incrementally.

function requireAiJobAccess(req, res, next) {
  return next();
}

module.exports = requireAiJobAccess;

