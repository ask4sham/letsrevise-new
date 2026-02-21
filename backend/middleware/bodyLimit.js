/**
 * PR-HARD-2: Reject oversized payloads for bulk/upload endpoints before body parsing.
 * Returns 413 Payload Too Large.
 */
const { BULK_BODY_LIMIT_BYTES } = require("../config/limits");

function isBulkOrUploadPath(path) {
  return /\/bulk(\/|$)/.test(path) || /\/upload(\/|$)/.test(path) || /\/flashcard-bank\/import/.test(path);
}

function bodyLimitMiddleware(req, res, next) {
  if (req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH") return next();
  if (!isBulkOrUploadPath(req.path)) return next();

  const len = parseInt(req.get("content-length"), 10);
  if (Number.isNaN(len)) return next(); // chunked; let express.json handle

  if (len > BULK_BODY_LIMIT_BYTES) {
    return res.status(413).json({ error: "Payload too large", maxBytes: BULK_BODY_LIMIT_BYTES });
  }
  next();
}

module.exports = bodyLimitMiddleware;
