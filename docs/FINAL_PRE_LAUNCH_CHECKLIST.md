# LetsRevise – Final Pre-Launch Checklist

Manual steps to complete before public launch, in order.

---

## 1. Verify Render Environment Variables

In [Render Dashboard](https://dashboard.render.com) → your backend service → Environment:

- [ ] `CORS_ORIGIN` = `https://profound-gumdrop-4c8d83.netlify.app` (or your custom domain)
- [ ] `FRONTEND_URL` = `https://profound-gumdrop-4c8d83.netlify.app` (or your custom domain)
- [ ] `OPENAI_API_KEY` is set
- [ ] `JWT_SECRET` or `JWT_SECRET_KEY` is set
- [ ] `MONGO_URI` or `MONGODB_URI` is set (MongoDB Atlas)
- [ ] `SENTRY_DSN` = your Sentry backend DSN (optional; see docs/SENTRY_SETUP.md)

---

## 2. Verify Netlify Environment Variables

In [Netlify Dashboard](https://app.netlify.com) → your site → Site settings → Environment variables:

- [ ] `REACT_APP_API_BASE` = `https://letsrevise-new.onrender.com` (or `https://api.letsrevise.com` for custom domain)
- [ ] `REACT_APP_API_URL` = same value (optional but recommended)
- [ ] `REACT_APP_SENTRY_DSN` = your Sentry frontend DSN (optional; see docs/SENTRY_SETUP.md)

---

## 3. Trigger a Fresh Netlify Build

After any env var changes:

- [ ] Netlify → Deploys → Trigger deploy → Deploy site
- [ ] Wait for build to complete
- [ ] Confirm the new deploy is live

---

## 4. Smoke Test Production

- [ ] Open https://profound-gumdrop-4c8d83.netlify.app
- [ ] Log in with a test account
- [ ] Visit `/teacher-dashboard` or `/student-dashboard`
- [ ] Refresh the page directly (should load without 404)
- [ ] Run `scripts/check-production-health.ps1` (or `.sh`) and confirm SUCCESS

---

## 5. (Optional) Set Up Uptime Monitoring

To reduce Render cold starts:

- [ ] Create an account at [UptimeRobot](https://uptimerobot.com) (or similar)
- [ ] Add monitor: `https://letsrevise-new.onrender.com/api/health`
- [ ] Set interval to 10 minutes

See `docs/RENDER_UPTIME_GUIDE.md` for details.

---

## 6. (When Ready) Custom Domain

When moving to letsrevise.com:

- [ ] Follow `docs/CUSTOM_DOMAIN_SETUP.md`
- [ ] Add custom domain in Netlify and Render
- [ ] Update DNS (A/CNAME records)
- [ ] Update Netlify and Render env vars
- [ ] Trigger new Netlify build
- [ ] Redeploy Render if needed
- [ ] Test login and API from new domain

---

## 7. Final Security Check

- [ ] No secrets or API keys in git
- [ ] `.env` is in `.gitignore` and not committed
- [ ] MongoDB Atlas IP allowlist includes Render (or `0.0.0.0/0` for dev)

---

## 8. Go Live

- [ ] All above steps complete
- [ ] Stakeholders notified
- [ ] Monitor logs and errors for first 24 hours
