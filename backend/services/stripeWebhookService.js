const mongoose = require("mongoose");
const User = require("../models/User");
const StripeWebhookEvent = require("../models/StripeWebhookEvent");
const { getStripeClient, LETSREVISE_PRO_PLAN_ID, getStripeConfig } = require("../config/stripe");
const {
  applySubscriptionSnapshotToUser,
  buildInvoicePaymentMaxFields,
  buildSubscriptionSnapshotSetFields,
} = require("./stripeBillingSync");

/**
 * @param {Record<string, string>|null|undefined} metadata
 * @returns {string|null}
 */
function extractLetsReviseUserId(metadata) {
  const raw = metadata?.letsReviseUserId;
  return raw != null && String(raw).trim() ? String(raw).trim() : null;
}

/**
 * Resolve LetsRevise student from webhook context (event-order safe).
 *
 * @param {{ metadata?: Record<string, string>|null, customerId?: string|null, subscriptionId?: string|null, clientReferenceId?: string|null }} ctx
 * @returns {Promise<import("mongoose").Document|null>}
 */
async function resolveUserFromStripeContext(ctx) {
  const fromMetadata = extractLetsReviseUserId(ctx.metadata);
  const candidateId = fromMetadata || ctx.clientReferenceId || null;

  if (candidateId && mongoose.Types.ObjectId.isValid(candidateId)) {
    const byId = await User.findById(candidateId);
    if (byId) return byId;
  }

  if (ctx.customerId) {
    const byCustomer = await User.findOne({ "stripeBilling.customerId": ctx.customerId });
    if (byCustomer) return byCustomer;
  }

  if (ctx.subscriptionId) {
    const bySub = await User.findOne({ "stripeBilling.subscriptionId": ctx.subscriptionId });
    if (bySub) return bySub;
  }

  return null;
}

/**
 * @param {import("stripe").Stripe.Event} event
 * @returns {Promise<{ claimed: boolean, duplicate?: boolean, record?: import("mongoose").Document, retry?: boolean }>}
 */
async function claimWebhookEvent(event) {
  try {
    const record = await StripeWebhookEvent.create({
      eventId: event.id,
      type: event.type,
      status: "processing",
    });
    return { claimed: true, record };
  } catch (err) {
    if (err?.code !== 11000) throw err;

    const existing = await StripeWebhookEvent.findOne({ eventId: event.id });
    if (!existing) throw err;

    if (existing.status === "processed") {
      return { claimed: false, duplicate: true, record: existing };
    }

    if (existing.status === "failed") {
      existing.status = "processing";
      existing.errorMessage = null;
      await existing.save();
      return { claimed: true, record: existing, retry: true };
    }

    return { claimed: false, duplicate: true, record: existing };
  }
}

/**
 * @param {import("mongoose").Document} record
 * @param {Error|null} [error]
 */
async function finalizeWebhookEvent(record, error = null) {
  if (error) {
    record.status = "failed";
    record.errorMessage = error.message;
  } else {
    record.status = "processed";
    record.processedAt = new Date();
    record.errorMessage = null;
  }
  await record.save();
}

/**
 * Retrieve authoritative Subscription state from Stripe (out-of-order safe).
 *
 * @param {string} subscriptionId
 * @returns {Promise<import("stripe").Stripe.Subscription>}
 */
