# LetsRevise – Final Launch Hardening Report

**Date:** 2025-03-15  
**Status:** Pre-launch hardening pass complete  
**Scope:** Security, auth, uploads, logging, Docker, deployment

---

## 1. Security Middleware Audit

### Findings

| Item | Status | Notes |
|------|--------|-------|
| Helmet | ✅ Enabled | `backend/server.js` line ~111 |
| Rate limiting (auth) | ✅ Present | `authLimiter` 50 req/15 min on `/api/auth` |
| Rate limiting (general API) | ✅ **Added** | New `apiLimiter` 300 req/15 min on all `/api` |
| Bulk/upload/attempt limiters | ✅ Present | `rateLimitBulk.js` – bulk, upload, attempt limiters |

### Fixes Made

1. **General API rate limit**
   - Added `apiLimiter` (300 req/15 min per IP, configurable via `RATE_LIMIT_API_MAX`)
   - Applied to all `/api` routes before route handlers
   - Provides a safety net for abuse beyond auth-specific limits

### What Was Already in Place

- Helmet for security headers
- CORS configured with allowed origins
- Auth rate limit (50 req/15 min)
- Body size limits (`bodyLimit` middleware)
- Bulk/upload/attempt limiters from `rateLimitBulk.js`

---

## 2. Auth/Security Audit

### Findings

| Item | Status | Notes |
|------|--------|-------|
| Protected routes | ✅ Verified | Routes use `auth` middleware |
| Admin routes | ✅ Restricted | `requireAdmin` / teacher checks |
| Student-only routes | ✅ Protected | Auth + role checks |
| Debug/test routes | ✅ **Hardened** | See below |

### Fixes Made

1. **`/api/auth/debug-login`**
   - Previously: Public debug route exposing password hash info and allowing unauthenticated password checks
   - **Fix:** Returns 404 when `NODE_ENV === "production"` OR when `DEBUG_ENDPOINTS` is not `"1"` / `"true"`
   - Production responses no longer include `error.stack` in catch block

2. **`/api/_debug/info`**
   - Already guarded by `debugEnabled()` (requires `DEBUG_ENDPOINTS=1`)

3. **`/api/dev`**
   - Already guarded by `ENABLE_DEV_TOOLS=1` and auth + teacher/admin

### Production Checklist

- **Do not set** `DEBUG_ENDPOINTS=1` in production
- **Do not set** `ENABLE_DEV_TOOLS=1` in production
- Ensure `JWT_SECRET_KEY` is set and strong (32+ bytes)

---

## 3. Upload/Storage Audit

### Findings

| Item | Status | Notes |
|------|--------|-------|
| Upload path configurable | ✅ **Added** | `FILE_STORAGE_PATH` env var |
| Local storage limitation | ⚠️ Documented | See below |
| File size limits | ✅ Configurable | `FILE_UPLOAD_MAX_MB` in `config/limits.js` |

### Fixes Made

1. **`FILE_STORAGE_PATH` env var**
   - New `backend/config/paths.js` exports `FILE_STORAGE_PATH`
   - Default: `backend/uploads` (relative to backend root)
   - Set `FILE_STORAGE_PATH` to an absolute path for production (e.g. `/var/data/letsrevise/uploads`)
   - Wired into: `app.js`, `server.js`, `routes/uploads.js`, `routes/adminMedia.js`, `services/diagramGeneration.js`, `routes/importRoutes.js`, `controllers/specStatements.controller.js`, `routes/specStatements.routes.js`, `utils/saveUploadAndHash.js`

2. **`FILE_UPLOAD_DIR`**
   - Existing env var for past-papers subfolder; still supported
   - When unset, now uses `FILE_STORAGE_PATH/past-papers`

### Local Storage Limitation

- **Current behaviour:** All uploads (images, videos, spec docs, CSV imports, past papers, diagrams) are stored on the local filesystem.
- **Implication:** In multi-instance or serverless deployments, uploads are not shared across instances. Use a shared volume or object storage (S3, etc.) for production at scale.
- **For single-instance staging/production:** Local storage is acceptable. Set `FILE_STORAGE_PATH` to a persistent volume path.

---

## 4. Logging and Error Handling Audit

### Findings

| Item | Status | Notes |
|------|--------|-------|
| Stack traces in production | ✅ **Fixed** | `lessons.js` no longer returns `err.message` in 500 responses |
| Debug-login stack trace | ✅ **Fixed** | Catch block does not return `error.stack` in production |
| Backend logs | ✅ Adequate | Request logging in dev; errors logged to console |

### Fixes Made

1. **`backend/routes/lessons.js`**
   - 500 responses in production return generic `"Server error"` instead of `err.message`

2. **`backend/routes/auth.js` (debug-login)**
   - Catch block does not expose `error.stack` in production

### Recommendations

- Ensure production logs go to stdout/stderr for platform log aggregation
- Consider structured logging (e.g. JSON) for production if needed

---

## 5. Docker Verification

### Status

Docker build/run was **not executed** (Docker Desktop not running on the verification machine).

### Expected Behaviour (from code review)

- **Backend:** `backend/Dockerfile` – Node 20 Alpine, `node server.js`
- **Frontend:** `frontend/Dockerfile` – Build with `REACT_APP_API_BASE`, nginx serve
- **docker-compose.yml:** backend:5000, frontend:3000, mongo:27017
- **Health:** `GET /api/health` → 200, `GET /api/ready` → 200 when Mongo connected

