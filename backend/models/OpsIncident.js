// backend/models/OpsIncident.js — Phase 11
const mongoose = require("mongoose");

const OpsIncidentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    severity: { type: String, enum: ["low", "medium", "high"], required: true },
    status: {
      type: String,
      enum: ["OPEN", "MITIGATED", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    decisionSnapshot: { type: mongoose.Schema.Types.Mixed },
    actionsTaken: [{ type: mongoose.Schema.Types.Mixed }],
    title: { type: String },
    details: { type: String },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.OpsIncident || mongoose.model("OpsIncident", OpsIncidentSchema);
