# ENV_REQUIRED.md — P0 + P1.0

> Set in your hosting provider's dashboard (Render → service → Environment).
> Never commit real `.env` files to Git.

**P1.0 adds ZERO new env vars** — Visual Explanation reuses `EMERGENT_LLM_KEY`.

---

## Backend env vars

| Variable | Required | Example (safe placeholder) | Notes |
|---|---|---|---|
| `MONGO_URL` | ✅ | `mongodb+srv://USER:PASS@cluster.mongodb.net` | Atlas or Render Mongo addon. |
| `DB_NAME` | ✅ | `letsrevise_prod` | Pick per environment. |
| `CORS_ORIGINS` | ✅ | `https://letsrevise.com,https://www.letsrevise.com` | Comma-separated. Not `*` in prod. |
| `EMERGENT_LLM_KEY` | ✅ | `<set in Render — never commit>` | Used by **both** Claude text gen AND Gemini Nano Banana image gen. |
| `JWT_SECRET` | ✅ | `<generate fresh 64-char hex>` | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_EXPIRES_DAYS` | optional | `7` | Defaults to 7. |
| `ADMIN_EMAIL` | ✅ | `admin@yourdomain.com` | **Do NOT** use `teacher@letsrevise.dev` in prod. |
| `ADMIN_PASSWORD` | ✅ | `<strong, unique, set in Render>` | **Do NOT** use `LetsRevise!2026` in prod. |
| `TEACHER_BRAIN_DAILY_LLM_LIMIT` | ✅ | `10` | Per-user/day. Counts lessons + marks + **visual explanations**. |
| `TEACHER_BRAIN_MONTHLY_LLM_LIMIT` | ✅ | `100` | Per-user/month. Same shared counter. |
| `TEACHER_BRAIN_EXAMINER_LANGUAGE_V2` | ✅ | `0` | **MUST be 0** in production. |
| `TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE` | ✅ | `0` | **MUST be 0** in production. |
| `TEACHER_BRAIN_TEACHER_FIRST_OPENING` | ✅ | `0` | **MUST be 0** in production. |

---

## Frontend env vars

| Variable | Required | Notes |
|---|---|---|
| `REACT_APP_BACKEND_URL` | ✅ | External URL of your backend. Public — never put secrets in `REACT_APP_*`. |

---

## `.env.example` for your repo

> Commit this as `backend/.env.example` with no real values. Real values go in Render.

```dotenv
MONGO_URL=
DB_NAME=
CORS_ORIGINS=*

EMERGENT_LLM_KEY=

JWT_SECRET=
JWT_EXPIRES_DAYS=7
ADMIN_EMAIL=
ADMIN_PASSWORD=

TEACHER_BRAIN_DAILY_LLM_LIMIT=10
TEACHER_BRAIN_MONTHLY_LLM_LIMIT=100

TEACHER_BRAIN_EXAMINER_LANGUAGE_V2=0
TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE=0
TEACHER_BRAIN_TEACHER_FIRST_OPENING=0
```

---

## Before public deploy

1. Rotate `ADMIN_PASSWORD` (not `LetsRevise!2026`)
2. Rotate `JWT_SECRET` (not sandbox value)
3. Rotate `ADMIN_EMAIL` to your real admin
4. Confirm all three `TEACHER_BRAIN_*` flags are `0`
5. Restrict `CORS_ORIGINS` to your real domains
6. Confirm `EMERGENT_LLM_KEY` has enough budget headroom for image gen volume — each visual explanation = 1 Claude call + 1 Nano Banana call
