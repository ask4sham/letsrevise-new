# Env Cutover Operator Runbook

**Scope:** Render and Netlify env updates + redeploy + verification. No code changes.  
**Prerequisites:** Domain setup complete (letsrevise.com, www, api on Netlify/Render); DNS propagated.

---

## Pre-Cutover: Code/Config Check

**No code or config file changes are required before env cutover.**

- Dual-domain hardening is already deployed (api.ts, assetUrl.ts).
- netlify.toml stays as-is (proxy to letsrevise-new.onrender.com).
- No backend code changes.
- No DB migration.

---

## Part A: Render Env Update

### Step A.1 — Open Environment

| Field | Value |
|-------|-------|
| Platform | Render |
| Where | Dashboard → **letsrevise-new** → **Environment** (left sidebar) |

**Action:** Click **Environment** in the left sidebar of the letsrevise-new service.

**Verify before next step:** You see the list of environment variables.

---

### Step A.2 — Set CORS_ORIGIN

| Field | Value |
|-------|-------|
| Variable name | `CORS_ORIGIN` |
| Exact value | `https://letsrevise.com,https://www.letsrevise.com,https://profound-gumdrop-4c8d83.netlify.app` |

**Action:** Add or edit `CORS_ORIGIN`. Paste the value exactly (no spaces, no trailing comma).

**Expected outcome:** Variable saved. CORS will allow letsrevise.com, www, and the old Netlify URL.

**Verify before next step:** Value matches exactly; no typos.

---

### Step A.3 — Set FRONTEND_URL

| Field | Value |
|-------|-------|
| Variable name | `FRONTEND_URL` |
| Exact value | `https://letsrevise.com` |

**Action:** Add or edit `FRONTEND_URL`. Paste the value exactly.

**Expected outcome:** Variable saved. Used for Stripe redirects and CORS fallback.

**Verify before next step:** Value is `https://letsrevise.com` (no trailing slash).

---

### Step A.4 — Do Not Set BACKEND_PUBLIC_URL

| Field | Value |
|-------|-------|
| Variable | `BACKEND_PUBLIC_URL` |
| Action | Leave unset |

**Verify before next step:** `BACKEND_PUBLIC_URL` is not present, or remove it if it exists.

---

### Step A.5 — Save

**Action:** Click **Save Changes** (or equivalent) to apply env updates.

**Expected outcome:** Render shows "Environment updated" or similar.

**Verify before next step:** No error message; env list shows the new values.

---

## Part B: Render Redeploy

### Step B.1 — Trigger Deploy

| Field | Value |
|-------|-------|
| Platform | Render |
| Where | **letsrevise-new** → **Manual Deploy** (top right) or **Deploys** tab |

**Action:** Click **Manual Deploy** → **Deploy latest commit** (or **Clear build cache & deploy** if you want a clean build).

**Expected outcome:** New deploy starts; status changes to "Building" then "Live".

**Verify before next step:** Deploy completes successfully (green "Live" status). Typical duration: 3–8 minutes.

---

### Step B.2 — Smoke Test Backend

**Action:** Open https://letsrevise-new.onrender.com/api/health in a browser.

**Expected outcome:** JSON response: `{"status":"OK","message":"LetsRevise API is running",...}`

**Verify before next step:** 200 response; JSON parses correctly.

---

## Part C: Netlify Env Update

### Step C.1 — Open Environment Variables

| Field | Value |
|-------|-------|
| Platform | Netlify |
| Where | Site → **Site configuration** → **Environment variables** (or **Build & deploy** → **Environment**) |

**Action:** Open the site in Netlify Dashboard, then **Site configuration** → **Environment variables**.

**Verify before next step:** You see the list of variables (e.g. REACT_APP_API_BASE if set).

---

### Step C.2 — Set REACT_APP_API_BASE

| Field | Value |
|-------|-------|
| Variable name | `REACT_APP_API_BASE` |
| Exact value | `https://letsrevise.com` |

**Action:** Add or edit `REACT_APP_API_BASE`. Paste the value exactly.

**Expected outcome:** Variable saved. Used for non-proxy fallback; on letsrevise.com, `isSameOriginProxy` is true so API stays same-origin.

**Verify before next step:** Value is `https://letsrevise.com` (no trailing slash, no /api).

---

### Step C.3 — Set REACT_APP_API_URL (Optional)

| Field | Value |
|-------|-------|
| Variable name | `REACT_APP_API_URL` |
| Exact value | `https://letsrevise.com` |

**Action:** Add or edit if you use this variable. Same value as REACT_APP_API_BASE.

**Verify before next step:** Both vars set if you use both.

---

### Step C.4 — Save

**Action:** Click **Save** or **Update** to apply.

**Expected outcome:** Netlify confirms env updated.

**Verify before next step:** No error; variables appear in the list.

---

## Part D: Netlify Redeploy

### Step D.1 — Trigger Deploy

| Field | Value |
|-------|-------|
| Platform | Netlify |
| Where | **Deploys** tab → **Trigger deploy** → **Deploy site** |

