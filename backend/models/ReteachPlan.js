/**
 * PR14: AI-generated reteach plan from lesson misconceptions (cached, editable).
 */
const mongoose = require("mongoose");

const ReteachPlanSchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
    days: { type: Number, required: true, index: true },
    limit: { type: Number, default: 10 },
    generatedAt: { type: Date, default: Date.now, index: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sourceHash: { type: String, required: true, index: true },
    content: { type: String, default: "" },
    pinned: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    /** PR15: Short "Next steps" blurb shown to students (max 1000). */
    studentSummary: { type: String, default: "", maxlength: 1000 },
    /** PR15: Optional teacher-only classroom notes (max 4000). */
    classroomNotes: { type: String, default: "", maxlength: 4000 },
  },
  { timestamps: true }
);

ReteachPlanSchema.index({ lessonId: 1, days: 1, sourceHash: 1 }, { unique: true });

module.exports = mongoose.model("ReteachPlan", ReteachPlanSchema);
