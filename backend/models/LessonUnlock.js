const mongoose = require("mongoose");

const LessonUnlockSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["credit", "admin", "promo"],
      required: true,
    },
  },
  { timestamps: true }
);

// One unlock per user per lesson
LessonUnlockSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

module.exports = mongoose.model("LessonUnlock", LessonUnlockSchema);
