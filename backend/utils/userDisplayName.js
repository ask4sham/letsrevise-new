/**
 * Safe display name for teacher/student-facing DTOs.
 * Never returns email or Mongo IDs.
 */
"use strict";

/**
 * @param {{ firstName?: string, lastName?: string, name?: string } | null | undefined} user
 * @param {string} [fallback]
 * @returns {string}
 */
function getSafeUserDisplayName(user, fallback = "User") {
  if (!user || typeof user !== "object") return fallback;
  const first = typeof user.firstName === "string" ? user.firstName.trim() : "";
  const last = typeof user.lastName === "string" ? user.lastName.trim() : "";
  const combined = [first, last].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  if (typeof user.name === "string" && user.name.trim()) {
    return user.name.trim().split(/\s+/)[0] || fallback;
  }
  return fallback;
}

module.exports = {
  getSafeUserDisplayName,
};
