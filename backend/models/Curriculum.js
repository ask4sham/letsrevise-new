const mongoose = require("mongoose");

const { Schema } = mongoose;
const { Mixed } = Schema.Types;

// Minimal Curriculum schema for safe boot-time registration.
// Intentionally small and generic – can be extended in later phases.
const CurriculumSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    metadata: {
      type: Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Curriculum || mongoose.model("Curriculum", CurriculumSchema);

