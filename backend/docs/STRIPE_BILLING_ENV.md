# Stripe billing environment variables

Documentation for LetsRevise Stripe billing (B2 Checkout foundation, B3 webhooks, production go-live gate).

**LetsRevise Pro** — one universal premium subscription covering all premium subjects (current and future). Catalogue/publishing controls what content is available; Stripe controls paid entitlement.

## TEST MODE (default)

Active when `STRIPE_LIVE_MODE_ENABLED` is **unset** or **anything other than exact `1`**.

| Variable | Example | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` | Stripe API secret key (test mode) |
| `STRIPE_PRICE_ID_LETSREVISE_PRO` | `price_...` | Server-owned recurring Price for LetsRevise Pro |
| `FRONTEND_URL` | `http://localhost:3000` | Base URL for server-controlled Checkout success/cancel redirects (HashRouter: `/#/subscription/success`, `/#/subscription/cancel`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Signing secret for `POST /api/webhooks/stripe` signature verification |

### TEST mode rules

- `sk_test_*` keys **allowed**
- `sk_live_*` keys **rejected** (fail-closed)
- Webhook events with `livemode: false` **accepted**
- Webhook events with `livemode: true` **rejected** (`403 STRIPE_LIVE_EVENT_BLOCKED`)
- Checkout-time price validation requires `price.livemode === false` and `price.active === true` (flexible test amount/currency)

## LIVE MODE

Active **only** when:

```text
STRIPE_LIVE_MODE_ENABLED=1
```

Exact string `1` only. Values such as `true`, `yes`, `on`, or `2` do **not** enable live mode.

| Variable | Purpose |
|---|---|
| `STRIPE_LIVE_MODE_ENABLED` | Must be exact `1` to permit live Stripe |
| `STRIPE_SECRET_KEY` | Must be `sk_live_*` |
| `STRIPE_PRICE_ID_LETSREVISE_PRO` | Must be live-mode Price (£4.99/month — validated at Checkout) |
| `STRIPE_WEBHOOK_SECRET` | Live webhook endpoint signing secret |
| `FRONTEND_URL` | Production frontend base URL (e.g. `https://letsrevise.com`) |

### LIVE mode rules

- `sk_live_*` keys **allowed**
- `sk_test_*` keys **rejected** (fail-closed)
- Webhook events with `livemode: true` **accepted**
- Webhook events with `livemode: false` **rejected** (`403 STRIPE_TEST_EVENT_BLOCKED`)
- Checkout-time price validation requires live price: `currency=gbp`, `unit_amount=499`, `recurring.interval=month`, `active=true`

## Production go-live (atomic swap)

**Do not preload live credentials while the flag is off.**

Apply together in one controlled Render configuration change:

1. `STRIPE_LIVE_MODE_ENABLED=1`
2. Live `STRIPE_SECRET_KEY`
3. Live `STRIPE_PRICE_ID_LETSREVISE_PRO`
4. Live `STRIPE_WEBHOOK_SECRET`
5. Production `FRONTEND_URL` and `CORS_ORIGIN`

Then restart. Startup validates **local config only** (no Stripe API calls). Remote price validation runs immediately before Checkout Session creation.

## Kill switch

Set `STRIPE_LIVE_MODE_ENABLED` to anything other than `1` (or remove it) and restart:

- Checkout / Portal: fail-closed (`503 STRIPE_BILLING_DISABLED` when live key remains configured)
- Live webhooks: signature verified, then rejected with `403 STRIPE_LIVE_EVENT_BLOCKED` (no Mongo mutation, no webhook receipt)
- Existing entitlements from prior paid invoices remain until natural expiry

## Startup validation (local only)

When Stripe billing env is partially configured, startup validates **without network calls**:

- Strict live-flag parsing
- Secret key prefix matches configured mode
- Required env presence (price ID for Checkout, webhook secret for webhooks, explicit `FRONTEND_URL` for Checkout)

General LetsRevise availability does **not** depend on Stripe API reachability at boot.

## Checkout-time price validation (LIVE)

Before any Checkout Session is created (including open-session reuse), the server retrieves the configured Price and enforces £4.99/month for live mode. Failures return controlled `503` billing errors; no charge, no entitlement mutation.

## Webhook URL (production)

Preferred canonical URL once DNS is verified:

```text
https://api.letsrevise.com/api/webhooks/stripe
```

Verify the custom domain resolves and returns API responses (not Cloudflare/DNS errors) before registering in Stripe Live Dashboard. Interim fallback: direct Render backend URL.

## Security notes

- Clients must **not** supply `priceId`, `price`, `line_items`, `amount`, `currency`, `planId`, `userId`, or `letsReviseUserId` on Checkout creation.
- Checkout metadata uses **`letsReviseUserId`** (not client-supplied) plus server-owned **`planId: letsrevise_pro`**.
- Webhook signature verification uses `STRIPE_WEBHOOK_SECRET` only and is separate from billing-client key-mode gating.
- Never log secret env values.

## B6 launch verification (pre go-live)

| Check | Action |
|---|---|
| Price ID | Confirm live `STRIPE_PRICE_ID_LETSREVISE_PRO` is **£4.99/month** recurring Price for LetsRevise Pro |
| Duplicate subscriptions | Enable Stripe **“Limit customers to one subscription”** on the Checkout / Product settings |
| Webhook | Confirm live `STRIPE_WEBHOOK_SECRET` and verified endpoint URL |
| Customer Portal | Verify live Portal configuration and return URL `${FRONTEND_URL}/#/subscription` |

## Code references

- Config: `backend/config/stripe.js`
- Checkout service: `backend/services/stripeCheckoutService.js`
- Portal service: `backend/services/stripePortalService.js`
- Webhook service: `backend/services/stripeWebhookService.js`
- Route (Checkout): `POST /api/subscriptions/create-checkout-session`
- Route (Portal): `POST /api/subscriptions/create-portal-session`
- Route (webhook): `POST /api/webhooks/stripe` (raw body; mounted before JSON parser in `app.js`)

## B5 Customer Portal

| Requirement | Notes |
|---|---|
| Stripe Dashboard | Enable **Customer Portal** and configure allowed subscription management actions |
| Return URL | Server-owned `${FRONTEND_URL}/#/subscription` (HashRouter) |
| Security | Client must not supply `customerId`, `return_url`, or portal `configuration` |
| Price validation | Not required at Portal creation; inherits secret-key mode protection |
