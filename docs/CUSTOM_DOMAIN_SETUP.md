# Custom Domain Setup Guide

This guide covers moving LetsRevise from temporary Netlify/Render URLs to the production domain.

## Target Structure

| Service | Current URL | Target URL |
|---------|-------------|------------|
| Frontend | https://profound-gumdrop-4c8d83.netlify.app | https://letsrevise.com |
| Backend | https://letsrevise-new.onrender.com | https://api.letsrevise.com |

## Hosting Responsibilities

- **Netlify** hosts:
  - `letsrevise.com` (apex)
  - `www.letsrevise.com` (optional)

- **Render** hosts:
  - `api.letsrevise.com`

## Canonical Frontend Domain

**Recommendation:** Use `https://letsrevise.com` (apex) as the canonical frontend URL.

- **Option A:** Redirect `www.letsrevise.com` → `letsrevise.com` (apex is canonical)
- **Option B:** Redirect `letsrevise.com` → `www.letsrevise.com` (www is canonical)

Most modern setups prefer apex (`letsrevise.com`) as canonical.

## Environment Variables After Domain Switch

### Netlify (Frontend)

Update these in Netlify → Site settings → Environment variables:

| Variable | New Value |
|----------|-----------|
| `REACT_APP_API_BASE` | `https://api.letsrevise.com` |
| `REACT_APP_API_URL` | `https://api.letsrevise.com` |

Then **trigger a new build** so the frontend picks up the new API URL.

### Render (Backend)

Update these in Render → Environment:

| Variable | New Value |
|----------|-----------|
| `CORS_ORIGIN` | `https://letsrevise.com` |
| `FRONTEND_URL` | `https://letsrevise.com` |

If you use `www` as canonical, use `https://www.letsrevise.com` instead.

## DNS Configuration

1. **Apex domain (letsrevise.com):** Point to Netlify's load balancer (Netlify provides the IP).
2. **www.letsrevise.com:** Add a CNAME to your Netlify site (e.g. `your-site.netlify.app`).
3. **api.letsrevise.com:** Add a CNAME to your Render service (e.g. `letsrevise-new.onrender.com`).

Both Netlify and Render provide step-by-step DNS instructions in their dashboards.

## Backend CORS Fallback

If `CORS_ORIGIN` and `FRONTEND_URL` are not set, the backend uses `CORS_FALLBACK_ORIGIN` (or `https://letsrevise.com`). For the current temporary deployment, set `CORS_FALLBACK_ORIGIN=https://profound-gumdrop-4c8d83.netlify.app` on Render if needed. Normally `CORS_ORIGIN` is set, so this is rarely required.

## Checklist

- [ ] Add custom domain in Netlify
- [ ] Add custom domain in Render
- [ ] Configure DNS (A/CNAME records)
- [ ] Update Netlify env vars
- [ ] Update Render env vars
- [ ] Trigger new Netlify build
- [ ] Redeploy Render (if needed)
- [ ] Test login and API from new domain
- [ ] Update CORS if using www as canonical
