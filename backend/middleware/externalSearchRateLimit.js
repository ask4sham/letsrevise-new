/**
 * PR-021: Rate limit external search fallback.
 * Teachers: 3/min, admins: 10/min.
 * Only applies when allowExternal=true. Skip otherwise.
 */
const WINDOW_MS = 60 * 1000; // 1 minute
const LIMIT_TEACHER = 3;
const LIMIT_ADMIN = 10;

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

function cleanup() {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.resetAt <= now) store.delete(k);
  }
}

module.exports = function externalSearchRateLimit(req, res, next) {
  const allowExternal = req.body?.allowExternal === true;
  if (!allowExternal) return next();

  const userId = getUserId(req);
  if (!userId) return next();

  const limit = isAdmin(req) ? LIMIT_ADMIN : LIMIT_TEACHER;
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
      error: "Too many external search requests. Please wait a moment and try again.",
    });
  }

  next();
};
