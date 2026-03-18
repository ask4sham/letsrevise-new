# Custom Domain Rollout Plan: letsrevise.com

**Target domains:**
- `https://letsrevise.com` (frontend, canonical)
- `https://www.letsrevise.com` (frontend, redirect to apex)
- `https://api.letsrevise.com` (backend, optional direct access)

**Strategy:** Dual-domain support first; keep old domains working during transition. Same-origin proxy preserved (no change to upload flow).

---

## 1. Audit Summary

### 1.1 Hardcoded Domain References

| File | Reference | Purpose | Action |
|------|-----------|---------|--------|
| `frontend/src/utils/assetUrl.ts` | `RENDER_BACKEND = "https://letsrevise-new.onrender.com"` | Rewrite Render URLs to same-origin | Add `api.letsrevise.com` to recognized backends |
| `frontend/src/services/mediaUrl.ts` | `"https://letsrevise-new.onrender.com"` in `getUploadBaseUrl` | SSR/fallback base | Use env or keep for SSR edge case |
| `frontend/src/services/api.ts` | `isNetlify = /\.netlify\.app$/i` | Same-origin proxy detection | Extend to `letsrevise.com`, `www.letsrevise.com` |
| `backend/config/cors.js` | `PRODUCTION_FRONTEND = "https://letsrevise.com"` | CORS fallback | Already correct |
| `backend/config/cors.js` | `NETLIFY_ORIGINS` | Hardcoded Netlify URLs | Add custom domains to env; keep fallbacks |
| `backend/server.js` | `BACKEND_PUBLIC_URL` default | Asset base, upload proxy | Env only; no change |
| `backend/scripts/migrate-legacy-image-urls.js` | `BACKEND_PUBLIC_URL` default | Migration script | Env only; no change |
| `netlify.toml` | `https://letsrevise-new.onrender.com` | Proxy target | Keep during transition; optionally switch to api.letsrevise.com later |

### 1.2 Env Usage

| Env Var | Where Used | Current | Post-Cutover |
|---------|------------|---------|--------------|
| `REACT_APP_API_BASE` | api.ts, uploads.ts, media.ts, etc. | `https://letsrevise-new.onrender.com` (overridden by isNetlify) | `https://letsrevise.com` for custom-domain build |
| `REACT_APP_API_URL` | Same as above | Same | Same |
| `CORS_ORIGIN` | backend/config/cors.js | Netlify URL | `https://letsrevise.com,https://www.letsrevise.com` |
| `FRONTEND_URL` | cors.js, subscriptions.js | Netlify URL | `https://letsrevise.com` |
| `BACKEND_PUBLIC_URL` | server.js, migration script | (unset, uses default) | `https://api.letsrevise.com` when api subdomain active |
| `CORS_FALLBACK_ORIGIN` | cors.js | (unset) | Keep `https://letsrevise.com` |

### 1.3 Architecture During Transition

```
BEFORE (current):
  User → https://profound-gumdrop-4c8d83.netlify.app
       → /api/*, /uploads/*, /visuals/* (same-origin)
       → Netlify proxy → https://letsrevise-new.onrender.com
  DB stores: https://letsrevise-new.onrender.com/uploads/...
  Frontend makeAbsoluteAssetUrl: rewrites Render URLs to same-origin (Netlify)

AFTER (custom domain, same-origin proxy):
  User → https://letsrevise.com
       → /api/*, /uploads/*, /visuals/* (same-origin)
       → Netlify proxy → https://letsrevise-new.onrender.com (or api.letsrevise.com)
  DB: still has letsrevise-new.onrender.com URLs (unchanged)
  Frontend makeAbsoluteAssetUrl: rewrites to https://letsrevise.com/uploads/... (same-origin)
  New uploads: store https://letsrevise.com/uploads/... (same-origin)
```

---

## 2. Code/Config Changes Required Before Cutover

### 2.1 Frontend: Extend Same-Origin Proxy Detection

**File:** `frontend/src/services/api.ts`

**Current:**
```javascript
const isNetlify =
  typeof window !== "undefined" &&
  /\.netlify\.app$/i.test(window.location.hostname);

const baseURL =
  isNetlify
    ? ""
    : rawFromEnv || ...
```

