/**
 * Always-on route-specific upload rate limiters.
 * Independent of RATE_LIMIT_ENABLED (createUploadLimiter no-op switch).
 * Key: authenticated user id from req.user (never from body); IP fallback only if absent.
 */
const rateLimit = require("express-rate-limit");

const WINDOW_MS = 60 * 1000;
const IMAGE_UPLOAD_RATE_MAX = 20;
const VIDEO_UPLOAD_RATE_MAX = 5;

function uploadUserKey(prefix, req) {
  const id = req.user?._id || req.user?.id || req.user?.userId || null;
  if (id) return `${prefix}:user:${String(id)}`;
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  return `${prefix}:ip:${ip}`;
}

/**
 * @param {{ prefix: string, max: number, windowMs?: number }} opts
 */
function createAlwaysOnUploadLimiter(opts) {
  const prefix = opts.prefix;
  const max = opts.max;
  const windowMs = opts.windowMs != null ? opts.windowMs : WINDOW_MS;
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many uploads" },
    keyGenerator: (req) => uploadUserKey(prefix, req),
    // Custom keyGenerator already handles missing user via IP; skip v7 IPv6 helper requirement.
    validate: { keyGeneratorIpFallback: false },
  });
}

/** Shared by /image, /lesson-image, /lesson-media */
const imageUploadLimiter = createAlwaysOnUploadLimiter({
  prefix: "upload:image",
  max: IMAGE_UPLOAD_RATE_MAX,
});

/** Shared by router and direct app.js video mounts */
const videoUploadLimiter = createAlwaysOnUploadLimiter({
  prefix: "upload:video",
  max: VIDEO_UPLOAD_RATE_MAX,
});

module.exports = {
  createAlwaysOnUploadLimiter,
  imageUploadLimiter,
  videoUploadLimiter,
  IMAGE_UPLOAD_RATE_MAX,
  VIDEO_UPLOAD_RATE_MAX,
  WINDOW_MS,
};
