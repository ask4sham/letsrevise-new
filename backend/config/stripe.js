/**
 * Stripe billing configuration (B2 — Checkout foundation).
 * Price ID and plan identity are server-owned; clients must not supply them.
 *
 * Env documentation: backend/docs/STRIPE_BILLING_ENV.md
 */

const BIOLOGY_PRO_PLAN_ID = "biology_pro";

let stripeClient = null;

function getStripeConfig() {
  return {
    secretKey: (process.env.STRIPE_SECRET_KEY || "").trim(),
    priceIdBiologyPro: (process.env.STRIPE_PRICE_ID_BIOLOGY_PRO || "").trim(),
    planIdBiologyPro: BIOLOGY_PRO_PLAN_ID,
    frontendUrl: (process.env.FRONTEND_URL || "http://localhost:3000").trim().replace(/\/+$/, ""),
  };
}

function assertProductionKeyBlocked(secretKey) {
  if (secretKey.startsWith("sk_live_")) {
    throw new Error("Production Stripe keys (sk_live_*) are not permitted until explicit go-live");
  }
}

function isStripeCheckoutConfigured() {
  const { secretKey, priceIdBiologyPro } = getStripeConfig();
  return Boolean(secretKey && priceIdBiologyPro);
}

function getStripeClient() {
  const { secretKey } = getStripeConfig();
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  assertProductionKeyBlocked(secretKey);
  if (!stripeClient) {
    // eslint-disable-next-line global-require
    const Stripe = require("stripe");
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

/** Test helper — reset cached client between mocked test runs. */
function resetStripeClientForTests() {
  stripeClient = null;
}

module.exports = {
  BIOLOGY_PRO_PLAN_ID,
  getStripeConfig,
  getStripeClient,
  isStripeCheckoutConfigured,
  resetStripeClientForTests,
};
