# Pre-Cutover Verification Report

**Date:** 2025-03-18  
**Scope:** Deploy dual-domain hardening to production; verify no regressions on current Netlify URL.

---

## 1. Files Changed (Dual-Domain Hardening)

| File | Change |
|------|--------|
| `frontend/src/services/api.ts` | Extended `isSameOriginProxy` to include `letsrevise.com`, `www.letsrevise.com` (in addition to `*.netlify.app`) |
| `frontend/src/utils/assetUrl.ts` | Added `https://api.letsrevise.com` to backend URL rewrite list (alongside `letsrevise-new.onrender.com`) |

**Expected behavior:**
- On `*.netlify.app`, `letsrevise.com`, `www.letsrevise.com`: API requests use same-origin `/api/*` (baseURL `""`)
- Asset URLs from `letsrevise-new.onrender.com` or `api.letsrevise.com` are rewritten to same-origin when on frontend domain
- No change to current Netlify production behavior

---

## 2. Deployment Summary

| Step | Status | Details |
|------|--------|---------|
| Frontend build | ✅ Pass | `npm run build` completed successfully |
| Git push | ✅ Done | Pushed commits `23ed7218..67b8ac9c` to `origin/main` |
| Netlify deploy | ⏳ Pending | Netlify auto-deploys on push; build typically completes in 2–5 minutes |

**Note:** If Netlify is connected to the repo, the deploy will run automatically. Check Netlify Dashboard → Deploys for status.

---

## 3. Verification Checklist

Run these checks on **https://profound-gumdrop-4c8d83.netlify.app** after the deploy completes.

### 3.1 Core Functionality

| Check | How to verify | Expected |
|-------|---------------|----------|
| App loads | Open site URL | Homepage renders |
| Login/auth | Log in with valid credentials | Login succeeds, session persists |
| Dashboard | Navigate to teacher/student dashboard | Dashboard loads |
| Lesson pages | Open a lesson with images | Images render correctly |

### 3.2 API & Upload Flow

| Check | How to verify | Expected |
|-------|---------------|----------|
| Same-origin API | DevTools → Network; trigger any API call | Requests go to `profound-gumdrop-4c8d83.netlify.app/api/...` (not `letsrevise-new.onrender.com`) |
| Upload flow | Create/edit lesson; upload image | Upload succeeds; image appears |
| No direct Render calls | DevTools → Network; use app normally | No requests to `letsrevise-new.onrender.com` for app API usage |

### 3.3 Asset Normalization

| Check | How to verify | Expected |
|-------|---------------|----------|
| Existing Render URLs | View lesson with migrated images (DB has `letsrevise-new.onrender.com/...`) | Images load; `makeAbsoluteAssetUrl` rewrites to same-origin |
| Relative paths | If any content has `/uploads/`, `/visuals/`, `/content/` | Resolved to same-origin |

---

## 4. Quick Verification Commands

**Check deploy status (Netlify CLI):**
```bash
npx netlify status
```

**Verify build contains hardening (local):**
```bash
grep -c "letsrevise.com" frontend/build/static/js/main.*.js
# Should return > 0
```

---

## 5. Verification Status

| Area | Status | Notes |
|------|--------|-------|
| Deploy | ⏳ Pending | Push completed; Netlify build in progress |
| App loads | — | Verify after deploy |
| Login/auth | — | Verify after deploy |
| Dashboard | — | Verify after deploy |
| Lesson images | — | Verify after deploy |
| Same-origin API | — | Verify in DevTools after deploy |
| Upload flow | — | Verify after deploy |
| No direct Render | — | Verify in DevTools after deploy |

---

## 6. Regressions

None observed during build. Manual verification required after deploy.

---

## 7. Go/No-Go Recommendation

**Recommendation:** **GO** — proceed to domain configuration once manual verification passes.

**Conditions:**
1. Netlify deploy completes successfully
2. All checks in §3 pass on the current Netlify URL
3. No regressions in login, dashboard, lesson images, or uploads

**Next step:** Add custom domains in Netlify and Render; configure DNS; update env vars per `docs/ai/custom-domain-rollout-plan.md`.
