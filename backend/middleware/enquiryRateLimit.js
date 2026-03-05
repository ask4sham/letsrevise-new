/**
 * PR-006: Rate limit /api/enquiry — per userId.
 * PR-007: Students 5/min, teachers 10/min, admins 30/min.
 * In-memory Map (simple; resets on restart). Document limitations for production.
 */
const WINDOW_MS = 60 * 1000; // 1 minute
const LIMIT_STUDENT = 5;
const LIMIT_TEACHER = 10;
const LIMIT_ADMIN = 30;

const store = new Map(); // userId -> { count, resetAt }

function getUserId(req) {
  const u = req.user;
  if (!u) return null;
  return String(u._id || u.userId || u.id || "");
}

function isAdmin(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "admin" || req.user?.isAdmin === true;
}

function isStudent(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "student";
}

function cleanup() {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.resetAt <= now) store.delete(k);
  }
}

module.exports = function enquiryRateLimit(req, res, next) {
  const userId = getUserId(req);
  if (!userId) return next();

  let limit = LIMIT_TEACHER;
  if (isAdmin(req)) limit = LIMIT_ADMIN;
  else if (isStudent(req)) limit = LIMIT_STUDENT;
  const now = Date.now();

  if (store.size > 1000) cleanup();

  let entry = store.get(userId);
  if (!entry) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(userId, entry);
  }

  if (now >= entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }

  entry.count++;
  if (entry.count > limit) {
    return res.status(429).json({
      error: "Too many enquiries. Please wait a moment and try again.",
    });
  }

  next();
};
