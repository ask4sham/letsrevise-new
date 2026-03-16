# LetsRevise Deployment Checklist

Step-by-step checklist for deploying to a VPS or cloud container platform (e.g. DigitalOcean, AWS EC2, Render, Railway, Fly.io).

---

## Phase 1: Pre-Deployment

### 1.1 Code & Repo
- [ ] All changes committed and pushed to your Git repo
- [ ] `.env` and `.env.local` are in `.gitignore` (never committed)
- [ ] `node_modules` and `build` are in `.gitignore`
- [ ] No secrets, API keys, or passwords in source code

### 1.2 MongoDB
- [ ] MongoDB Atlas cluster created (or self-hosted Mongo ready)
- [ ] Database user created with read/write access
- [ ] Connection string copied (e.g. `mongodb+srv://user:pass@cluster.mongodb.net/letsrevise`)
- [ ] IP allowlist configured (add `0.0.0.0/0` for cloud, or your VPS IP)
- [ ] Network access verified (test connection from local machine)

### 1.3 Domain & DNS (if using custom domain)
- [ ] Domain purchased and DNS managed
- [ ] A record for frontend (e.g. `app.yourdomain.com`)
- [ ] A or CNAME record for backend API (e.g. `api.yourdomain.com`)
- [ ] SSL certificates planned (Let's Encrypt or platform-managed)

### 1.4 OpenAI (if using AI features)
- [ ] OpenAI API key obtained from https://platform.openai.com/api-keys
- [ ] Billing configured on OpenAI account
- [ ] Key stored securely for env injection

### 1.5 Secrets Generated
- [ ] JWT secret generated: `openssl rand -base64 32`
- [ ] Secrets stored in password manager or secure vault

---

## Phase 2: Environment Configuration

### 2.1 Backend Environment Variables
Create backend env (e.g. `.env` or platform env config) with:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `5000` | Or platform-assigned port |
| `MONGODB_URI` | `mongodb+srv://...` | Your connection string |
| `JWT_SECRET_KEY` | `<32-byte-secret>` | From Phase 1.5 |
| `OPENAI_API_KEY` | `sk-...` | Or omit and set `DISABLE_OPENAI=1` |
| `CORS_ORIGIN` | `https://app.yourdomain.com` | Frontend origin(s), comma-separated |
| `FRONTEND_URL` | `https://app.yourdomain.com` | Optional, same as CORS |

- [ ] All backend env vars set
- [ ] No trailing slashes in URLs
- [ ] No quotes around values unless required by platform

### 2.2 Frontend Build-Time Variables
- [ ] `REACT_APP_API_BASE` set to backend URL (e.g. `https://api.yourdomain.com`)
- [ ] No trailing slash
- [ ] No `/api` suffix (client adds it)

---

## Phase 3: Platform Setup (VPS / Container)

### 3.1 If Using Docker on VPS

- [ ] Docker and Docker Compose installed on VPS
- [ ] Repo cloned or image built and pushed to registry
- [ ] `.env` file created on VPS with production values
- [ ] `docker-compose.yml` reviewed (update `MONGODB_URI` if using external Mongo)
- [ ] If using external Mongo: remove or disable `mongo` service in compose

### 3.2 If Using Managed Container Platform (Render, Railway, Fly.io, etc.)

- [ ] Account created and project/application created
- [ ] Backend service configured (build: Dockerfile or `npm install && npm start`)
- [ ] Frontend service configured (static site or Node serve)
- [ ] Environment variables added in platform UI
- [ ] Build command for frontend: `npm run build` with `REACT_APP_API_BASE` set
- [ ] Start command for backend: `node server.js` or `npm start`

### 3.3 If Using Plain VPS (no Docker)

- [ ] Node.js 18+ installed
- [ ] Git installed, repo cloned
- [ ] `cd backend && npm ci --production`
- [ ] `cd frontend && npm ci && REACT_APP_API_BASE=... npm run build`
- [ ] Process manager installed (PM2, systemd) for backend
- [ ] Nginx or Caddy installed for reverse proxy and static frontend

---

## Phase 4: Build & Deploy

### 4.1 Backend
- [ ] Backend built (if Docker: `docker build -t letsrevise-backend ./backend`)
- [ ] Backend container/service started
- [ ] Backend logs checked for startup errors
- [ ] `GET https://api.yourdomain.com/api/health` returns 200
- [ ] `GET https://api.yourdomain.com/api/ready` returns 200 (Mongo connected)

### 4.2 Frontend
- [ ] Frontend built with correct `REACT_APP_API_BASE`
- [ ] Static files deployed (to Nginx, S3+CloudFront, or platform static host)
- [ ] SPA routing configured (all routes → `index.html`)
- [ ] `https://app.yourdomain.com` loads without errors

### 4.3 Reverse Proxy (if applicable)
- [ ] Nginx/Caddy configured for backend proxy (e.g. `/api` → `http://localhost:5000`)
- [ ] SSL certificate installed (Let's Encrypt or platform)
- [ ] HTTP → HTTPS redirect enabled
- [ ] CORS and security headers verified

---

## Phase 5: Database & Seed

### 5.1 Database
- [ ] Mongo connection verified (backend `/api/ready` returns 200)
- [ ] Indexes created (backend creates on first run, or run `node backend/scripts/verify-indexes.js` if available)

### 5.2 Initial Data (Optional)
- [ ] If demo/staging: `node backend/scripts/seedDemoData.js` run once
- [ ] If production: **do not** run seedDemoData; create admin/teacher via register or migration script
- [ ] First admin user created and verified

---

## Phase 6: Verification

### 6.1 Health
- [ ] `GET /api/health` → 200, `status: "OK"`
- [ ] `GET /api/ready` → 200, `mongo: "connected"`

### 6.2 Auth
- [ ] Register new user → success
- [ ] Login → returns token
- [ ] Protected route with token → 200
- [ ] Protected route without token → 401

### 6.3 Student Flow
- [ ] Login as student
- [ ] Dashboard loads
- [ ] My Progress loads
- [ ] Start Flashcards (requires linked teacher + topic content)
- [ ] Start Quiz (requires linked teacher + topic content)
- [ ] Start Exam Practice (requires linked teacher + topic content)

### 6.4 Teacher Flow
- [ ] Login as teacher
- [ ] Teacher dashboard loads
- [ ] Create lesson (if AI enabled)
- [ ] Topic banks accessible

### 6.5 CORS
- [ ] Frontend at `https://app.yourdomain.com` can call `https://api.yourdomain.com` without CORS errors
- [ ] Credentials (cookies/auth headers) sent correctly

---

## Phase 7: Production Hardening

### 7.1 Security
- [ ] No debug endpoints exposed (`DEBUG_ENDPOINTS` not set or `0`)
- [ ] Rate limiting enabled (default in server)
- [ ] Helmet security headers enabled (default in server)
- [ ] File upload limits configured

### 7.2 Monitoring
- [ ] Logging destination configured (stdout, platform logs, or external)
- [ ] Uptime/health check configured (e.g. UptimeRobot pinging `/api/health`)
- [ ] Error alerting configured (optional)

### 7.3 Backup
- [ ] MongoDB backup strategy in place (Atlas automated backups or manual)
- [ ] Backup restore tested (optional but recommended)

---

## Phase 8: Go-Live

### 8.1 Final Checks
- [ ] All Phase 6 verification items passed
- [ ] No console errors on frontend
- [ ] No 500 errors in backend logs for normal flows
- [ ] DNS propagated (if new domain)
- [ ] SSL valid and trusted

### 8.2 Cutover
- [ ] Traffic pointed to new deployment
- [ ] Old deployment (if any) retired or kept as fallback
- [ ] Users notified of new URL (if applicable)

### 8.3 Post-Launch
- [ ] Monitor logs for first 24 hours
- [ ] Monitor `/api/health` and `/api/ready` for availability
- [ ] Fix any critical issues immediately
- [ ] Document runbook for common operations (restart, rollback, env changes)

---

## Quick Reference: Commands

```bash
# Local Docker test
docker-compose up --build -d

# Backend health
curl https://api.yourdomain.com/api/health
curl https://api.yourdomain.com/api/ready

# Seed demo (staging only)
docker-compose exec backend node scripts/seedDemoData.js
# Or: cd backend && node scripts/seedDemoData.js
```

---

## Rollback Plan

If deployment fails:
1. Revert DNS or traffic to previous deployment
2. Check backend logs: `docker-compose logs backend` or platform logs
3. Verify `MONGODB_URI`, `JWT_SECRET_KEY`, `CORS_ORIGIN`
4. Verify frontend `REACT_APP_API_BASE` matches backend URL
5. Restore from backup if DB was corrupted
