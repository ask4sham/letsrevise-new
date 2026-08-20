/**
 * Reject client-supplied billing overrides (B2 — server-owned Checkout).
 * @param {unknown} body
 * @returns {string[]} forbidden keys present on body
 */
function findForbiddenClientBillingKeys(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  const forbidden = [
    "priceId",
    "price",
    "line_items",
    "amount",
    "currency",
    "planId",
    "userId",
    "letsReviseUserId",
  ];
  return forbidden.filter((key) => body[key] !== undefined && body[key] !== null);
}

module.exports = { findForbiddenClientBillingKeys };
