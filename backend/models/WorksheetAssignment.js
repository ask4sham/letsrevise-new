// backend/models/WorksheetAssignment.js — PR-W4: shareable assignment for published worksheets
const mongoose = require("mongoose");
const crypto = require("crypto");

const WorksheetAssignmentSchema = new mongoose.Schema(
  {
    worksheetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worksheet",
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, trim: true, default: "" },
    classCode: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    shareId: { type: String, required: true, unique: true, index: true },
    dueAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/** Generate a URL-safe token (e.g. 16 chars). */
function generateShareId() {
  return crypto.randomBytes(12).toString("base64url");
}

WorksheetAssignmentSchema.statics.generateShareId = generateShareId;

module.exports = mongoose.model("WorksheetAssignment", WorksheetAssignmentSchema);
module.exports.generateShareId = generateShareId;
