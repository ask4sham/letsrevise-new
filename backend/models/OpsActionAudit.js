// backend/models/OpsActionAudit.js — Phase 11
const mongoose = require("mongoose");

const OpsActionAuditSchema = new mongoose.Schema(
  {
    actionType: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    decisionId: { type: String },
    incidentId: { type: mongoose.Schema.Types.ObjectId, ref: "OpsIncident" },
    result: { type: String, enum: ["SUCCESS", "FAILED", "DRY_RUN"], required: true },
    beforeSnapshot: { type: mongoose.Schema.Types.Mixed },
    afterSnapshot: { type: mongoose.Schema.Types.Mixed },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.OpsActionAudit || mongoose.model("OpsActionAudit", OpsActionAuditSchema);
