/**
 * Sentry error monitoring — initialised only when REACT_APP_SENTRY_DSN is set.
 * Set in Netlify env vars for production.
 * Uses @sentry/browser consistently (no React Router integration).
 */
import * as Sentry from "@sentry/browser";

const dsn = process.env.REACT_APP_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event, hint) {
      const error = hint.originalException;
      if (error && typeof error === "object" && "message" in error) {
        const msg = String((error as Error).message);
        if (msg.includes("ResizeObserver") || msg.includes("Loading chunk")) {
          return null;
        }
      }
      return event;
    },
  });
}

export default Sentry;
