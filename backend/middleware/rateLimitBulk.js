/**
 * PR-HARD-2: Rate limiters for bulk, upload, and attempt endpoints.
 * Configurable via RATE_LIMIT_ENABLED=1, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_*.
 */
const rateLimit = require("express-rate-limit");
const {
  RATE_LIMIT_ENABLED,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_BULK,
  RATE_LIMIT_MAX_UPLOAD,
  RATE_LIMIT_MAX_ATTEMPT,
} = require("../config/limits");

function noop(req, res, next) {
  next();
}

function createBulkLimiter(opts = {}) {
  const max = opts.max != null ? opts.max : RATE_LIMIT_MAX_BULK;
  if (!RATE_LIMIT_ENABLED && max !== 0) return noop;
  return rateLimit({
    windowMs: opts.windowMs ?? RATE_LIMIT_WINDOW_MS,
    max,
    message: { error: "Too many requests" },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

function createUploadLimiter() {
  if (!RATE_LIMIT_ENABLED) return noop;
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_UPLOAD,
    message: { error: "Too many uploads" },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

function createAttemptLimiter() {
  if (!RATE_LIMIT_ENABLED) return noop;
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_ATTEMPT,
    message: { error: "Too many attempts" },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

module.exports = {
  createBulkLimiter,
  createUploadLimiter,
  createAttemptLimiter,
};
