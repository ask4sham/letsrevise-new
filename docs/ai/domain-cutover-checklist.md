# Domain Cutover Operational Checklist

**Target domains:** https://letsrevise.com, https://www.letsrevise.com, https://api.letsrevise.com  
**Strategy:** Dual-domain support; keep profound-gumdrop and letsrevise-new.onrender.com active during transition. No DB migration.

---

## BACKEND_PUBLIC_URL: Safest Choice

**Recommendation: Leave BACKEND_PUBLIC_URL unset during cutover.**

| Option | Effect | Risk |
|--------|--------|------|
| **Unset (default)** | Backend uses `https://letsrevise-new.onrender.com` for local dev proxy and `/api/config` | None. Both hostnames resolve to same Render service. |
| **Set to api.letsrevise.com** | Backend would return api.letsrevise.com in `/api/config` | Low, but adds a config change and depends on api DNS being live. |

**Why leave unset:** The frontend does not rely on `/api/config` for uploads; it uses `window.location.origin`. Existing DB URLs point to letsrevise-new.onrender.com; `makeAbsoluteAssetUrl` rewrites them to same-origin. No backend change needed. Set `BACKEND_PUBLIC_URL=https://api.letsrevise.com` only later if you want canonical api URLs for future migrations.

---

## Part 1: Netlify Domain Setup

| Step | Action | Value / Where | Why | Rollback |
|------|--------|---------------|-----|----------|
| 1.1 | Netlify Dashboard → Site → **Domain management** → **Add custom domain** | — | Register custom domains with Netlify | Remove domain in same UI |
| 1.2 | Add **letsrevise.com** (apex) | Netlify will show DNS instructions | Apex is canonical frontend | Remove domain |
| 1.3 | Add **www.letsrevise.com** | Netlify will show CNAME target | www subdomain | Remove domain |
| 1.4 | Configure **www → apex redirect** | Netlify → Domain management → **Redirects** | Redirect www to letsrevise.com | Remove redirect |
| 1.4a | Add redirect rule | From: `https://www.letsrevise.com/*` → To: `https://letsrevise.com/:splat` | Status: 301 | — |

**Note:** Do not change Netlify env vars yet. That happens in Part 5.

---

## Part 2: Render Custom Domain Setup

| Step | Action | Value / Where | Why | Rollback |
|------|--------|---------------|-----|----------|
| 2.1 | Render Dashboard → **letsrevise-new** service → **Settings** → **Custom Domains** | — | Add api subdomain | Remove custom domain |
| 2.2 | Add custom domain | `api.letsrevise.com` | Direct API access; future-proofing | Remove in Render |
| 2.3 | Note Render’s SSL status | Wait for “Certificate ready” | HTTPS required | — |

**Note:** Do not change Render env vars yet. That happens in Part 4.

---

## Part 3: DNS Records

Create these at your DNS provider (e.g. Cloudflare, Namecheap, Route53). Netlify and Render will show their own values; use these as reference.

| Type | Name | Value | TTL | Why |
|------|------|-------|-----|-----|
| **A** or **ALIAS** | `@` | Netlify load balancer IP(s) from Netlify | 3600 | Apex → Netlify frontend |
| **CNAME** | `www` | `profound-gumdrop-4c8d83.netlify.app` | 3600 | www → Netlify (or Netlify-assigned hostname) |
| **CNAME** | `api` | `letsrevise-new.onrender.com` | 3600 | api → Render backend |

**Exact values:**
- **Apex (@):** Use the IP(s) or ALIAS target Netlify provides in Domain management.
- **www:** Use the CNAME target Netlify shows (often `profound-gumdrop-4c8d83.netlify.app` or `apex-loadbalancer.netlify.com`).
- **api:** `letsrevise-new.onrender.com` (Render’s default hostname).

**Propagation:** Allow up to 48 hours; often <1 hour. Verify with:
```bash
dig letsrevise.com
dig www.letsrevise.com
dig api.letsrevise.com
```

---

## Part 4: Render Env Updates

| Step | Action | Var | Value | Why | Rollback |
|------|--------|-----|-------|-----|----------|
| 4.1 | Render → **letsrevise-new** → **Environment** | `CORS_ORIGIN` | `https://letsrevise.com,https://www.letsrevise.com,https://profound-gumdrop-4c8d83.netlify.app` | Allow all frontend origins | Revert to previous value |
| 4.2 | Render → **Environment** | `FRONTEND_URL` | `https://letsrevise.com` | Stripe redirects, CORS fallback | Revert to previous value |
| 4.3 | **Do not set** | `BACKEND_PUBLIC_URL` | (leave unset) | See BACKEND_PUBLIC_URL section above | — |
| 4.4 | **Save** | — | — | Apply env changes | — |
| 4.5 | **Manual Deploy** | — | Deploy → **Manual deploy** → **Deploy latest commit** | Pick up new env | Redeploy previous commit if needed |

**Exact env values:**
```
CORS_ORIGIN=https://letsrevise.com,https://www.letsrevise.com,https://profound-gumdrop-4c8d83.netlify.app
FRONTEND_URL=https://letsrevise.com
```

