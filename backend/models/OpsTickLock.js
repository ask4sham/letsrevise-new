// backend/models/OpsTickLock.js — Phase 11 hardening: single-flight tick
const mongoose = require("mongoose");

const OpsTickLockSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.OpsTickLock || mongoose.model("OpsTickLock", OpsTickLockSchema);
