/**
 * Soft-delete: active users are those where isDeleted is not strictly true.
 * Missing isDeleted (legacy documents) counts as active.
 */
const ACTIVE_USER_FILTER = { isDeleted: { $ne: true } };

function isActiveUserDoc(doc) {
  return doc != null && doc.isDeleted !== true;
}

/**
 * Merge Mongo query with "active users only" (for listings, referrals, etc.).
 * @param {Record<string, unknown>} base
 */
function withActiveUserFilter(base = {}) {
  return { ...base, ...ACTIVE_USER_FILTER };
}

module.exports = {
  ACTIVE_USER_FILTER,
  isActiveUserDoc,
  withActiveUserFilter,
};
