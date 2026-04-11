/**
 * Production-safe JSON errors: log full detail server-side; never leak stacks/internals to clients.
 */
const util = require("util");

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * @param {string} context - e.g. "auth/login"
 * @param {unknown} err
 * @param {import("express").Response} res
 * @param {object} [opts]
 * @param {number} [opts.status=500]
 * @param {Record<string, unknown>} [opts.extra] — merged into JSON (e.g. { ok: false })
 */
function sendInternalError(context, err, res, opts = {}) {
  const status = opts.status || 500;
  const safeMsg = IS_PRODUCTION
    ? "An unexpected error occurred. Please try again."
    : (err && err.message) || "Server error";

  const logMsg = err && err.message ? err.message : String(err);
  console.error(`[${context}] ${logMsg}`);
  if (err && err.stack) {
    console.error(`[${context}] stack:`, err.stack);
  } else if (err != null && typeof err !== "string") {
    console.error(`[${context}] full:`, util.inspect(err, { depth: 8, maxArrayLength: 50 }));
  }

  return res.status(status).json({
    msg: safeMsg,
    code: "INTERNAL_ERROR",
    ...(IS_PRODUCTION ? {} : { detail: logMsg }),
    ...(opts.extra && typeof opts.extra === "object" ? opts.extra : {}),
  });
}

module.exports = {
  IS_PRODUCTION,
  sendInternalError,
};
