const {
  LETSREVISE_PRO_PLAN_ID,
  assertLetsReviseProPriceForCheckout,
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
 * Find an existing open LetsRevise Pro Checkout Session for this Stripe Customer (B4).
 * Prevents duplicate hosted Checkout tabs before the first payment/webhook completes.
 *
 * @param {{ customerId: string, userId: import("mongoose").Types.ObjectId|string }} opts
 * @returns {Promise<import("stripe").Stripe.Checkout.Session|null>}
 */
async function findOpenLetsReviseProCheckoutSession({ customerId, userId }) {
  if (!customerId || userId == null) return null;

  const expectedUserId = String(userId);
  const stripe = getStripeClient();
  const sessions = await stripe.checkout.sessions.list({
    customer: customerId,
    status: "open",
    limit: 10,
  });

  for (const session of sessions.data) {
    if (
      session.mode === "subscription" &&
      session.metadata?.planId === LETSREVISE_PRO_PLAN_ID &&
      session.metadata?.letsReviseUserId === expectedUserId &&
      session.url
    ) {
      return session;
    }
  }

  return null;
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
    success_url: `${frontendUrl}/#/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/#/subscription/cancel`,
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
  await assertLetsReviseProPriceForCheckout();
  const customerId = await ensureStripeCustomerBound(user);
  const existingOpenSession = await findOpenLetsReviseProCheckoutSession({
    customerId,
    userId: user._id,
  });
  if (existingOpenSession) {
    return existingOpenSession;
  }
  return createLetsReviseProCheckoutSession({ user, customerId });
}

module.exports = {
  buildStripeCheckoutMetadata,
  ensureStripeCustomerBound,
  findOpenLetsReviseProCheckoutSession,
  createLetsReviseProCheckoutSession,
  createLetsReviseProCheckoutForUser,
};