---

## Part 5: Netlify Env Updates

| Step | Action | Var | Value | Why | Rollback |
|------|--------|-----|-------|-----|----------|
| 5.1 | Netlify → Site → **Site configuration** → **Environment variables** | — | — | — | — |
| 5.2 | Add or edit | `REACT_APP_API_BASE` | `https://letsrevise.com` | Canonical frontend URL for non-proxy fallback (e.g. Docker) | Revert to previous |
| 5.3 | Add or edit (optional) | `REACT_APP_API_URL` | `https://letsrevise.com` | Same as above | — |
| 5.4 | **Save** | — | — | — | — |
| 5.5 | **Trigger deploy** | Deploy → **Trigger deploy** → **Deploy site** | Rebuild with new env | Trigger deploy with previous env |

**Exact env value:**
```
REACT_APP_API_BASE=https://letsrevise.com
```

**Note:** On Netlify and letsrevise.com, `isSameOriginProxy` is true, so `baseURL` stays `""` and API calls use same-origin. `REACT_APP_API_BASE` is for non-proxy contexts (e.g. Docker).

---

## Part 6: Deployment Order

Execute in this order to avoid CORS and routing issues:

| Order | Part | When |
|-------|------|------|
| 1 | Part 1: Netlify domain setup | Add domains in Netlify (no DNS yet) |
| 2 | Part 2: Render custom domain | Add api.letsrevise.com in Render |
| 3 | Part 3: DNS records | Create A/CNAME records |
| 4 | Wait for DNS propagation | Verify with `dig` |
| 5 | Part 4: Render env + deploy | CORS must allow new domains before first visit |
| 6 | Part 5: Netlify env + deploy | Rebuild frontend with new env |

**Critical:** Update Render env (Part 4) **before** users hit letsrevise.com, so CORS allows the new origin.

---

## Part 7: Post-Cutover Verification

Run after Parts 1–6 are complete.

| # | Check | How | Expected |
|---|-------|-----|----------|
| 7.1 | letsrevise.com loads | Open https://letsrevise.com | 200, frontend |
| 7.2 | www redirects | Open https://www.letsrevise.com | 301 → https://letsrevise.com |
| 7.3 | API proxy | Open https://letsrevise.com/api/health | 200, JSON `{"status":"OK",...}` |
| 7.4 | Login | Log in at letsrevise.com | Success |
| 7.5 | Dashboard | Open dashboard | Loads |
| 7.6 | Lesson images | Open lesson with images | Images load |
| 7.7 | Upload | Upload image in lesson editor | Success |
| 7.8 | Same-origin API | DevTools → Network | Requests to letsrevise.com/api/... |
| 7.9 | api.letsrevise.com | Open https://api.letsrevise.com/api/health | 200, JSON |
| 7.10 | Old Netlify URL | Open https://profound-gumdrop-4c8d83.netlify.app | Still works |
| 7.11 | Old Render URL | Open https://letsrevise-new.onrender.com/api/health | Still works |

---

## Part 8: Rollback Order

If something breaks, revert in reverse order:

| Order | Action | How |
|-------|--------|-----|
| 1 | Revert Netlify env | Set `REACT_APP_API_BASE` to previous value; trigger deploy |
| 2 | Revert Render env | Restore previous `CORS_ORIGIN` and `FRONTEND_URL`; redeploy |
| 3 | DNS (optional) | Remove or change A/CNAME for letsrevise.com, www, api |
| 4 | Remove domains | Remove custom domains in Netlify and Render |

**Note:** profound-gumdrop and letsrevise-new.onrender.com stay active; users can fall back to the old URL.

---

## Summary: Exact Env Values

### Render (Part 4)
```
CORS_ORIGIN=https://letsrevise.com,https://www.letsrevise.com,https://profound-gumdrop-4c8d83.netlify.app
FRONTEND_URL=https://letsrevise.com
```
*(Do not set BACKEND_PUBLIC_URL)*

### Netlify (Part 5)
```
REACT_APP_API_BASE=https://letsrevise.com
```

---

## Summary: Exact DNS Records

| Type | Name | Value |
|------|------|-------|
| A or ALIAS | @ | (from Netlify) |
| CNAME | www | profound-gumdrop-4c8d83.netlify.app |
| CNAME | api | letsrevise-new.onrender.com |

---

## Final Go-Live Verification Checklist

```
[ ] 7.1  https://letsrevise.com loads
[ ] 7.2  https://www.letsrevise.com redirects to apex
[ ] 7.3  https://letsrevise.com/api/health returns JSON
[ ] 7.4  Login works at letsrevise.com
[ ] 7.5  Dashboard loads
[ ] 7.6  Lesson images render
[ ] 7.7  Upload works
[ ] 7.8  API requests are same-origin (DevTools)
[ ] 7.9  https://api.letsrevise.com/api/health works
[ ] 7.10 https://profound-gumdrop-4c8d83.netlify.app still works
[ ] 7.11 https://letsrevise-new.onrender.com/api/health still works
```

All pass → cutover complete. Old hostnames remain available for fallback.
