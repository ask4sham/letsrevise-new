/**
 * Teacher-owned student class for bulk/individual email invitations (Phase 1).
 */
"use strict";

const mongoose = require("mongoose");
const { generateOpaquePublicId } = require("../utils/opaquePublicId");

const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;

const StudentClassSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: NAME_MAX,
    },
    description: {
      type: String,
      trim: true,
      maxlength: DESCRIPTION_MAX,
      default: "",
    },
    /** Optional course metadata — reuse taxonomy values when provided by callers later. */
    subject: { type: String, trim: true, default: null },
    board: { type: String, trim: true, default: null },
    specKey: { type: String, trim: true, default: null },
    tier: { type: String, trim: true, default: null },
    academicYear: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: generateOpaquePublicId,
    },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

StudentClassSchema.index({ teacherId: 1, status: 1 });
StudentClassSchema.index({ teacherId: 1, createdAt: -1 });

StudentClassSchema.statics.NAME_MAX = NAME_MAX;
StudentClassSchema.statics.DESCRIPTION_MAX = DESCRIPTION_MAX;
StudentClassSchema.statics.generatePublicId = generateOpaquePublicId;

module.exports = mongoose.model("StudentClass", StudentClassSchema);
