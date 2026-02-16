// backend/config/pricing.js
/**
 * Canonical pricing source for the product.
 * Keep amounts in minor units (pence) to avoid floating-point issues.
 * You can change PRICE_* later without touching entitlement logic.
 */
const PRICING = {
  subscription: {
    currency: "GBP",
    monthly: {
      amount: Number(process.env.SUBSCRIPTION_MONTHLY_PRICE_PENCE || 999), // £9.99 default
      interval: "month",
    },
    annual: {
      amount: Number(process.env.SUBSCRIPTION_ANNUAL_PRICE_PENCE || 8999), // £89.99 default (optional)
      interval: "year",
    },
  },
};

module.exports = PRICING;