async function retrieveSubscription(subscriptionId) {
  const stripe = getStripeClient();
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Resolve subscription id from Invoice webhook payloads.
 * Supports legacy invoice.subscription and newer parent.subscription_details.subscription.
 *
 * @param {import("stripe").Stripe.Invoice} invoice
 * @returns {string|null}
 */
function resolveInvoiceSubscriptionId(invoice) {
  const topLevel =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id ?? null;
  if (topLevel) return topLevel;

  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (typeof parentSub === "string" && parentSub.trim()) return parentSub.trim();
  if (parentSub && typeof parentSub === "object" && parentSub.id) {
    return String(parentSub.id);
  }

  return null;
}

/**
 * @param {import("stripe").Stripe.Checkout.Session} session
 */
async function handleCheckoutSessionCompleted(session) {
  const user = await resolveUserFromStripeContext({
    metadata: session.metadata,
    customerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
    subscriptionId:
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
    clientReferenceId: session.client_reference_id,
  });

  if (!user) {
    throw new Error(`Unable to resolve LetsRevise user for checkout session ${session.id}`);
  }

  if (!user.stripeBilling || typeof user.stripeBilling !== "object") {
    user.stripeBilling = {};
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  if (customerId) user.stripeBilling.customerId = customerId;
  if (subscriptionId) user.stripeBilling.subscriptionId = subscriptionId;

  const planId = session.metadata?.planId || LETSREVISE_PRO_PLAN_ID;
  user.stripeBilling.planId = planId;

  const { priceIdLetsRevisePro } = getStripeConfig();
  if (priceIdLetsRevisePro) user.stripeBilling.priceId = priceIdLetsRevisePro;

  user.markModified("stripeBilling");
  await user.save();
}

/**
 * Sync lifecycle fields from current Stripe Subscription; never writes subscriptionV2.
 *
 * @param {import("stripe").Stripe.Subscription} subscription
 */
async function handleSubscriptionLifecycle(subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  const user = await resolveUserFromStripeContext({
    metadata: subscription.metadata,
    customerId,
    subscriptionId: subscription.id,
  });

  if (!user) {
    throw new Error(`Unable to resolve LetsRevise user for subscription ${subscription.id}`);
  }

  applySubscriptionSnapshotToUser(user, subscription);
  await user.save();
}

/**
 * @param {import("stripe").Stripe.Invoice} invoice
 */
async function handleInvoicePaid(invoice) {
  const subscriptionId = resolveInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const subscription = await retrieveSubscription(subscriptionId);
  if (subscription.status !== "active") {
    return;
  }

  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;

  const user = await resolveUserFromStripeContext({
    metadata: {
      ...(subscription.metadata || {}),
      ...(invoice.metadata || {}),
    },
    customerId,
    subscriptionId,
  });

  if (!user) {
    throw new Error(`Unable to resolve LetsRevise user for invoice ${invoice.id}`);
  }

  /** @type {import("mongoose").UpdateQuery<unknown>} */
  const update = {
    $set: buildSubscriptionSnapshotSetFields(subscription, user.stripeBilling || {}),
  };

  const maxFields = buildInvoicePaymentMaxFields(invoice);
  if (maxFields) {
    update.$max = maxFields;
  }

  await User.updateOne({ _id: user._id }, update);
}

/**
 * @param {import("stripe").Stripe.Invoice} invoice
 */
async function handleInvoicePaymentFailed(invoice) {
  const subscriptionId = resolveInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const subscription = await retrieveSubscription(subscriptionId);
  await handleSubscriptionLifecycle(subscription);
}

/**
 * @param {import("stripe").Stripe.Event} event
 */
async function processStripeWebhookEvent(event) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(/** @type {import("stripe").Stripe.Checkout.Session} */ (event.data.object));
      break;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionLifecycle(
        /** @type {import("stripe").Stripe.Subscription} */ (event.data.object)
      );
      break;
    case "invoice.paid": {
      const invoice = /** @type {import("stripe").Stripe.Invoice} */ (event.data.object);
      await handleInvoicePaid(invoice);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = /** @type {import("stripe").Stripe.Invoice} */ (event.data.object);
      await handleInvoicePaymentFailed(invoice);
      break;
    }
    default:
      break;
  }
}

/**
 * @param {import("stripe").Stripe.Event} event
 * @returns {Promise<{ duplicate: boolean }>}
 */
async function handleStripeWebhookEvent(event) {
  const claim = await claimWebhookEvent(event);
  if (!claim.claimed) {
    return { duplicate: true };
  }

  try {
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const stub = /** @type {import("stripe").Stripe.Subscription} */ (event.data.object);
      const subscription = await retrieveSubscription(stub.id);
      event = { ...event, data: { ...event.data, object: subscription } };
    }

    await processStripeWebhookEvent(event);
    await finalizeWebhookEvent(claim.record, null);
    return { duplicate: false };
  } catch (err) {
    await finalizeWebhookEvent(claim.record, err);
    throw err;
  }
}

module.exports = {
  extractLetsReviseUserId,
  resolveUserFromStripeContext,
  claimWebhookEvent,
  handleStripeWebhookEvent,
  handleCheckoutSessionCompleted,
  handleInvoicePaid,
  handleSubscriptionLifecycle,
};
