/**
 * PR-014: Rate limit /api/generate — 3/min teacher, 10/min admin.
 * PR-031: weak-evidence-fix uses stricter limits: 2/min teacher, 6/min admin.
 * PR-032: practice-set uses 3/min teacher, 10/min admin (same as default).
 */
const WINDOW_MS = 60 * 1000;
const LIMIT_TEACHER = 3;
const LIMIT_ADMIN = 10;
const LIMIT_WEAK_FIX_TEACHER = 2;
const LIMIT_WEAK_FIX_ADMIN = 6;

const store = new Map();

function getUserId(req) {
  const u = req.user;
  if (!u) return null;
  return String(u._id || u.userId || u.id || "");
}

function isAdmin(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "admin" || req.user?.isAdmin === true;
}

function isWeakEvidenceFixRoute(req) {
  const path = (req.originalUrl || req.url || req.path || "").toString();
  return path.includes("/weak-evidence-fix");
}

function isPracticeSetRoute(req) {
  const path = (req.originalUrl || req.url || req.path || "").toString();
  return path.includes("/practice-set");
}

function cleanup() {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.resetAt <= now) store.delete(k);
  }
}

module.exports = function contentGenerationRateLimit(req, res, next) {
  const userId = getUserId(req);
  if (!userId) return next();

  let limit;
  if (isWeakEvidenceFixRoute(req)) {
    limit = isAdmin(req) ? LIMIT_WEAK_FIX_ADMIN : LIMIT_WEAK_FIX_TEACHER;
  } else {
    limit = isAdmin(req) ? LIMIT_ADMIN : LIMIT_TEACHER;
  }
  const routeKey = isWeakEvidenceFixRoute(req) ? "weak" : isPracticeSetRoute(req) ? "practice" : "default";
  const storeKey = routeKey !== "default" ? `${routeKey}:${userId}` : userId;
  const now = Date.now();

  if (store.size > 1000) cleanup();

  let entry = store.get(storeKey);
  if (!entry) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(storeKey, entry);
  }

  if (now >= entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }

  entry.count++;
  if (entry.count > limit) {
    return res.status(429).json({
      error: "Too many generation requests. Please wait a moment and try again.",
    });
  }

  next();
};
