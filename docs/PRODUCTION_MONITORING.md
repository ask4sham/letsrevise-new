# Production Monitoring Verification

This document describes how to verify Sentry error monitoring in production for LetsRevise.

## Overview

- **Frontend**: Sentry is initialised when `REACT_APP_SENTRY_DSN` is set (Netlify env vars).
- **Backend**: Sentry is initialised when `SENTRY_DSN` is set (Render env vars).

Both use the same Sentry project so you can see frontend and backend errors in one place.

---

## Verifying Frontend Sentry

### Option 1: Trigger a test error in the browser console

1. Open your production frontend (e.g. `https://your-app.netlify.app`).
2. Open DevTools → Console.
3. Run:
   ```javascript
   throw new Error("[Monitoring] Frontend Sentry test");
   ```
4. The ErrorBoundary will catch it and report to Sentry (if configured).
5. In Sentry → Issues, look for an issue with message `[Monitoring] Frontend Sentry test`.

### Option 2: Use the monitoring verification page

1. Navigate to `https://your-app.netlify.app/#/monitoring` (hidden route, not in nav).
2. The page shows backend health and a "Trigger test error" button.
3. The button triggers the **backend** test endpoint (see below), not a frontend error.
4. To verify frontend Sentry specifically, use Option 1.

---

## Verifying Backend Sentry

### Using the monitoring test endpoint

1. Ensure the backend is deployed with `NODE_ENV=production` and `SENTRY_DSN` set.
2. Call the test endpoint with the required header:
   ```bash
   curl -H "x-monitoring-test: true" https://your-api.onrender.com/api/monitoring/test-error
   ```
3. The endpoint **intentionally throws** an error so Sentry captures it.
4. You should get a 500 response. In Sentry → Issues, look for:
   - Message: `[Monitoring] Intentional test error for Sentry verification`
   - Tag/filter: `monitoringTest` (if present)

### Using the monitoring verification page

1. Navigate to `https://your-app.netlify.app/#/monitoring`.
2. Click **Trigger test error**.
3. The page sends `GET /api/monitoring/test-error` with header `x-monitoring-test: true`.
4. The response will show HTTP 500 (expected — the error is thrown on purpose).
5. Check Sentry for the new issue.

---

## Monitoring Test Endpoint Security

**Endpoint**: `GET /api/monitoring/test-error`

**Protection**:

- Only active when `NODE_ENV === "production"`. In development, returns 404.
- Requires header: `x-monitoring-test: true`. Without it, returns 404.
- Not linked from normal navigation. The route exists but is undocumented in the UI.
- Does not log secrets or sensitive data.

**Intended use**: Operational verification only. Run occasionally (e.g. after deploy) to confirm Sentry is capturing backend errors.

---

## Where to Look in Sentry

1. Go to [sentry.io](https://sentry.io) → your project.
2. **Issues** → filter or search for:
   - `[Monitoring] Intentional test error` (backend)
   - `[Monitoring] Frontend Sentry test` (if you triggered manually)
3. **Releases** → verify your deploy is associated with events.
4. **Performance** → optional; traces are sampled at 10%.

---

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `REACT_APP_SENTRY_DSN` | Netlify (frontend build) | Frontend Sentry DSN |
| `SENTRY_DSN` | Render (backend) | Backend Sentry DSN |

If either is missing, that part of the app will not report to Sentry. The app continues to work; monitoring is simply disabled.
