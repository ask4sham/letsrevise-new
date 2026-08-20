# Stripe billing environment variables

Documentation for LetsRevise Stripe billing (B2 Checkout foundation, B3 webhooks).

**B2 test mode only** until explicit production go-live. Use `sk_test_*` keys only.

## Required for B2 (Checkout)

| Variable | Example | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` | Stripe API secret key (test mode) |
| `STRIPE_PRICE_ID_BIOLOGY_PRO` | `price_...` | Server-owned recurring Price for Biology Pro £4.99/month |
| `FRONTEND_URL` | `http://localhost:3000` | Base URL for server-controlled Checkout success/cancel redirects |

## Required for B3 (webhooks — not used in B2)

| Variable | Example | Purpose |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Signing secret for `POST /api/webhooks/stripe` signature verification |

## Security notes

- Clients must **not** supply `priceId`, `price`, `line_items`, `amount`, `currency`, `planId`, `userId`, or `letsReviseUserId` on Checkout creation.
- Checkout metadata uses **`letsReviseUserId`** (not client-supplied) plus server-owned **`planId: biology_pro`**.
- Production keys (`sk_live_*`) are blocked until explicit go-live approval.

## Code references

- Config: `backend/config/stripe.js`
- Checkout service: `backend/services/stripeCheckoutService.js`
- Route: `POST /api/subscriptions/create-checkout-session`
