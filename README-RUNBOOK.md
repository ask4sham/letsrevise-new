# LetsRevise – RUNBOOK (Env + Auth Drift Prevention)

## The #1 failure mode: mixed backend + token mismatch
If the frontend calls a different backend than the one that issued the JWT, you will see:
- 401s
- `JWT VERIFY FAILED: invalid signature`
- “random logouts” (axios interceptor clears token + redirects)

Cause:
- Frontend API baseURL drift (often `.env.local` overriding `.env`)
- Switching between local and Render without clearing localStorage

Fix:
1) Ensure API baseURL is correct
2) Clear localStorage keys `token` and `user`
3) Re-login

## Environment rules (must follow)

### Local development
Use local backend only:
- `REACT_APP_API_URL=http://localhost:5000`

### Production (Render)
Use Render backend:
- `REACT_APP_API_URL=https://letsrevise-new.onrender.com`

### Hard rule
One frontend session must use one backend.
If you change backend URL, clear `localStorage` and login again.

## Guardrail logging
Frontend logs resolved target at startup in:
- `frontend/src/services/api.ts`

Look for:
- `[LetsRevise] API_HOST: ...`
- `[LetsRevise] axios baseURL: ...`

If UI is localhost but API_HOST is Render → you are in drift territory.

## Parent dashboard quick check
When working, these return 200:
- `GET /api/parent/children`
- `GET /api/parent/children/:childId/progress`
