/**
 * Invitation ownership: authenticated student email must match targetEmail.
 */
"use strict";

const { normaliseEmail } = require("./studentEmail");

/**
 * @param {{ targetEmail?: string } | null | undefined} invitation
 * @param {{ email?: string, userType?: string, type?: string, role?: string } | null | undefined} user
 * @returns {boolean}
 */
function invitationOwnedByStudent(invitation, user) {
  if (!invitation || !user) return false;
  const role = (user.userType || user.type || user.role || "").toString().toLowerCase();
  if (role !== "student") return false;
  const norm = normaliseEmail(user.email);
  if (!norm.ok) return false;
  return String(invitation.targetEmail || "").toLowerCase() === norm.email;
}

module.exports = {
  invitationOwnedByStudent,
};
