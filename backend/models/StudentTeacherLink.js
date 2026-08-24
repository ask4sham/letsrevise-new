/**
 * PR-PRACTICE-LOOP-1 Slice 3: Student↔teacher link for practice/analytics ownership.
 * Used when no other relationship exists; validate before accepting teacherId on practice-attempts / practice-sets.
 *
 * Phase 1 class linking: optional status/source for origin-safe future revoke rules.
 * - Missing status ⇒ accepted (legacy)
 * - Missing source ⇒ legacy/direct
 * - Class leave must never revoke admin/direct/legacy links
 */
const mongoose = require("mongoose");

const StudentTeacherLinkSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    /** accepted | revoked — missing means accepted for backward compatibility */
    status: {
      type: String,
      enum: ["accepted", "revoked"],
      default: undefined,
    },
    /** class | admin | direct — missing means legacy/direct */
    source: {
      type: String,
      enum: ["class", "admin", "direct"],
      default: undefined,
    },
  },
  { timestamps: true }
);

StudentTeacherLinkSchema.index({ studentId: 1, teacherId: 1 }, { unique: true });

module.exports = mongoose.model("StudentTeacherLink", StudentTeacherLinkSchema);
