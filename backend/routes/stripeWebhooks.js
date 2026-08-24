const {
  constructStripeWebhookEvent,
  isStripeLiveModeEnabled,
  isStripeWebhookConfigured,
} = require("../config/stripe");
const { handleStripeWebhookEvent } = require("../services/stripeWebhookService");

/**
 * POST /api/webhooks/stripe
 * Requires express.raw({ type: 'application/json' }) — mounted before global JSON parser.
 */
async function stripeWebhookHandler(req, res) {
  if (!isStripeWebhookConfigured()) {
    return res.status(503).json({
      success: false,
      code: "STRIPE_WEBHOOK_NOT_CONFIGURED",
      msg: "Stripe webhook secret is not configured",
    });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    return res.status(400).json({ success: false, msg: "Missing Stripe-Signature header" });
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) {
    return res.status(400).json({ success: false, msg: "Webhook requires raw request body" });
  }

  let event;
  try {
    event = constructStripeWebhookEvent(rawBody, signature);
  } catch (err) {
    return res.status(400).json({ success: false, msg: `Webhook signature verification failed: ${err.message}` });
  }

  const liveModeEnabled = isStripeLiveModeEnabled();
  if (event.livemode !== liveModeEnabled) {
    if (event.livemode === true) {
      return res.status(403).json({
        success: false,
        code: "STRIPE_LIVE_EVENT_BLOCKED",
        msg: "Live Stripe webhook events are not permitted until explicit go-live",
      });
    }
    return res.status(403).json({
      success: false,
      code: "STRIPE_TEST_EVENT_BLOCKED",
      msg: "Test Stripe webhook events are not permitted when live mode is enabled",
    });
  }

  try {
    const result = await handleStripeWebhookEvent(event);
    return res.json({ received: true, duplicate: result.duplicate === true });
  } catch (err) {
    console.error("[stripeWebhook]", event.type, event.id, err);
    return res.status(500).json({ success: false, msg: "Webhook handler failed" });
  }
}

module.exports = stripeWebhookHandler;
