# LetsRevise – Deployment Checklist (Production)

This checklist exists to prevent **environment drift, JWT invalidation, and silent frontend/backend mismatches**.

Follow this **in order** for every production deployment.

---

## 1) Pre-deploy sanity (local)

- Local frontend works against local backend
- Console shows:
  - `[LetsRevise] API_HOST: http://localhost:5000`
  - `[LetsRevise] axios baseURL: http://localhost:5000/api`
- No unexpected 401s or redirects during normal use
- Parent dashboard verified locally:
  - `GET /api/parent/children` → 200
  - `GET /api/parent/children/:childId/progress` → 200

---

## 2) Frontend production configuration

- Set frontend environment variable:
