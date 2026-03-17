# Sentry Error Monitoring Setup

LetsRevise uses [Sentry](https://sentry.io) for global error logging and monitoring. Errors are captured only when the DSN is configured.

## Environment Variables

### Frontend (Netlify)

| Variable | Description |
|----------|-------------|
| `REACT_APP_SENTRY_DSN` | Sentry DSN for the frontend project. Get from Sentry → Project Settings → Client Keys (DSN). |

### Backend (Render)

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Sentry DSN for the backend project. Get from Sentry → Project Settings → Client Keys (DSN). |

## Setup Steps

1. Create a [Sentry](https://sentry.io) account (free tier available).
2. Create two projects: one for **React** (frontend), one for **Node.js** (backend).
3. Copy each project's DSN.
4. Add to Netlify: `REACT_APP_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx`
5. Add to Render: `SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx`
6. Redeploy both services.

## What Gets Captured

### Frontend

- React component errors (ErrorBoundary)
- Unhandled JavaScript errors
- Unhandled promise rejections
- API errors (5xx responses, "Cannot reach server")
- Session replays on errors (privacy: text masked, media blocked)

### Backend

- Unhandled Express errors (500s)
- Request context (URL, method, user when available)

## Disabling

Leave `REACT_APP_SENTRY_DSN` and `SENTRY_DSN` unset. Sentry will not initialise and no data will be sent.

## Filtering

- ResizeObserver and chunk-loading errors are filtered out (common, low value).
- 400-level errors are not sent to Sentry.
- 401s are not captured (expected auth flow).