**Change to:**
```javascript
const isSameOriginProxy =
  typeof window !== "undefined" &&
  (/\.netlify\.app$/i.test(window.location.hostname) ||
   window.location.hostname === "letsrevise.com" ||
   window.location.hostname === "www.letsrevise.com");

const baseURL =
  isSameOriginProxy
    ? ""
    : rawFromEnv || ...
```

Also update the `config.url` interceptor check from `BASE_URL === ""` to match.

### 2.2 Frontend: Support api.letsrevise.com in URL Rewriting

**File:** `frontend/src/utils/assetUrl.ts`

**Current:** Only rewrites `https://letsrevise-new.onrender.com/...` to same-origin.

**Change:** Add `https://api.letsrevise.com` to the list of backend URLs to rewrite, so future DB URLs or direct links work when rewritten to same-origin.

```javascript
const RENDER_BACKEND = "https://letsrevise-new.onrender.com";
const API_CUSTOM_DOMAIN = "https://api.letsrevise.com";

// In makeAbsoluteAssetUrl, when url starts with http:
const backends = [RENDER_BACKEND, API_CUSTOM_DOMAIN];
for (const backend of backends) {
  if (urlLower.startsWith(backend.toLowerCase() + "/uploads/") || ...) {
    const path = url.trim().slice(backend.length);
    return `${base}${path}`;
  }
}
```

### 2.3 Frontend: mediaUrl.ts getUploadBaseUrl (Optional)

**File:** `frontend/src/services/mediaUrl.ts`

`getUploadBaseUrl` returns hardcoded Render URL. It appears used for SSR or edge cases. Consider:
- Add `REACT_APP_ASSET_BASE_URL` env (optional)
- Or keep as-is; it's only used when `typeof window === "undefined"` or for non-local production. The main upload flow uses `toAbsoluteAssetUrl` which uses `getAssetBaseUrl` (window.location.origin). Verify callers.

### 2.4 Backend CORS: No Code Change

CORS uses `CORS_ORIGIN` and `FRONTEND_URL` from env. Add custom domains via env before cutover. The fallback `PRODUCTION_FRONTEND` is already `https://letsrevise.com`.

### 2.5 netlify.toml: No Change During Transition

Keep proxy target as `https://letsrevise-new.onrender.com` during rollout. After api.letsrevise.com is verified, optionally switch to `https://api.letsrevise.com` (both resolve to same Render service).

---

## 3. Rollout Sequence

### Phase 0: Pre-Cutover (Code Changes)

| Step | Action | Owner |
|------|--------|-------|
| 0.1 | Apply api.ts change (isSameOriginProxy) | Dev |
| 0.2 | Apply assetUrl.ts change (api.letsrevise.com) | Dev |
| 0.3 | Deploy frontend to Netlify (no domain change yet) | Dev |
| 0.4 | Verify profound-gumdrop still works | QA |

### Phase 1: DNS + Domain Setup

| Step | Action | Details |
|------|--------|---------|
| 1.1 | Add custom domain in Netlify | Site → Domain management → Add custom domain |
| 1.2 | Add `letsrevise.com` (apex) | Netlify provides: A record or ALIAS to Netlify LB |
| 1.3 | Add `www.letsrevise.com` | CNAME to `profound-gumdrop-4c8d83.netlify.app` (or Netlify-assigned) |
| 1.4 | Add custom domain in Render | Dashboard → Service → Settings → Custom Domains |
| 1.5 | Add `api.letsrevise.com` | CNAME to `letsrevise-new.onrender.com` |
| 1.6 | Configure www redirect | Netlify: Redirect www → apex (or vice versa per preference) |

**DNS Records (example):**

| Type | Name | Value |
|------|------|-------|
| A / ALIAS | @ | Netlify LB (from Netlify) |
| CNAME | www | profound-gumdrop-4c8d83.netlify.app |
| CNAME | api | letsrevise-new.onrender.com |

### Phase 2: Backend Env (Render)

| Step | Action | Value |
|------|--------|-------|
| 2.1 | Update `CORS_ORIGIN` | `https://letsrevise.com,https://www.letsrevise.com,https://profound-gumdrop-4c8d83.netlify.app` |
| 2.2 | Update `FRONTEND_URL` | `https://letsrevise.com` |
| 2.3 | Set `BACKEND_PUBLIC_URL` (optional) | `https://api.letsrevise.com` (for future migrations; migration script uses this) |
| 2.4 | Redeploy Render | Trigger deploy to pick up env |

