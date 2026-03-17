/**
 * Optional Sentry reporting. Uses require() so the app compiles even when
 * @sentry/browser cannot be resolved (e.g. in some CI environments).
 */
type CaptureExceptionFn = (error: unknown, context?: { extra?: Record<string, unknown> }) => void;
type CaptureMessageFn = (message: string, level?: string) => void;

let captureExceptionImpl: CaptureExceptionFn = () => {};
let captureMessageImpl: CaptureMessageFn = () => {};

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require("@sentry/browser");
  if (Sentry?.captureException) captureExceptionImpl = Sentry.captureException.bind(Sentry);
  if (Sentry?.captureMessage) captureMessageImpl = Sentry.captureMessage.bind(Sentry);
} catch {
  // Sentry not available
}

export const captureException: CaptureExceptionFn = captureExceptionImpl;
export const captureMessage: CaptureMessageFn = captureMessageImpl;
