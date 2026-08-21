const { getStripeClient, getStripeConfig } = require("../config/stripe");

/**
 * Create a hosted Stripe Customer Portal session (B5).
 * Uses server-bound Stripe Customer only — client must not supply customer or return URL.
 *
 * @param {string} customerId - Persisted stripeBilling.customerId for authenticated user
 * @returns {Promise<import("stripe").Stripe.BillingPortal.Session>}
 */
async function createLetsReviseProPortalSession(customerId) {
  if (!customerId) {
    throw new Error("Stripe customerId is required for Customer Portal");
  }

  const stripe = getStripeClient();
  const { frontendUrl } = getStripeConfig();

  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${frontendUrl}/#/subscription`,
  });
}

module.exports = {
  createLetsReviseProPortalSession,
};
