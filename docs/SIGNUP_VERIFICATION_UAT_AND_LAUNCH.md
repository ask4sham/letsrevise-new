# SIGNUP + EMAIL VERIFICATION — UAT & LAUNCH CHECKLIST

## 🎯 GO / NO-GO RULE

You are only allowed to launch if ALL of the following are true:

- ✅ Verification email is received
- ✅ Verification link opens on the correct public hostname
- ✅ User becomes verified and banner disappears after refresh

👉 If ANY of the above fails → **NO-GO**

---

## 👤 Owner

- Person responsible: __________________
- Run this checklist:
  - Before production launch
  - Before any auth / email / DNS related release

---

## 🚀 FAST MANUAL TEST SEQUENCE

Run this in staging or production-like environment.

### 1. Minimal signup
- Register new student with:
  - first name
  - email
  - password
- Confirm:
  - logged in immediately
  - success screen shown
  - “Continue to dashboard” works

---

### 2. Resend + cooldown
- Click “Resend email”
- Click again within 45 seconds
- Confirm:
  - cooldown enforced
  - 429 behavior shown
  - button disabled / countdown visible

---

### 3. Real email delivery
- Check inbox (and spam/promotions)
- Confirm:
  - email arrives
  - sender is correct (noreply@letsrevise.com)

---

### 4. Verification link
- Click verification link
- Confirm:
  - opens correct domain (APP_BASE_URL)
  - verify page loads
  - success message shown

---

### 5. Banner behaviour
- Return to app (or refresh)
- Confirm:
  - verification banner disappears

---

### 6. Login states
- Log out
- Log back in BEFORE verifying (new account)
  - banner appears
- Log in AFTER verifying
  - no banner

---

### 7. Feature gating
Unverified user:
- ❌ Cannot access:
  - subscription page
  - parent dashboard
  - email/password changes
- ✅ Can access:
  - dashboard
  - lesson browsing

Verified user:
- ✅ All features accessible

---

### 8. Complete profile
- If routed to `/complete-profile`:
  - submit year group / school / last name
- Confirm:
  - data saves
  - redirect works

---

### 9. Optional failure test (important)
Simulate email failure (test env only):
- Break Resend config
- Register new user
- Confirm:
  - UI does NOT say “check your email”
  - warning message is shown instead

---

## ⚙️ OPS CHECKLIST (CRITICAL)

Before launch, confirm:

- [ ] `APP_BASE_URL` = exact public site URL (e.g. https://letsrevise.com)
- [ ] `RESEND_API_KEY` is set in backend
- [ ] `RESEND_FROM_EMAIL` = verified domain (e.g. noreply@letsrevise.com)
- [ ] Resend domain is **Verified (DKIM + SPF + MX)**
- [ ] At least ONE real signup + verify flow completed on production hostname

---

## ⚠️ KNOWN RISK AREAS

- Email deliverability (spam, promotions, delays)
- Incorrect APP_BASE_URL causing broken links
- Missing gating on new or hidden routes
- Cached user state after verification (requires refresh)

---

## ✅ FINAL DECISION

| Condition | Result |
|----------|--------|
| All 3 GO checks pass | 🚀 GO |
| Any check fails | ❌ NO-GO |

---

## 🧠 NOTE

Do NOT skip this checklist.

This flow is:
- critical for user onboarding
- directly tied to retention
- one of the most common production failure points

Run it every time before launch.
