/**
 * PR-PRACTICE-LOOP-1 Slice 3: Student↔teacher link for practice/analytics ownership.
 * Used when no other relationship exists; validate before accepting teacherId on practice-attempts / practice-sets.
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
  },
  { timestamps: true }
);

StudentTeacherLinkSchema.index({ studentId: 1, teacherId: 1 }, { unique: true });

module.exports = mongoose.model("StudentTeacherLink", StudentTeacherLinkSchema);
