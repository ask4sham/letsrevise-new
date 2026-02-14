const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: false,
      index: true,
    },
    meta: {
      type: Object,
      default: {},
    },
    userAgent: String,
    ip: String,
  },
  { timestamps: true }
);

EventSchema.index({ type: 1, createdAt: -1 });
EventSchema.index({ type: 1, lessonId: 1, createdAt: -1 });

module.exports = mongoose.model("Event", EventSchema);
