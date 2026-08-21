# Stripe billing environment variables

Documentation for LetsRevise Stripe billing (B2 Checkout foundation, B3 webhooks).

**LetsRevise Pro** — one universal premium subscription covering all premium subjects (current and future). Catalogue/publishing controls what content is available; Stripe controls paid entitlement.

**B2 test mode only** until explicit production go-live. Use `sk_test_*` keys only.

## Required for B2 (Checkout)

| Variable | Example | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` | Stripe API secret key (test mode) |
| `STRIPE_PRICE_ID_LETSREVISE_PRO` | `price_...` | Server-owned recurring Price for LetsRevise Pro |
| `FRONTEND_URL` | `http://localhost:3000` | Base URL for server-controlled Checkout success/cancel redirects (HashRouter: `/#/subscription/success`, `/#/subscription/cancel`) |

## Required for B3 (webhooks)

| Variable | Example | Purpose |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Signing secret for `POST /api/webhooks/stripe` signature verification |

## Security notes

- Clients must **not** supply `priceId`, `price`, `line_items`, `amount`, `currency`, `planId`, `userId`, or `letsReviseUserId` on Checkout creation.
- Checkout metadata uses **`letsReviseUserId`** (not client-supplied) plus server-owned **`planId: letsrevise_pro`**.
- Checkout creation reuses an existing **open** LetsRevise Pro session for the same Stripe Customer when present (avoids duplicate hosted Checkout before payment completes).
- Production keys (`sk_live_*`) are blocked until explicit go-live approval.

## B6 launch verification (pre go-live)

Before switching to live Stripe keys:

| Check | Action |
|---|---|
| Price ID | Confirm `STRIPE_PRICE_ID_LETSREVISE_PRO` in Stripe Dashboard is the **£4.99/month** recurring Price for LetsRevise Pro |
| Duplicate subscriptions | Enable Stripe **“Limit customers to one subscription”** on the Checkout / Product settings as a second line of defence |
| Webhook | Confirm live `STRIPE_WEBHOOK_SECRET` and endpoint URL |

## Code references

- Config: `backend/config/stripe.js`
- Checkout service: `backend/services/stripeCheckoutService.js`
- Portal service: `backend/services/stripePortalService.js`
- Webhook service: `backend/services/stripeWebhookService.js`
- Route (Checkout): `POST /api/subscriptions/create-checkout-session`
- Route (Portal): `POST /api/subscriptions/create-portal-session`
- Route (webhook): `POST /api/webhooks/stripe` (raw body; mounted before JSON parser in `app.js`)

## B5 Customer Portal (test mode)

| Requirement | Notes |
|---|---|
| Stripe Dashboard | Enable **Customer Portal** for the test-mode Stripe account and configure allowed subscription management actions |
| Return URL | Server-owned `${FRONTEND_URL}/#/subscription` (HashRouter) |
| Security | Client must not supply `customerId`, `return_url`, or portal `configuration`; backend uses persisted `stripeBilling.customerId` for authenticated user only |
| B5 UI scope | **Manage billing** shown only when `hasLetsReviseProAccess === true` (active Pro) |

## B6 pre-production requirements (blocks go-live)

Production activation remains **blocked** until B6 verification is complete:

| Requirement | Action |
|---|---|
| Portal configuration | Verify live Stripe Customer Portal settings match LetsRevise Pro product/price |
| `past_due` / failed payment recovery | Test user can reach billing management and recover payment when entitlement may be false |
| Canceled resubscription | Test canceled subscriber can manage/resubscribe via portal; webhooks restore entitlement correctly |
| Price ID | Confirm live `STRIPE_PRICE_ID_LETSREVISE_PRO` is **£4.99/month** |
| Duplicate subscriptions | Enable Stripe **“Limit customers to one subscription”** |
| Webhook | Confirm live `STRIPE_WEBHOOK_SECRET` and endpoint URL |