### Phase 3: Frontend Env (Netlify)

| Step | Action | Value |
|------|--------|-------|
| 3.1 | Add/update Netlify env vars | Site → Environment variables |
| 3.2 | `REACT_APP_API_BASE` | `https://letsrevise.com` |
| 3.3 | `REACT_APP_API_URL` | `https://letsrevise.com` |
| 3.4 | Trigger new build | Deploy → Trigger deploy |

**Important:** With `REACT_APP_API_BASE=https://letsrevise.com`, when the user visits letsrevise.com, `isSameOriginProxy` is true → baseURL "". When user visits profound-gumdrop (during transition), `isNetlify` is true → baseURL "". So both work.

**Dual-domain note:** If you want both old and new domains to work, the build is the same. The frontend uses `window.location.origin` for same-origin. So one build serves both:
- profound-gumdrop-4c8d83.netlify.app → origin = that URL, proxy works
- letsrevise.com → origin = that URL, proxy works

So you do NOT need different builds. Set `REACT_APP_API_BASE` to the canonical frontend URL for non-proxy fallback (e.g. Docker). For Netlify + custom domain, both use same-origin.

### Phase 4: Verification

| Step | Check | Expected |
|------|-------|----------|
| 4.1 | https://letsrevise.com loads | 200, frontend |
| 4.2 | https://letsrevise.com/api/health | 200, JSON |
| 4.3 | Login at letsrevise.com | Success |
| 4.4 | Upload image in lesson editor | Success, URL stored |
| 4.5 | View lesson with existing images | Images load (rewritten from Render to same-origin) |
| 4.6 | https://api.letsrevise.com/api/health | 200 (direct backend) |
| 4.7 | https://profound-gumdrop-4c8d83.netlify.app | Still works (dual-domain) |

### Phase 5: Optional Cleanup (Later)

| Step | Action | When |
|------|--------|------|
| 5.1 | Update netlify.toml proxy target | To `https://api.letsrevise.com` (optional) |
| 5.2 | Remove old Netlify URL from CORS_ORIGIN | After traffic fully on custom domain |
| 5.3 | Redirect old Netlify URL → letsrevise.com | Netlify redirect rule |

---

## 4. Env Values Reference

### Before Cutover (Current)

| Var | Netlify | Render |
|-----|---------|--------|
| REACT_APP_API_BASE | https://letsrevise-new.onrender.com (unused when isNetlify) | — |
| CORS_ORIGIN | — | https://profound-gumdrop-4c8d83.netlify.app |
| FRONTEND_URL | — | https://profound-gumdrop-4c8d83.netlify.app |

### During Dual-Domain

| Var | Netlify | Render |
|-----|---------|--------|
| REACT_APP_API_BASE | https://letsrevise.com | — |
| REACT_APP_API_URL | https://letsrevise.com | — |
| CORS_ORIGIN | — | https://letsrevise.com,https://www.letsrevise.com,https://profound-gumdrop-4c8d83.netlify.app |
| FRONTEND_URL | — | https://letsrevise.com |
| BACKEND_PUBLIC_URL | — | https://api.letsrevise.com (optional) |

### After Full Cutover (Optional)

| Var | Netlify | Render |
|-----|---------|--------|
| CORS_ORIGIN | — | https://letsrevise.com,https://www.letsrevise.com |

---

## 5. Legacy Image URLs (letsrevise-new.onrender.com)

**Current DB:** Lessons store `https://letsrevise-new.onrender.com/uploads/...` and `.../visuals/...`.

**Behavior:**
- `makeAbsoluteAssetUrl` rewrites these to same-origin when on frontend domain.
- On letsrevise.com: `https://letsrevise.com/uploads/...` → Netlify proxy → Render.
- Images load correctly. No DB migration needed.

**Recommendation:** Keep `letsrevise-new.onrender.com` active. It is the Render service; api.letsrevise.com is a CNAME to it. Both serve the same app. No need to migrate DB URLs unless you want canonical api.letsrevise.com URLs for new content (would require backend returning api.letsrevise.com in upload responses and migration for existing content).

