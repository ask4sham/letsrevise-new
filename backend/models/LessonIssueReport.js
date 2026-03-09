/**
 * LessonIssueReport — students and teachers can report mistakes in lesson content.
 * Admin/teacher dashboard lists reports for review.
 */
const mongoose = require("mongoose");

const REPORT_TYPES = [
  "incorrect_information",
  "typo_spelling",
  "image_problem",
  "question_incorrect",
  "other",
];

const STATUSES = ["open", "reviewed", "resolved"];

const LessonIssueReportSchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
    pageId: { type: String, default: null, trim: true, index: true },
    pageTitle: { type: String, default: null, trim: true },
    pageOrder: { type: Number, default: null },
    blockId: { type: String, default: null, trim: true },
    reportType: { type: String, enum: REPORT_TYPES, required: true },
    description: { type: String, required: true, trim: true },
    suggestedFix: { type: String, default: "", trim: true },
    reportedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userRole: { type: String, enum: ["student", "teacher", "admin"], default: "student" },
    status: { type: String, enum: STATUSES, default: "open", index: true },
    /** Resolution audit — set when status becomes resolved */
    resolvedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

LessonIssueReportSchema.index({ lessonId: 1, createdAt: -1 });
LessonIssueReportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("LessonIssueReport", LessonIssueReportSchema);
module.exports.REPORT_TYPES = REPORT_TYPES;
module.exports.STATUSES = STATUSES;
