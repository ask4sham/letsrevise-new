# LetsRevise – Docker Verification Report

**Date:** 2025-03-15  
**Status:** Verification complete  
**Scope:** Dockerfiles, docker-compose, env vars, networking, health, persistence

---

## 1. Dockerfiles Analysis

### Backend Dockerfile (`backend/Dockerfile`)

| Check | Status | Notes |
|-------|--------|-------|
| Base image | ✅ | `node:20-alpine` |
| Dependencies | ✅ | `npm ci --omit=dev` |
| Build | ✅ | No build step; backend runs directly |
| Port | ✅ | `EXPOSE 5000` |
| Production server | ✅ | `CMD ["node", "server.js"]` |
| NODE_ENV | ✅ | `ENV NODE_ENV=production` |

**Note:** `npm ci --only=production` is deprecated; consider `npm ci --omit=dev` when upgrading npm. Current usage works.

### Frontend Dockerfile (`frontend/Dockerfile`)

| Check | Status | Notes |
|-------|--------|-------|
| Build stage | ✅ | Multi-stage: node:20-alpine for build |
| Dependencies | ✅ | `npm ci` (full deps for build) |
| Build | ✅ | `npm run build` (CRA outputs to `build/`) |
| Serve stage | ✅ | `nginx:alpine` |
| Static files | ✅ | `COPY --from=build /app/build /usr/share/nginx/html` |
| nginx config | ✅ | `COPY nginx.conf /etc/nginx/conf.d/default.conf` |
| Port | ✅ | `EXPOSE 80` |
| REACT_APP_API_BASE | ✅ | `ARG` + `ENV` for build-time injection |

---

## 2. docker-compose Analysis

### Services

| Service | Build | Ports | Status |
|---------|-------|-------|--------|
| backend | `./backend` | 5000:5000 | ✅ |
| frontend | `./frontend` | 3000:80 | ✅ |
| mongo | `mongo:7` (image) | 27017:27017 | ✅ |

### Build Contexts

- Backend: `context: ./backend`, `dockerfile: Dockerfile`
- Frontend: `context: ./frontend`, `dockerfile: Dockerfile`

### Dependencies

- Backend `depends_on: mongo` ✅
- Frontend `depends_on: backend` ✅

**Note:** `depends_on` waits for container start, not Mongo readiness. Mongoose retries connection; backend may log briefly before Mongo is ready.

### Volumes

| Volume | Purpose | Status |
|--------|---------|--------|
| `mongo_data:/data/db` | Mongo persistence | ✅ |
| `uploads_data:/app/uploads` | File upload persistence | ✅ **Added** |

### Syntax

- No deprecated `version` key ✅
- Standard Compose v3 syntax ✅

---

## 3. Environment Variable Handling

### Backend (docker-compose)

| Variable | Passed | Default | Notes |
|----------|--------|---------|-------|
| NODE_ENV | ✅ | `production` | Hardcoded |
| PORT | ✅ | `5000` | Hardcoded |
| MONGODB_URI | ✅ | `mongodb://mongo:27017/letsrevise` | Container network |
| JWT_SECRET_KEY | ✅ | `change-me-in-production` | **Must override in production** |
| CORS_ORIGIN | ✅ | `http://localhost:3000,http://localhost:80` | Env override supported |
| FRONTEND_URL | ✅ | `http://localhost:3000` | Env override supported |
| DISABLE_OPENAI | ✅ | `1` | Env override |
| OPENAI_API_KEY | ✅ | (empty) | Optional |
| FILE_STORAGE_PATH | N/A | `/app/uploads` | Default from `config/paths.js`; volume mounts here |

### Frontend (build args)

| Variable | Passed | Default | Notes |
|----------|--------|---------|-------|
| REACT_APP_API_BASE | ✅ | `http://localhost:5000` | Build-time; env override via `${REACT_APP_API_BASE:-...}` |