**Action:** Go to **Deploys**, click **Trigger deploy** → **Deploy site** (not "Clear cache and deploy site" unless needed).

**Expected outcome:** New build starts; status "Building" then "Published".

**Verify before next step:** Deploy completes successfully. Typical duration: 2–5 minutes.

---

### Step D.2 — Smoke Test Frontend (Old URL)

**Action:** Open https://profound-gumdrop-4c8d83.netlify.app in a browser.

**Expected outcome:** Homepage loads. Old Netlify URL still works.

**Verify before next step:** 200 response; no blank page or console errors.

---

## Part E: Post-Cutover Verification

Run the verification checklist below. All items must pass.

---

## Copy-Paste Verification Checklist

Execute immediately after Parts A–D. Check each item; mark pass/fail.

Canonical frontend: letsrevise.com (apex). www redirects to apex. API proxy must work on both hosts.

```
[ ] 1.  https://letsrevise.com loads (200, frontend)
[ ] 2.  https://www.letsrevise.com redirects to https://letsrevise.com (301)
[ ] 3.  https://letsrevise.com/api/health returns JSON {"status":"OK",...}
[ ] 4.  https://www.letsrevise.com/api/health returns JSON {"status":"OK",...}
[ ] 5.  https://api.letsrevise.com/api/health returns JSON {"status":"OK",...}
[ ] 6.  Login works at canonical frontend (https://letsrevise.com)
[ ] 7.  Dashboard loads at canonical frontend
[ ] 8.  Lesson images render (open a lesson with images)
[ ] 9.  Upload works (upload image in lesson editor)
[ ] 10. Network: DevTools → Network; requests go to same-origin /api/... on canonical frontend domain
[ ] 11. https://profound-gumdrop-4c8d83.netlify.app still works
[ ] 12. https://letsrevise-new.onrender.com/api/health still works
```

**All pass → cutover complete.**

---

## Fast Rollback Runbook

### When to Roll Back

| Symptom | Action |
|---------|--------|
| letsrevise.com shows CORS errors | Roll back Render env first |
| letsrevise.com returns 404 or blank | Check DNS; roll back Netlify env if needed |
| Login fails on letsrevise.com | Roll back Render env (CORS) |
| profound-gumdrop broken | Roll back Netlify env |
| Upload fails on letsrevise.com | Roll back Render env (CORS) |

**Rule:** If letsrevise.com is broken but profound-gumdrop works, users can use the old URL. Roll back when critical flows fail on both.

---

### Rollback Order (Exact)

| Order | What to revert | How |
|-------|----------------|-----|
| **1** | Netlify env | Netlify → Environment variables → Set `REACT_APP_API_BASE` to `https://letsrevise-new.onrender.com` (or previous value) → Save → Trigger deploy |
| **2** | Render env | Render → Environment → Set `CORS_ORIGIN` to `https://profound-gumdrop-4c8d83.netlify.app` → Set `FRONTEND_URL` to `https://profound-gumdrop-4c8d83.netlify.app` → Save → Manual deploy |

**Do not revert:** DNS records, custom domains. They can stay. Users fall back to profound-gumdrop and letsrevise-new.onrender.com.

---

### Rollback Values (Exact)

**Netlify (revert to):**
```
REACT_APP_API_BASE=https://letsrevise-new.onrender.com
```

**Render (revert to):**
```
CORS_ORIGIN=https://profound-gumdrop-4c8d83.netlify.app
FRONTEND_URL=https://profound-gumdrop-4c8d83.netlify.app
```

---

### What Can Remain in Place Safely

| Item | Safe to leave? |
|------|-----------------|
| DNS records (A, CNAME for letsrevise.com, www, api) | Yes |
| Custom domains in Netlify (letsrevise.com, www) | Yes |
| Custom domain in Render (api.letsrevise.com) | Yes |
| netlify.toml | Yes (unchanged) |
| Application code | Yes (unchanged) |

Only env vars need to be reverted for rollback.

---

## Go/No-Go for Live Cutover

**GO** — Proceed with env cutover if:

1. Domain setup is complete (letsrevise.com, www, api added in Netlify and Render).
2. DNS has propagated (dig/nslookup returns correct results).
3. Dual-domain hardening is deployed (api.ts, assetUrl.ts changes are live).
4. profound-gumdrop-4c8d83.netlify.app is working.
5. You have 15–20 minutes for env updates, deploys, and verification.
6. You can perform rollback within 10 minutes if needed.

**NO-GO** — Do not proceed if:

- DNS is not propagated.
- profound-gumdrop is broken.
- You cannot revert env vars quickly.

---

## Execution Summary

| Part | Platform | Duration |
|------|----------|----------|
| A | Render env | ~2 min |
| B | Render redeploy | ~5 min |
| C | Netlify env | ~2 min |
| D | Netlify redeploy | ~5 min |
| E | Verification | ~5 min |

**Total:** ~20 minutes.
