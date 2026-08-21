/**
 * LetsRevise Pro Stripe access (universal premium — all subjects).
 * paidThrough is payment proof; status gates whether Stripe entitlement is live.
 *
 * ALLOW: active (incl. cancelAtPeriodEnd while still active), past_due + valid paidThrough
 * DENY: canceled, paused, incomplete, unpaid, unknown + any paidThrough
 *
 * Catalogue/publishing controls what content exists; Stripe controls premium entitlement.
 */

const ENTITLED_STRIPE_STATUSES = new Set(["active", "past_due"]);

/**
 * @param {Object|null|undefined} user
 * @param {number} [now=Date.now()]
 * @returns {boolean}
 */
function hasStripeLetsReviseProAccess(user, now = Date.now()) {
  if (!user) return false;

  const billing = user.stripeBilling;
  if (!billing || billing.planId !== "letsrevise_pro") return false;

  const status = String(billing.status ?? "")
    .trim()
    .toLowerCase();
  if (!status || !ENTITLED_STRIPE_STATUSES.has(status)) return false;

  const paidThroughRaw = billing.paidThrough;
  if (paidThroughRaw == null) return false;

  const paidThroughMs = new Date(paidThroughRaw).getTime();
  return Number.isFinite(paidThroughMs) && paidThroughMs > now;
}

module.exports = { hasStripeLetsReviseProAccess, ENTITLED_STRIPE_STATUSES };
