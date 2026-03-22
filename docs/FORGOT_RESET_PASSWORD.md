# Forgot / Reset Password Implementation

## Summary

Production-safe forgot/reset password flow using secure tokens, bcrypt, Resend email, and rate limiting.

---

## Files Changed

### Backend

| File | Changes |
|------|---------|
| `backend/models/User.js` | Added `passwordResetToken`, `passwordResetExpires` |
| `backend/routes/auth.js` | Added `sendPasswordResetEmail`, `forgotPasswordLimiter`, `resetPasswordLimiter`, `POST /forgot-password`, `POST /reset-password` |

### Frontend

| File | Changes |
|------|---------|
| `frontend/src/pages/ForgotPasswordPage.tsx` | **New** — email form, generic success message |
| `frontend/src/pages/ResetPasswordPage.tsx` | **New** — token from URL, new password + confirm |
| `frontend/src/App.tsx` | Routes for `/forgot-password`, `/reset-password` |
| `frontend/src/pages/LoginPage.tsx` | "Forgot password?" link next to Password label |

---

## New Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/forgot-password` | Request reset email (body: `{ email }`) |
| POST | `/api/auth/reset-password` | Reset with token (body: `{ token, password }`) |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_BASE_URL` | Yes (prod) | Frontend base URL for reset link. Default: `http://localhost:3000` |
| `RESEND_API_KEY` | Yes (prod) | Resend API key for sending emails |
| `RESEND_FROM_EMAIL` | Yes (prod) | Verified sender email (e.g. `noreply@letsrevise.com`) |

**Example (production):**

```
APP_BASE_URL=https://letsrevise.com
RESEND_API_KEY=re_xxxx
RESEND_FROM_EMAIL=noreply@letsrevise.com
```

**Development:** Without `RESEND_API_KEY`, reset emails are logged only (no actual send).

---

## Behaviour

### Forgot password

1. User submits email.
2. Generic success response always returned.
3. If user exists: 32-byte hex token, 1h expiry, stored on User.
4. Email sent via Resend with reset link: `{APP_BASE_URL}/#/reset-password?token=...`.

### Reset password

1. User opens link, submits new password + confirm.
2. Token validated (exists + not expired).
3. Password hashed with bcrypt (12 rounds).
4. Token cleared immediately (single-use).

### Rate limiting

| Endpoint | Limit |
|----------|-------|
| `/forgot-password` | 5 requests / 15 min per IP |
| `/reset-password` | 10 requests / 15 min per IP |

---

## Test Checklist

- [ ] **Forgot password**
  - [ ] Submit unknown email → generic success, no error.
  - [ ] Submit known email → success, email sent.
  - [ ] In dev (no Resend): link logged to console.
  - [ ] In prod: email received, link works.

- [ ] **Reset password**
  - [ ] No token → "Invalid reset link".
  - [ ] Expired token → "Reset link has expired".
  - [ ] Valid token → reset succeeds, can log in.
  - [ ] Same token reused → fails (single-use).

- [ ] **Rate limiting**
  - [ ] 6th forgot-password in 15 min → 429.
  - [ ] 11th reset-password in 15 min → 429.

- [ ] **UX**
  - [ ] Login page has "Forgot password?".
  - [ ] Forgot page: success → generic message.
  - [ ] Reset page: success → "Sign in" button.
  - [ ] HashRouter: `/#/forgot-password`, `/#/reset-password`.

---

## Migration

No migration script required. New fields are optional and default to `null` in MongoDB. Existing users get `passwordResetToken: null`, `passwordResetExpires: null` implicitly.
