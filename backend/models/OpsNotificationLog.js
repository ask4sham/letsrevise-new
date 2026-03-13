// backend/models/OpsNotificationLog.js — Phase 12.1
const mongoose = require("mongoose");

const OpsNotificationLogSchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true, index: true },
    incidentId: { type: mongoose.Schema.Types.ObjectId, ref: "OpsIncident" },
    dedupeKey: { type: String, required: true, index: true },
    channel: { type: String, enum: ["slack", "email"], required: true },
    result: { type: String, enum: ["SENT", "SKIPPED", "FAILED"], required: true },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.OpsNotificationLog || mongoose.model("OpsNotificationLog", OpsNotificationLogSchema);