---

## 6. Exact Code Edits

### 6.1 frontend/src/services/api.ts

**Find:**
```javascript
const isNetlify =
  typeof window !== "undefined" &&
  /\.netlify\.app$/i.test(window.location.hostname);

// On Netlify, always use same-origin so proxy works (uploads, CORS, cold start)
const baseURL =
  isNetlify
    ? ""
```

**Replace with:**
```javascript
const isSameOriginProxy =
  typeof window !== "undefined" &&
  (/\.netlify\.app$/i.test(window.location.hostname) ||
   window.location.hostname === "letsrevise.com" ||
   window.location.hostname === "www.letsrevise.com");

// On Netlify or custom domain, use same-origin so proxy works (uploads, CORS, cold start)
const baseURL =
  isSameOriginProxy
    ? ""
```

### 6.2 frontend/src/utils/assetUrl.ts

**Find:**
```javascript
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const renderLower = RENDER_BACKEND.toLowerCase();
    const urlLower = url.trim().toLowerCase();
    if (urlLower.startsWith(renderLower + "/uploads/") || urlLower.startsWith(renderLower + "/visuals/") || urlLower.startsWith(renderLower + "/content/")) {
      const path = url.trim().slice(RENDER_BACKEND.length);
      return `${base}${path}`;
    }
    return url;
  }
```

**Replace with:**
```javascript
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const urlLower = url.trim().toLowerCase();
    const backends = [
      RENDER_BACKEND,
      "https://api.letsrevise.com",
    ];
    for (const backend of backends) {
      const bl = backend.toLowerCase();
      if (urlLower.startsWith(bl + "/uploads/") || urlLower.startsWith(bl + "/visuals/") || urlLower.startsWith(bl + "/content/")) {
        const path = url.trim().slice(backend.length);
        return `${base}${path}`;
      }
    }
    return url;
  }
```

---

## 7. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| DNS propagation delay | Add domains early; verify with `dig`/`nslookup` before switching traffic |
| CORS blocking new domain | Add letsrevise.com to CORS_ORIGIN before first visit |
| Old Netlify URL breaks | Keep in CORS_ORIGIN during dual-domain period |
| Upload fails on custom domain | Same-origin proxy unchanged; verify api.ts change |
| Existing images break | makeAbsoluteAssetUrl rewrites Render URLs to same-origin; no change |
| Stripe redirect wrong | FRONTEND_URL must be https://letsrevise.com for subscription success/cancel |

---

## 8. Rollout Checklist (Execution Order)

```
[ ] Phase 0: Code
    [ ] Edit frontend/src/services/api.ts (isSameOriginProxy)
    [ ] Edit frontend/src/utils/assetUrl.ts (api.letsrevise.com)
    [ ] Commit, push, deploy to Netlify
    [ ] Verify profound-gumdrop still works

[ ] Phase 1: DNS
    [ ] Add letsrevise.com in Netlify
    [ ] Add www.letsrevise.com in Netlify
    [ ] Add api.letsrevise.com in Render
    [ ] Create DNS records (A/CNAME) per Netlify/Render instructions
    [ ] Wait for propagation (up to 48h; often <1h)
    [ ] Verify: dig letsrevise.com, dig api.letsrevise.com

[ ] Phase 2: Backend
    [ ] Render → Environment: CORS_ORIGIN, FRONTEND_URL, BACKEND_PUBLIC_URL
    [ ] Redeploy Render

[ ] Phase 3: Frontend
    [ ] Netlify → Environment: REACT_APP_API_BASE, REACT_APP_API_URL
    [ ] Trigger Netlify build

[ ] Phase 4: Verify
    [ ] https://letsrevise.com loads
    [ ] https://letsrevise.com/api/health
    [ ] Login, upload, view lesson images
    [ ] https://www.letsrevise.com (redirect or works)
    [ ] https://api.letsrevise.com/api/health
    [ ] https://profound-gumdrop-4c8d83.netlify.app still works
```

---

## 9. Cookie/Auth Implications

- JWT in localStorage: no domain change impact.
- If cookies are used: ensure `SameSite` and `Secure`; domain would need to allow letsrevise.com. Current setup uses `withCredentials: false`; no cookies for API. No change required.
