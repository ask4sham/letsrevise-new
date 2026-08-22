const { LETSREVISE_PRO_PLAN_ID } = require("../config/stripe");

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isUnixSeconds(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Resolve subscription period end from legacy top-level or item-level Stripe shapes.
 *
 * @param {import("stripe").Stripe.Subscription} subscription
 * @returns {number|null}
 */
function resolveSubscriptionCurrentPeriodEndUnix(subscription) {
  if (isUnixSeconds(subscription.current_period_end)) {
    return subscription.current_period_end;
  }

  const itemPeriodEnd = subscription.items?.data?.[0]?.current_period_end;
  if (isUnixSeconds(itemPeriodEnd)) {
    return itemPeriodEnd;
  }

  return null;
}

/**
 * Resolve scheduled end-of-period cancellation from legacy or B6 Stripe shapes.
 *
 * @param {import("stripe").Stripe.Subscription} subscription
 * @param {number|null} resolvedPeriodEndUnix
 * @returns {boolean}
 */
function resolveSubscriptionCancelAtPeriodEnd(subscription, resolvedPeriodEndUnix) {
  if (subscription.cancel_at_period_end === true) {
    return true;
  }

  if (
    isUnixSeconds(subscription.cancel_at) &&
    isUnixSeconds(resolvedPeriodEndUnix) &&
    subscription.cancel_at === resolvedPeriodEndUnix
  ) {
    return true;
  }

  return false;
}

/**
 * Stripe invoice timestamp for billing history (deterministic; never Date.now()).
 *
 * @param {import("stripe").Stripe.Invoice} invoice
 * @returns {Date|null}
 */
function resolveInvoicePaidAt(invoice) {
  const paidAtUnix = invoice.status_transitions?.paid_at ?? invoice.created ?? null;
  if (paidAtUnix == null) return null;
  return new Date(paidAtUnix * 1000);
}

/**
 * $max fields for invoice.paid — persisted atomically; never via user.save().
 *
 * @param {import("stripe").Stripe.Invoice} invoice
 * @returns {Record<string, Date>|null}
 */
function buildInvoicePaymentMaxFields(invoice) {
  const line = invoice.lines?.data?.[0];
  const periodEnd = line?.period?.end;
  if (!periodEnd) return null;

  /** @type {Record<string, Date>} */
  const maxFields = {
    "stripeBilling.paidThrough": new Date(periodEnd * 1000),
  };

  const lastInvoicePaidAt = resolveInvoicePaidAt(invoice);
  if (lastInvoicePaidAt) {
    maxFields["stripeBilling.lastInvoicePaidAt"] = lastInvoicePaidAt;
  }

  return maxFields;
}

/**
 * $set fields for subscription snapshot (invoice.paid + lifecycle handlers).
 *
 * @param {import("stripe").Stripe.Subscription} subscription
 * @param {Record<string, unknown>} [existingBilling]
 * @returns {Record<string, unknown>}
 */
function buildSubscriptionSnapshotSetFields(subscription, existingBilling = {}) {
  const priceId =
    subscription.items?.data?.[0]?.price?.id ??
    existingBilling.priceId ??
    null;
  const planId =
    subscription.metadata?.planId ??
    existingBilling.planId ??
    LETSREVISE_PRO_PLAN_ID;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? existingBilling.customerId ?? null;

  const periodEndUnix = resolveSubscriptionCurrentPeriodEndUnix(subscription);
  const cancelAtPeriodEnd = resolveSubscriptionCancelAtPeriodEnd(
    subscription,
    periodEndUnix
  );

  return {
    "stripeBilling.customerId": customerId,
    "stripeBilling.subscriptionId": subscription.id,
    "stripeBilling.priceId": priceId,
    "stripeBilling.planId": planId,
    "stripeBilling.status": subscription.status,
    "stripeBilling.currentPeriodEnd": periodEndUnix
      ? new Date(periodEndUnix * 1000)
      : null,
    "stripeBilling.cancelAtPeriodEnd": cancelAtPeriodEnd,
  };
}

/**
 * Apply Stripe Subscription snapshot to user.stripeBilling only (in-memory; lifecycle paths).
 * Never writes subscriptionV2 or paidThrough.
 *
 * @param {import("mongoose").Document} user
 * @param {import("stripe").Stripe.Subscription} subscription
 * @param {{ priceId?: string|null, planId?: string|null }} opts
 */
function applySubscriptionSnapshotToUser(user, subscription, opts = {}) {
  if (!user.stripeBilling || typeof user.stripeBilling !== "object") {
    user.stripeBilling = {};
  }

  const setFields = buildSubscriptionSnapshotSetFields(subscription, {
    ...user.stripeBilling,
    priceId:
      opts.priceId ??
      subscription.items?.data?.[0]?.price?.id ??
      user.stripeBilling.priceId ??
      null,
    planId:
      opts.planId ??
      subscription.metadata?.planId ??
      user.stripeBilling.planId ??
      LETSREVISE_PRO_PLAN_ID,
  });

  for (const [key, value] of Object.entries(setFields)) {
    const field = key.replace(/^stripeBilling\./, "");
    user.stripeBilling[field] = value;
  }

  user.markModified("stripeBilling");
}

module.exports = {
  resolveInvoicePaidAt,
  buildInvoicePaymentMaxFields,
  buildSubscriptionSnapshotSetFields,
  applySubscriptionSnapshotToUser,
};
