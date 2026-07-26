/**
 * Active/removed class membership (created on Accept in Phase 2).
 * Model exists in Phase 1 for schema/index readiness; no membership writes yet.
 */
"use strict";

const mongoose = require("mongoose");
const { generateOpaquePublicId } = require("../utils/opaquePublicId");

const STATUSES = ["active", "removed"];

const StudentClassMembershipSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentClass",
      required: true,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: generateOpaquePublicId,
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "active",
      index: true,
    },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
  },
  { timestamps: true }
);

StudentClassMembershipSchema.index({ classId: 1, studentId: 1 }, { unique: true });
StudentClassMembershipSchema.index({ teacherId: 1, status: 1 });
StudentClassMembershipSchema.index({ studentId: 1, status: 1 });
StudentClassMembershipSchema.index({ classId: 1, status: 1 });

StudentClassMembershipSchema.statics.STATUSES = STATUSES;
StudentClassMembershipSchema.statics.generatePublicId = generateOpaquePublicId;

module.exports = mongoose.model("StudentClassMembership", StudentClassMembershipSchema);