### Pre-Launch Action

Before staging/production:

```bash
docker compose build --no-cache
docker compose up -d
curl http://localhost:5000/api/health
curl http://localhost:5000/api/ready
# Verify frontend at http://localhost:3000 can reach backend
```

---

## 6. Staging Smoke Test Checklist

Recommended order for staging verification:

| # | Test | Critical Path |
|---|------|----------------|
| 1 | Register | Create new account |
| 2 | Login | Obtain token, verify auth |
| 3 | Student dashboard | Load dashboard after login |
| 4 | Student progress | View progress data |
| 5 | Flashcard practice | Start and complete flashcard session |
| 6 | Quiz practice | Start and complete quiz |
| 7 | Exam practice | Start and complete exam practice |
| 8 | Evidence recording | Record learning evidence |
| 9 | Adaptive recommendations | Verify recommendations load |
| 10 | Teacher/admin path | Login as teacher/admin, access admin dashboard |

---

## 7. Production Deployment Notes

### Required Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | e.g. `5000` |
| `MONGODB_URI` | Yes | Connection string |
| `JWT_SECRET_KEY` | Yes | 32+ bytes, from `openssl rand -base64 32` |
| `CORS_ORIGIN` | Yes | Frontend origin(s), comma-separated |
| `FRONTEND_URL` | Optional | Same as CORS typically |
| `OPENAI_API_KEY` | If AI enabled | Or set `DISABLE_OPENAI=1` |
| `FILE_STORAGE_PATH` | Optional | Absolute path for uploads (default: `backend/uploads`) |
| `RATE_LIMIT_API_MAX` | Optional | Default 300 req/15 min |

### Do NOT Set in Production

- `DEBUG_ENDPOINTS=1`
- `ENABLE_DEV_TOOLS=1`
- `DEBUG_JWT=1`

### Docker Commands

```bash
# Build
docker compose build --no-cache

# Run (with .env in project root)
docker compose up -d

# With external Mongo (omit mongo service, set MONGODB_URI)
MONGODB_URI=mongodb+srv://... docker compose up -d
```

### Frontend Build

```bash
REACT_APP_API_BASE=https://api.yourdomain.com npm run build
```

### Manual Steps

1. Create first admin/teacher user (do not run `seedDemoData` in production)
2. Configure MongoDB Atlas IP allowlist if using Atlas
3. Set up SSL (Let's Encrypt or platform-managed)
4. Configure health/readiness probes to use `/api/health` and `/api/ready`

### Rollback Procedure

1. Revert DNS or traffic to previous deployment
2. Check backend logs: `docker compose logs backend`
3. Verify `MONGODB_URI`, `JWT_SECRET_KEY`, `CORS_ORIGIN`
4. Verify frontend `REACT_APP_API_BASE` matches backend URL
5. Restore from backup if DB was corrupted

---

## 8. Remaining Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Local storage for uploads | Medium | Use shared volume or object storage for multi-instance |
| Docker not verified in this pass | Low | Run `docker compose up` before staging |
| No CSP beyond Helmet defaults | Low | Consider stricter CSP if needed |
| Rate limit bypass via many IPs | Low | Consider WAF or CDN rate limiting for DDoS |

---

## 9. GO / NO-GO Recommendation

### Go to Staging

**GO** – Hardening changes are in place. Proceed to staging with:

1. Run Docker verification locally
2. Execute staging smoke test checklist
3. Confirm `DEBUG_ENDPOINTS` and `ENABLE_DEV_TOOLS` are not set

### Go to Production (after staging)

**GO** – After staging smoke tests pass:

1. Set all required env vars
2. Use strong `JWT_SECRET_KEY`
3. Configure `FILE_STORAGE_PATH` for persistent uploads
4. Do not enable debug/dev tools

### Blocked for Production

**Not blocked** – No critical blockers identified. Remaining items are operational (Docker verification, staging tests) and documented risks (local storage, rate limits).

---

## Summary of Code Changes

| File | Change |
|------|--------|
| `backend/server.js` | Added `apiLimiter`, moved before route mounts; `FILE_STORAGE_PATH` for uploads |
| `backend/config/paths.js` | **New** – central `FILE_STORAGE_PATH` config |
| `backend/app.js` | Use `FILE_STORAGE_PATH` for uploads dir |
| `backend/routes/uploads.js` | Use `FILE_STORAGE_PATH` |
| `backend/routes/adminMedia.js` | Use `FILE_STORAGE_PATH` |
| `backend/services/diagramGeneration.js` | Use `FILE_STORAGE_PATH` |
| `backend/routes/importRoutes.js` | Use `FILE_STORAGE_PATH` |
| `backend/controllers/specStatements.controller.js` | Use `FILE_STORAGE_PATH` |
| `backend/routes/specStatements.routes.js` | Use `FILE_STORAGE_PATH` |
| `backend/utils/saveUploadAndHash.js` | Use `FILE_STORAGE_PATH` for past-papers default |
| `backend/routes/auth.js` | `debug-login` guarded; no stack trace in production |
| `backend/routes/lessons.js` | 500 responses sanitised in production |
