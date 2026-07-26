/**
 * Class invitation by normalised target email.
 * Always created for syntactically valid emails (anti-enumeration) — no User lookup at create.
 */
"use strict";

const mongoose = require("mongoose");
const { generateOpaquePublicId } = require("../utils/opaquePublicId");

const INVITATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STATUSES = ["pending", "accepted", "declined", "cancelled", "expired"];

const StudentClassInvitationSchema = new mongoose.Schema(
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
    /** Normalised plaintext email submitted by the teacher. */
    targetEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "pending",
      index: true,
    },
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: generateOpaquePublicId,
    },
    /** Set only after authenticated student acceptance (Phase 2). Never from teacher input. */
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    requestedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + INVITATION_TTL_MS),
    },
  },
  { timestamps: true }
);

StudentClassInvitationSchema.index({ classId: 1, targetEmail: 1 }, { unique: true });
StudentClassInvitationSchema.index({ teacherId: 1, status: 1 });
StudentClassInvitationSchema.index({ classId: 1, status: 1 });
StudentClassInvitationSchema.index({ targetEmail: 1, status: 1 });

StudentClassInvitationSchema.statics.STATUSES = STATUSES;
StudentClassInvitationSchema.statics.INVITATION_TTL_MS = INVITATION_TTL_MS;
StudentClassInvitationSchema.statics.generatePublicId = generateOpaquePublicId;

/**
 * Effective status: pending past expiresAt is treated as expired (no worker required).
 */
StudentClassInvitationSchema.statics.effectiveStatus = function effectiveStatus(doc, now = new Date()) {
  if (!doc) return null;
  if (doc.status === "pending" && doc.expiresAt && new Date(doc.expiresAt) < now) {
    return "expired";
  }
  return doc.status;
};

module.exports = mongoose.model("StudentClassInvitation", StudentClassInvitationSchema);
