# SECURITY_NOTES.md — P0 + P1.0

> What the hardening protects, what it does NOT yet protect, and what you must rotate before public deployment.

---

## What is protected

### P0 hardening (verified)
- **P0.1 JWT Auth** — bcrypt + HS256, idempotent admin seed, axios 401 interceptor → `/login?next=`
- **P0.2 Per-user LLM Budget Cap** — daily + monthly ledger; 429 fires **before** any provider call. Visual Explanation routes share the same per-user counter as lesson generation + marking.
- **P0.3 Schema Validation + 1 Auto-Retry** — Pydantic; 422 with structured `errors[]`; no `/lesson/undefined`
- **P0.4 Root React Error Boundary** — `sanitize()` strips `sk-*`, file paths, stack frames; production builds skip `componentStack` logging
- **P0.5 LLM Failure + Idempotency** — clean 503 envelope `{detail, code, retryable:true}`; in-memory inflight lock returns 409 on duplicate; lock released in success + failure paths

### P1.0 Visual Explanation (verified)
- **Auth-gated** — anonymous `POST /api/visual-explanations/generate` returns 401, never touches the LLM
- **Budget-checked** — `check_budget()` runs before the Claude call; returns 429 if over daily/monthly cap
- **Timeout-bound** — 120-sec outer `asyncio.wait_for`; cleanly raises `LLMTimeoutError` → 503 envelope
- **Image best-effort** — if Nano Banana fails, the 8-section explanation is still returned with `provider_status: "image_provider_unavailable"`. No exception bubbles to the user.
- **No prompt leak** — provider error strings are sanitised before being placed in the response envelope
- **No third-party attribution** — image watermark reads `© letsrevise.com · GCSE diagram`. Users never see "Nano Banana" or "Gemini" in the UI.
- **Persisted lean** — `visual_explanations` collection persists everything EXCEPT the (potentially large) base64 image. Image is returned inline to the client; if you need re-hydration, swap to S3/disk.
- **Audit row** — every successful or failed call records to `llm_usage` with `action_type: "visual_explanation"`

---

## Known risks (not blockers)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | In-memory `app.state.inflight` won't survive multi-pod scale-out | LOW | Replace with Redis `SET NX EX` before scaling >1 pod |
| 2 | `EMERGENT_LLM_KEY` shared upstream cap → transient 503s under traffic spikes (now amplified — every image = 2 LLM calls) | MED | The 503 envelope is user-friendly + retryable. Consider provider rotation / queue post-MVP. **Monitor your Emergent dashboard headroom after enabling P1.0 in prod.** |
| 3 | JWT in `localStorage` → vulnerable to XSS exfiltration if any XSS bug is introduced | LOW | React's escape-by-default + ErrorBoundary `sanitize()` reduce surface. Migrate to httpOnly cookie post-MVP. |
| 4 | No rate-limit on `/api/auth/login` brute force | MED | Add per-IP + per-email exponential lockout as P0.7 if you want it before public launch |
| 5 | No image-prompt safety filter beyond Pydantic length cap. A malicious prompt could try to extract proprietary outputs from Nano Banana | LOW | Nano Banana itself has Google's safety layer. Add a server-side allow-list of GCSE topics as P1.2 if you want belt-and-braces. |
| 6 | Image bytes returned inline as base64 → larger response payload (~50–200 KB) | LOW | If you see slow loads, switch to disk/S3 upload with a signed URL response. Backend doc already persists everything except the data URL. |
| 7 | Generated images aren't moderated for educational appropriateness before display | LOW–MED | Nano Banana's prompt rules + our system prompt forbid clutter/branding/photoreal. For under-18 audiences, consider adding a moderation pass (Anthropic content safety, or OpenAI moderation) as P1.3 |
| 8 | Per-user budget cap doesn't bound global daily spend | MED | A single user can exhaust your daily ceiling. Add a global daily ceiling check + Sentry alarm as P0.7. |
| 9 | No structured audit log of admin actions | LOW | Add `audit_log` collection if you onboard schools (B2B compliance). |

---

## ⚠️ Mandatory before public deployment

### 1. Rotate sandbox credentials
The sandbox seeded these:
```
ADMIN_EMAIL    = teacher@letsrevise.dev
ADMIN_PASSWORD = LetsRevise!2026
```
**Do NOT use in production.** Pick:
```bash
export ADMIN_EMAIL=admin@yourdomain.com
export ADMIN_PASSWORD=$(python -c "import secrets; print(secrets.token_urlsafe(20))")
```
Set in Render.

### 2. Rotate JWT_SECRET
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 3. Confirm flags are OFF
```
TEACHER_BRAIN_EXAMINER_LANGUAGE_V2=0
TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE=0
TEACHER_BRAIN_TEACHER_FIRST_OPENING=0
```

### 4. Restrict `CORS_ORIGINS`
```
CORS_ORIGINS=https://letsrevise.com,https://www.letsrevise.com
```
Not `*`.

### 5. Confirm `.gitignore`
```
**/.env
**/.env.local
```

### 6. Bundle secret scan
```bash
cd frontend && yarn build
grep -rE 'EMERGENT_LLM_KEY|JWT_SECRET|MONGO_URL|sk-emergent|sk-ant-|mongodb://' \
  build/static/js/
# expected: empty
```

### 7. Render preview before merging to `main`
- Deploy `teacher-brain-p0-p1` to a preview env
- Run §9 + §10 of `COPY_BACK_CHECKLIST.md` against the preview URL
- Generate at least 3 visual explanations on different topics to confirm provider headroom

---

## Threat model — quick recap

| Threat | Layer that catches it |
|---|---|
| Anonymous user burns LLM budget | P0.1 auth (401 before provider) |
| Signed-in user burns LLM budget | P0.2 budget cap (429 before provider) — applies to lessons + marks + **visual explanations** |
| Image gen fails / Nano Banana down | P1.0 best-effort fallback (explanation still returned, status flag set) |
| LLM returns garbage | P0.3 schema validation (lessons) / P1.0 422 (visual explanations) |
| Component renders error → white screen | P0.4 ErrorBoundary |
| Provider down / timeout | P0.5 / P1.0 503 envelope (no save, retryable) |
| Double-click / network retry → duplicate | P0.5 inflight lock (409) |
| Secrets in bundle | Build-time grep + `REACT_APP_*` rule |
| Stack traces / paths / keys in error responses | `sanitize()` + server exception handlers |
| Image attribution leak to user | Watermark hard-coded to `© letsrevise.com` |

---

## In summary

**Safe to integrate** for a single-tenant, single-pod, invite-only launch with the P0 + P1.0 stack. Before public:
1. Rotate ADMIN_PASSWORD, JWT_SECRET, ADMIN_EMAIL
2. Address risk #2 (monitor Emergent LLM budget headroom — P1.0 doubles per-action cost)
3. Address risk #4 (login rate-limit) if public sign-up enabled
