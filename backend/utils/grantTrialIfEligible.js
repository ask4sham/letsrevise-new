const User = require("../models/User");
const { isSubscriptionActive } = require("./isSubscriptionActive");

const TRIAL_DAYS = 7;

/**
 * Grant a 7-day trial subscriptionV2 exactly once per user.
 * This is the only place that should grant a trial; call it from engagement triggers
 * (e.g. first lesson view, signup conversion). Safe to call multiple times: if the user
 * is not eligible, returns { granted: false, reason } and does not change the user.
 *
 * @param {Object} opts
 * @param {string} opts.userId - Mongo user _id
 * @param {string} [opts.reason] - Optional reason string for logging
 * @returns {Promise<{ granted: boolean, reason: string, expiresAt?: string, plan?: string }>}
 */
async function grantTrialIfEligible({ userId, reason }) {
  const user = await User.findById(userId);
  if (!user) {
    return { granted: false, reason: "user_not_found" };
  }
  if (user.trialUsed === true) {
    return { granted: false, reason: "trial_already_used" };
  }
  if (isSubscriptionActive(user)) {
    return { granted: false, reason: "subscription_active" };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  user.subscriptionV2 = {
    plan: "trial",
    status: "active",
    expiresAt,
  };
  user.trialUsed = true;
  await user.save();

  return {
    granted: true,
    reason: reason || "trial_granted",
    expiresAt: expiresAt.toISOString(),
    plan: "trial",
  };
}

module.exports = { grantTrialIfEligible };
