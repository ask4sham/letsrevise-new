/**
 * Phase 9B — Subscription V2 contract (schema + invariants).
 * Single source of truth for entitlement: allowlist statuses + expiry enforcement.
 */
const ENTITLED_STATUSES = new Set(["active", "trialing"]);

const NONE_SUBSCRIPTION = Object.freeze({
  status: "none",
  planId: null,
  provider: null,
  expiresAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
});

/**
 * Normalize raw subscription (from user.subscriptionV2 or user.subscription) to a stable shape.
 * Non-object → { status: "none", ... } so downstream always has an object; isEntitledSubscriptionV2 still denies.
 * planId is string-only to avoid billing provider shape drift ({ plan: { id } }, planId, string).
 * @param {Object|null|undefined} sub - Raw subscription object from DB
 * @returns {Object} Normalized { status, planId, provider?, expiresAt?, currentPeriodEnd?, cancelAtPeriodEnd }
 */
function normalizeSubscriptionV2(sub) {
  if (!sub || typeof sub !== "object") return { ...NONE_SUBSCRIPTION };

  const status = typeof sub.status === "string" ? sub.status.trim().toLowerCase() : "none";
  const planId =
    sub.planId ?? sub.plan ?? (sub.plan && typeof sub.plan === "object" ? sub.plan.id : undefined);
  const planIdNorm = planId == null ? null : String(planId);
  const expiresAt = sub.expiresAt != null ? new Date(sub.expiresAt) : null;
  const currentPeriodEnd = sub.currentPeriodEnd != null ? new Date(sub.currentPeriodEnd) : null;

  return {
    status: status || "none",
    planId: planIdNorm,
    provider: sub.provider ?? null,
    expiresAt:
      expiresAt != null && Number.isFinite(expiresAt.getTime()) ? expiresAt.toISOString() : null,
    currentPeriodEnd:
      currentPeriodEnd != null && Number.isFinite(currentPeriodEnd.getTime())
        ? currentPeriodEnd.toISOString()
        : null,
    cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd,
  };
}

/**
 * Whether the normalized subscription is currently entitled (active or trialing, not expired).
 * @param {Object|null} subNorm - Result of normalizeSubscriptionV2() (object with status "none" still denied)
 * @param {number} [now=Date.now()] - Current time (ms) for expiry check
 * @returns {boolean}
 */
function isEntitledSubscriptionV2(subNorm, now = Date.now()) {
  if (!subNorm || typeof subNorm.status !== "string") return false;
  if (!ENTITLED_STATUSES.has(subNorm.status)) return false;

  if (subNorm.expiresAt) {
    const exp = Date.parse(subNorm.expiresAt);
    if (Number.isFinite(exp) && exp <= now) return false;
  }

  return true;
}

module.exports = {
  normalizeSubscriptionV2,
  isEntitledSubscriptionV2,
  ENTITLED_STATUSES,
};
