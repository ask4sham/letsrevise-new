const {
  LETSREVISE_PRO_PLAN_ID,
  getStripeClient,
  getStripeConfig,
} = require("../config/stripe");

/**
 * Server-derived metadata for event-order-safe webhook reconciliation (B1/B3).
 * Duplicated on Checkout Session and Subscription so any lifecycle event can resolve the student.
 *
 * @param {import("mongoose").Types.ObjectId|string} userId
 * @returns {{ letsReviseUserId: string, planId: string }}
 */
function buildStripeCheckoutMetadata(userId) {
  return {
    letsReviseUserId: String(userId),
    planId: LETSREVISE_PRO_PLAN_ID,
  };
}

/**
 * Ensure a Stripe Customer exists and persist stripeBilling.customerId only (B2).
 * Does not set subscription, status, paidThrough, or other entitlement fields.
 *
 * @param {import("mongoose").Document} user - Mongoose user document (mutated + saved when new)
 * @returns {Promise<string>} Stripe customer id
 */
async function ensureStripeCustomerBound(user) {
  const existing = user.stripeBilling?.customerId;
  if (existing) {
    return existing;
  }

  const stripe = getStripeClient();
  const metadata = buildStripeCheckoutMetadata(user._id);

  /** @type {import("stripe").Stripe.CustomerCreateParams} */
  const customerParams = {
    metadata: { ...metadata },
  };
  if (user.email) {
    customerParams.email = user.email;
  }

  const customer = await stripe.customers.create(customerParams);

  if (!user.stripeBilling || typeof user.stripeBilling !== "object") {
    user.stripeBilling = {};
  }
  user.stripeBilling.customerId = customer.id;
  user.markModified("stripeBilling");
  await user.save();

  return customer.id;
}

/**
 * @param {{ user: { _id: unknown }, customerId: string }} opts
 * @returns {Promise<import("stripe").Stripe.Checkout.Session>}
 */
async function createLetsReviseProCheckoutSession({ user, customerId }) {
  const stripe = getStripeClient();
  const { priceIdLetsRevisePro, frontendUrl } = getStripeConfig();
  if (!priceIdLetsRevisePro) {
    throw new Error("STRIPE_PRICE_ID_LETSREVISE_PRO is not configured");
  }
  if (!customerId) {
    throw new Error("Stripe customerId is required for Checkout");
  }

  const metadata = buildStripeCheckoutMetadata(user._id);
  const userId = String(user._id);

  /** @type {import("stripe").Stripe.Checkout.SessionCreateParams} */
  const sessionParams = {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceIdLetsRevisePro, quantity: 1 }],
    success_url: `${frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/subscription/cancel`,
    client_reference_id: userId,
    metadata,
    subscription_data: {
      metadata: { ...metadata },
    },
  };

  return stripe.checkout.sessions.create(sessionParams);
}

/**
 * Bind Stripe customer (if needed) and create LetsRevise Pro Checkout Session.
 *
 * @param {import("mongoose").Document} user
 * @returns {Promise<import("stripe").Stripe.Checkout.Session>}
 */
async function createLetsReviseProCheckoutForUser(user) {
  const customerId = await ensureStripeCustomerBound(user);
  return createLetsReviseProCheckoutSession({ user, customerId });
}

module.exports = {
  buildStripeCheckoutMetadata,
  ensureStripeCustomerBound,
  createLetsReviseProCheckoutSession,
  createLetsReviseProCheckoutForUser,
};
