/**
 * Sentry error monitoring — initialised only when SENTRY_DSN is set.
 * Set in Render env vars for production.
 */
const Sentry = require("@sentry/node");

const dsn = (process.env.SENTRY_DSN || "").trim();

function initSentry() {
  if (!dsn) {
    return false;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
    beforeSend(event, hint) {
      const error = hint.originalException;
      if (error && error.status === 400) return null;
      return event;
    },
  });
  return true;
}

function captureException(err, context = {}) {
  if (!dsn) return;
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    Sentry.captureException(err);
  });
}

module.exports = { initSentry, captureException, Sentry };
