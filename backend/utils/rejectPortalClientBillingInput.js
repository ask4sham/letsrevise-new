/**
 * Reject client-supplied billing overrides on Customer Portal creation (B5).
 * Composes frozen B4 Checkout rules with Portal-only forbidden fields.
 */
const { findForbiddenClientBillingKeys } = require("./rejectClientBillingInput");

const PORTAL_ONLY_FORBIDDEN = [
  "customerId",
  "customer",
  "return_url",
  "returnUrl",
  "configuration",
  "configurationId",
];

/**
 * @param {unknown} body
 * @returns {string[]}
 */
function findForbiddenPortalClientBillingKeys(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];

  const checkoutForbidden = findForbiddenClientBillingKeys(body);
  const portalForbidden = PORTAL_ONLY_FORBIDDEN.filter(
    (key) => body[key] !== undefined && body[key] !== null
  );

  return [...checkoutForbidden, ...portalForbidden.filter((key) => !checkoutForbidden.includes(key))];
}

module.exports = { findForbiddenPortalClientBillingKeys, PORTAL_ONLY_FORBIDDEN };
