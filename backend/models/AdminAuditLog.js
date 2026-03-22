// backend/models/AdminAuditLog.js
// Minimal audit log for admin-sensitive actions: role changes, lesson publish, subscriptions, etc.
const mongoose = require("mongoose");

const AdminAuditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorEmail: { type: String },
    targetType: { type: String, index: true },
    targetId: { type: mongoose.Schema.Types.Mixed },
    details: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: true }
);

AdminAuditLogSchema.index({ createdAt: -1 });
AdminAuditLogSchema.index({ action: 1, createdAt: -1 });

module.exports =
  mongoose.models.AdminAuditLog || mongoose.model("AdminAuditLog", AdminAuditLogSchema);
