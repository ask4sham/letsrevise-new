/**
 * PR-HARD-2: Input limits, upload constraints, rate limit config.
 * Used by middleware and routes.
 */

// Bulk body limit (bytes) — JSON/text for preview and import
const BULK_BODY_LIMIT_BYTES = Number(process.env.BULK_BODY_LIMIT_BYTES) || 2 * 1024 * 1024; // 2MB

// Bulk text length cap (chars) — prevent huge strings before parse
const BULK_MAX_TEXT_LENGTH = Number(process.env.BULK_MAX_TEXT_LENGTH) || 2 * 1024 * 1024; // 2MB

// File upload
const MAX_FILES_PER_REQUEST = Number(process.env.MAX_FILES_PER_REQUEST) || 10;
const FILE_UPLOAD_MAX_MB = Number(process.env.FILE_UPLOAD_MAX_MB) || 25;

// Rate limiting (env overridable)
const RATE_LIMIT_ENABLED = String(process.env.RATE_LIMIT_ENABLED || "1") === "1";
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000; // 1 min
const RATE_LIMIT_MAX_BULK = Number(process.env.RATE_LIMIT_MAX_BULK) || 30; // per window
const RATE_LIMIT_MAX_UPLOAD = Number(process.env.RATE_LIMIT_MAX_UPLOAD) || 20;
const RATE_LIMIT_MAX_ATTEMPT = Number(process.env.RATE_LIMIT_MAX_ATTEMPT) || 60; // save/submit

module.exports = {
  BULK_BODY_LIMIT_BYTES,
  BULK_MAX_TEXT_LENGTH,
  MAX_FILES_PER_REQUEST,
  FILE_UPLOAD_MAX_MB,
  RATE_LIMIT_ENABLED,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_BULK,
  RATE_LIMIT_MAX_UPLOAD,
  RATE_LIMIT_MAX_ATTEMPT,
};
