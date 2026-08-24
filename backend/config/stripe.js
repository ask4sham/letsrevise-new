/**
 * Stripe billing configuration (B2 Checkout + B3 webhooks).
 * LetsRevise Pro — one universal premium subscription (all subjects).
 *
 * Env documentation: backend/docs/STRIPE_BILLING_ENV.md
 */

const LETSREVISE_PRO_PLAN_ID = "letsrevise_pro";

const LIVE_PRO_PRICE = {
  currency: "gbp",
  unitAmount: 499,
  interval: "month",
};

let stripeClient = null;

class StripeBillingError extends Error {
  /**
   * @param {string} code
   * @param {string} userMessage
   */
  constructor(code, userMessage) {
    super(userMessage);
    this.name = "StripeBillingError";
    this.code = code;
    this.userMessage = userMessage;
    this.statusCode = 503;
  }
}

function isStripeLiveModeEnabled() {
  return process.env.STRIPE_LIVE_MODE_ENABLED === "1";
}

function getStripeConfig() {
  return {
    secretKey: (process.env.STRIPE_SECRET_KEY || "").trim(),
    priceIdLetsRevisePro: (process.env.STRIPE_PRICE_ID_LETSREVISE_PRO || "").trim(),
    webhookSecret: (process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
    planIdLetsRevisePro: LETSREVISE_PRO_PLAN_ID,
    frontendUrl: (process.env.FRONTEND_URL || "http://localhost:3000").trim().replace(/\/+$/, ""),
  };
}

/**
 * Symmetric TEST/LIVE secret-key guard (fail-closed).
 *
 * @param {string} secretKey
 */
function assertStripeSecretKeyModeAllowed(secretKey) {
  const liveMode = isStripeLiveModeEnabled();
  const isLiveKey = secretKey.startsWith("sk_live_");
  const isTestKey = secretKey.startsWith("sk_test_");

  if (liveMode) {
    if (isTestKey) {
      throw new StripeBillingError(
        "STRIPE_BILLING_DISABLED",
        "Billing is temporarily unavailable."
      );
    }
    if (!isLiveKey) {
      throw new StripeBillingError(
        "STRIPE_BILLING_DISABLED",
        "Billing is temporarily unavailable."
      );
    }
    return;
  }

  if (isLiveKey || !isTestKey) {
    throw new StripeBillingError(
      "STRIPE_BILLING_DISABLED",
      "Billing is temporarily unavailable."
    );
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

function isStripeBillingPartiallyConfigured() {
  const { secretKey, priceIdLetsRevisePro, webhookSecret } = getStripeConfig();
  return Boolean(secretKey && (priceIdLetsRevisePro || webhookSecret));
}

function getStripeClient() {
  const { secretKey } = getStripeConfig();
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  assertStripeSecretKeyModeAllowed(secretKey);
  if (!stripeClient) {
    // eslint-disable-next-line global-require
    const Stripe = require("stripe");
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

/**
 * Verify Stripe webhook signature using webhook secret only (no billing key-mode gate).
 *
 * @param {Buffer} rawBody
 * @param {string} signature
 * @returns {import("stripe").Stripe.Event}
 */
function constructStripeWebhookEvent(rawBody, signature) {
  const { webhookSecret } = getStripeConfig();
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  // eslint-disable-next-line global-require
  const Stripe = require("stripe");
  return Stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

/**
 * Local-only billing config validation at startup (no Stripe API calls).
 */
function validateStripeBillingConfigAtStartup() {
  if (!isStripeBillingPartiallyConfigured()) {
    return;
  }

  const { secretKey, priceIdLetsRevisePro, webhookSecret } = getStripeConfig();

  assertStripeSecretKeyModeAllowed(secretKey);

  if (secretKey && priceIdLetsRevisePro) {
    const rawFrontendUrl = (process.env.FRONTEND_URL || "").trim();
    if (!rawFrontendUrl) {
      throw new Error("FRONTEND_URL is required when Stripe Checkout is configured");
    }
  }

  if (secretKey && webhookSecret && !priceIdLetsRevisePro) {
    // Webhook-only partial config is allowed; key mode already validated above.
  }
}

/**
 * @param {import("stripe").Stripe.Price} price
 */
function validateRetrievedPriceForMode(price) {
  const liveMode = isStripeLiveModeEnabled();

  if (price.livemode !== liveMode) {
    throw new StripeBillingError(
      "STRIPE_PRICE_MODE_MISMATCH",
      "Billing is temporarily unavailable. Please contact support if this continues."
    );
  }

  if (!price.active) {
    throw new StripeBillingError(
      "STRIPE_PRICE_INACTIVE",
      "Billing is temporarily unavailable. Please try again later."
    );
  }

  if (liveMode) {
    if (price.currency !== LIVE_PRO_PRICE.currency) {
      throw new StripeBillingError(
        "STRIPE_PRICE_VALIDATION_FAILED",
        "Billing is temporarily unavailable. Please contact support if this continues."
      );
    }
    if (price.unit_amount !== LIVE_PRO_PRICE.unitAmount) {
      throw new StripeBillingError(
        "STRIPE_PRICE_VALIDATION_FAILED",
        "Billing is temporarily unavailable. Please contact support if this continues."
      );
    }
    if (price.recurring?.interval !== LIVE_PRO_PRICE.interval) {
      throw new StripeBillingError(
        "STRIPE_PRICE_VALIDATION_FAILED",
        "Billing is temporarily unavailable. Please contact support if this continues."
      );
    }
  }
}

/**
 * Remote price safety validation immediately before Checkout (includes open-session reuse path).
 */
async function assertLetsReviseProPriceForCheckout() {
  const { priceIdLetsRevisePro } = getStripeConfig();
  if (!priceIdLetsRevisePro) {
    throw new StripeBillingError(
      "STRIPE_PRICE_MISCONFIGURED",
      "Billing is temporarily unavailable. Please contact support if this continues."
    );
  }

  const stripe = getStripeClient();
  let price;
  try {
    price = await stripe.prices.retrieve(priceIdLetsRevisePro);
  } catch (err) {
    if (err?.statusCode === 404 || err?.code === "resource_missing") {
      throw new StripeBillingError(
        "STRIPE_PRICE_MISCONFIGURED",
        "Billing is temporarily unavailable. Please contact support if this continues."
      );
    }
    throw new StripeBillingError(
      "BILLING_TEMPORARILY_UNAVAILABLE",
      "Billing is temporarily unavailable. Please try again shortly."
    );
  }

  validateRetrievedPriceForMode(price);
}

/** Test helper — reset cached client between mocked test runs. */
function resetStripeClientForTests() {
  stripeClient = null;
}

module.exports = {
  LETSREVISE_PRO_PLAN_ID,
  LIVE_PRO_PRICE,
  StripeBillingError,
  isStripeLiveModeEnabled,
  getStripeConfig,
  getStripeClient,
  constructStripeWebhookEvent,
  validateStripeBillingConfigAtStartup,
  assertLetsReviseProPriceForCheckout,
  validateRetrievedPriceForMode,
  assertStripeSecretKeyModeAllowed,
  isStripeCheckoutConfigured,
  isStripeWebhookConfigured,
  isStripeBillingPartiallyConfigured,
  resetStripeClientForTests,
};
