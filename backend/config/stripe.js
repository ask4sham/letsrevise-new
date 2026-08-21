/**
 * Stripe billing configuration (B2 Checkout + B3 webhooks).
 * LetsRevise Pro — one universal premium subscription (all subjects).
 *
 * Env documentation: backend/docs/STRIPE_BILLING_ENV.md
 */

const LETSREVISE_PRO_PLAN_ID = "letsrevise_pro";

let stripeClient = null;

function getStripeConfig() {
  return {
    secretKey: (process.env.STRIPE_SECRET_KEY || "").trim(),
    priceIdLetsRevisePro: (process.env.STRIPE_PRICE_ID_LETSREVISE_PRO || "").trim(),
    webhookSecret: (process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
    planIdLetsRevisePro: LETSREVISE_PRO_PLAN_ID,
    frontendUrl: (process.env.FRONTEND_URL || "http://localhost:3000").trim().replace(/\/+$/, ""),
  };
}

function assertProductionKeyBlocked(secretKey) {
  if (secretKey.startsWith("sk_live_")) {
    throw new Error("Production Stripe keys (sk_live_*) are not permitted until explicit go-live");
  }
}

function isStripeCheckoutConfigured() {
  const { secretKey, priceIdLetsRevisePro } = getStripeConfig();
  return Boolean(secretKey && priceIdLetsRevisePro);
}

function isStripeWebhookConfigured() {
  const { secretKey, webhookSecret } = getStripeConfig();
  return Boolean(secretKey && webhookSecret);
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
  LETSREVISE_PRO_PLAN_ID,
  getStripeConfig,
  getStripeClient,
  isStripeCheckoutConfigured,
  isStripeWebhookConfigured,
  resetStripeClientForTests,
};
