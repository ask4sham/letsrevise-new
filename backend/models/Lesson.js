const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema(
  {
    // Basic lesson info
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    content: { type: String, required: true },

    // Teacher / owner
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    teacherName: { type: String },

    // Curriculum metadata
    subject: { type: String, required: true },
    level: { type: String, required: true }, // e.g. "KS3", "GCSE", "A-Level"
    board: { type: String }, // exam board (AQA, Edexcel, etc.)

    // GCSE tier (only meaningful when level === "GCSE")
    tier: {
      type: String,
      enum: ["foundation", "higher"],
      required: false,
    },

    topic: { type: String, required: true },

    // Tags & resources
    tags: [{ type: String }],
    estimatedDuration: { type: Number }, // in minutes
    shamCoinPrice: { type: Number, default: 0 },

    resources: [{ type: String }],

    // Uploaded image URLs / paths
    uploadedImages: [{ type: String }],

    // Publishing + engagement
    isPublished: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = mongoose.model("Lesson", lessonSchema);
