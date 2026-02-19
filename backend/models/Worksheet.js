// backend/models/Worksheet.js
const mongoose = require("mongoose");

const WORKSHEET_STATUSES = ["DRAFT", "PUBLISHED"];

const WorksheetItemSchema = new mongoose.Schema(
  {
    examQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamQuestion",
      required: true,
    },
    marksOverride: { type: Number, min: 0, default: undefined },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { _id: false }
);

const TITLE_MAX_LENGTH = 120;

const WorksheetSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, default: "Untitled worksheet", trim: true, maxlength: TITLE_MAX_LENGTH },
    subject: { type: String, trim: true, default: "" },
    examBoard: { type: String, trim: true, default: "" },
    level: { type: String, trim: true, default: "" },
    topicKey: { type: String, trim: true, default: null },
    questionItems: {
      type: [WorksheetItemSchema],
      default: [],
    },
    status: {
      type: String,
      enum: WORKSHEET_STATUSES,
      default: "DRAFT",
      index: true,
    },
  },
  { timestamps: true }
);

WorksheetSchema.index({ ownerId: 1, updatedAt: -1 });

module.exports = mongoose.model("Worksheet", WorksheetSchema);
module.exports.WORKSHEET_STATUSES = WORKSHEET_STATUSES;
module.exports.TITLE_MAX_LENGTH = TITLE_MAX_LENGTH;