**Production:** Set `REACT_APP_API_BASE` before `docker compose build` so the frontend is built with the correct API URL.

---

## 4. Container Networking

- Backend and Mongo on same Docker network; backend uses `mongodb://mongo:27017`
- Frontend is static; API calls from browser go to `REACT_APP_API_BASE` (e.g. `http://localhost:5000` when both on host)
- No hardcoded `localhost` in backend; uses env vars

---

## 5. Health Endpoint Verification

| Endpoint | Expected | Notes |
|----------|----------|-------|
| `GET /api/health` | 200, `{ status: "OK" }` | Liveness |
| `GET /api/ready` | 200 when Mongo connected, 503 when not | Readiness; checks `mongoose.connection.readyState` |

Both are defined in `backend/server.js` before route handlers.

---

## 6. Mongo Persistence

- Volume: `mongo_data:/data/db`
- Data survives container restarts
- Stored in Docker volume `letsrevise-new_mongo_data` (project-prefixed)

---

## 7. File Upload Path Handling

- Default `FILE_STORAGE_PATH`: `path.join(__dirname, "..", "uploads")` → `/app/uploads` in container
- Volume: `uploads_data:/app/uploads` ensures uploads persist
- Directory created by `app.js` if missing
- Volume is writable by the Node process

---

## 8. SPA Routing (nginx.conf)

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

- Serves static files when they exist
- Falls back to `index.html` for client-side routes
- Supports routes such as:
  - `/student/my-progress`
  - `/practice/flashcards/:topicKey`
  - `/practice/quiz/:topicKey`
  - `/practice/exam/:topicKey`
  - `/teacher-dashboard`, `/admin`, etc.

---

## 9. Issues Found

| Issue | Severity | Resolution |
|-------|----------|------------|
| No uploads volume | Medium | Added `uploads_data:/app/uploads` |
| CORS_ORIGIN/FRONTEND_URL not env-overridable | Low | Switched to `${VAR:-default}` |
| REACT_APP_API_BASE not env-overridable at build | Low | Switched to `${REACT_APP_API_BASE:-http://localhost:5000}` |
| ~~`npm ci --only=production` deprecated~~ | — | Fixed: now uses `--omit=dev` |
| Backend .dockerignore sends large context (~230MB) | Low | Consider excluding `public/visuals` if not needed at runtime |

---

## 10. Fixes Applied

1. **docker-compose.yml**
   - Added `uploads_data:/app/uploads` volume for backend
   - Made `CORS_ORIGIN`, `FRONTEND_URL` env-overridable
   - Made `REACT_APP_API_BASE` build arg env-overridable

---

## 11. Remaining Risks

| Risk | Mitigation |
|------|------------|
| JWT_SECRET_KEY default in production | Always set `JWT_SECRET_KEY` in production |
| Mongo startup race | Mongoose retries; optional: add healthcheck/condition |
| Frontend built with wrong API URL | Set `REACT_APP_API_BASE` before build for staging/production |
| Large backend build context | Optional: refine `.dockerignore` |

---

## 12. Build Verification Result

- **Backend:** Built successfully (`letsrevise-new-backend`)
- **Frontend:** Built successfully (`letsrevise-new-frontend`)
- **docker compose up:** Starts mongo, backend, frontend (mongo image pulled on first run)

---

## Commands to Run Locally

```bash
# Build (from project root)
docker compose build --no-cache

# Start
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Health checks (after containers are up)
curl http://localhost:5000/api/health
curl http://localhost:5000/api/ready

# Stop
docker compose down
```

---

## Final Verdict

**READY FOR STAGING**

The Docker setup builds and runs correctly. Uploads and Mongo data persist. Health and readiness endpoints are in place. Before staging:

1. Set `JWT_SECRET_KEY` (e.g. in `.env` or environment)
2. For a custom API URL, set `REACT_APP_API_BASE` and rebuild the frontend
3. Run the staging smoke test checklist from `docs/LAUNCH_HARDENING_REPORT.md`
