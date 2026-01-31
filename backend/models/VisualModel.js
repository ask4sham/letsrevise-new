// backend/models/VisualModel.js
const mongoose = require("mongoose");

/**
 * VisualModel
 * ------------------------------------
 * One concept (e.g. Photosynthesis)
 * rendered differently per level.
 *
 * This is the SECRET SAUCE:
 * - Same lesson
 * - Same topic
 * - Different visual complexity
 */

const VisualVariantSchema = new mongoose.Schema(
  {
    // "KS3" | "GCSE" | "A-Level"
    level: { type: String, required: true },

    /**
     * Visual type:
     * - staticDiagram: labelled SVG/PNG
     * - stepAnimation: animated steps (later)
     * - interactive: clickable / explorable
     */
    type: {
      type: String,
      enum: ["staticDiagram", "stepAnimation", "interactive"],
      default: "staticDiagram",
    },

    // URL to asset (SVG, MP4, Lottie JSON, etc.)
    src: { type: String, required: true },

    // Optional structured steps for animation / narration
    steps: [
      {
        title: String,
        description: String,
      },
    ],

    /**
     * Cognitive load controls
     * (THIS is how we differentiate levels)
     */
    labels: { type: [String], default: [] }, // terms shown on diagram
    hiddenLabels: { type: [String], default: [] }, // revealed on interaction

    narration: { type: String, default: "" }, // voiceover / text
  },
  { _id: false }
);

const VisualModelSchema = new mongoose.Schema(
  {
    // e.g. "photosynthesis"
    conceptKey: { type: String, required: true, index: true },

    subject: { type: String, required: true }, // Biology
    topic: { type: String, required: true },   // Photosynthesis

    variants: { type: [VisualVariantSchema], default: [] },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VisualModel", VisualModelSchema);
