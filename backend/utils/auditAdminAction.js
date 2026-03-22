// backend/utils/auditAdminAction.js
// Log admin-sensitive actions for audit trail
const AdminAuditLog = require("../models/AdminAuditLog");

/**
 * Log an admin action. Fire-and-forget (does not block request).
 * @param {Object} opts
 * @param {string} opts.action - e.g. "role_change", "lesson_status", "subscription_grant"
 * @param {string} opts.actorId - User ID of the admin performing the action
 * @param {string} [opts.actorEmail] - Admin email for quick lookup
 * @param {string} [opts.targetType] - e.g. "User", "Lesson"
 * @param {string} [opts.targetId] - ID of the affected entity
 * @param {Object} [opts.details] - Additional context (e.g. { from: "teacher", to: "admin" })
 * @param {string} [opts.ip] - Request IP
 */
async function auditAdminAction(opts) {
  try {
    await AdminAuditLog.create({
      action: opts.action,
      actorId: opts.actorId,
      actorEmail: opts.actorEmail,
      targetType: opts.targetType,
      targetId: opts.targetId,
      details: opts.details || {},
      ip: opts.ip,
    });
  } catch (err) {
    console.error("[AdminAudit] Failed to log:", err.message);
  }
}

module.exports = { auditAdminAction };
