const mongoose = require("mongoose");

const ParentLinkRequestSchema = new mongoose.Schema(
  {
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "expired"], default: "pending", index: true },
    requestedAt: { type: Date, default: Date.now },
    decidedAt: { type: Date },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    studentEmailSnapshot: { type: String },
    parentEmailSnapshot: { type: String },
  },
  { timestamps: true }
);

ParentLinkRequestSchema.index({ parentId: 1, studentId: 1, status: 1 });

module.exports = mongoose.model("ParentLinkRequest", ParentLinkRequestSchema);
