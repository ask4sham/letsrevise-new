// backend/models/WorksheetAttempt.js — PR-W4: student attempt on an assignment
const mongoose = require("mongoose");

const AnswerSchema = new mongoose.Schema(
  {
    examQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: "ExamQuestion", required: true },
    answerIndex: { type: Number, default: null },
    shortText: { type: String, trim: true, default: "" },
    // PR-W5: teacher marking for short answers
    awardedMarks: { type: Number, default: null },
    teacherFeedback: { type: String, trim: true, maxlength: 500, default: "" },
    markedAt: { type: Date, default: null },
  },
  { _id: false }
);

const WORKSHEET_ATTEMPT_STATUSES = ["IN_PROGRESS", "SUBMITTED", "MARKED"];

const WorksheetAttemptSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorksheetAssignment",
      required: true,
      index: true,
    },
    worksheetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worksheet",
      required: true,
      index: true,
    },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    studentName: { type: String, trim: true, default: "" },
    answers: { type: [AnswerSchema], default: [] },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    submittedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: WORKSHEET_ATTEMPT_STATUSES,
      default: "IN_PROGRESS",
      index: true,
    },
    // PR-W7: release results to student
    isReleased: { type: Boolean, default: false },
    releasedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorksheetAttempt", WorksheetAttemptSchema);
module.exports.WORKSHEET_ATTEMPT_STATUSES = WORKSHEET_ATTEMPT_STATUSES;
