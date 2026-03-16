/**
 * Autopilot Prompt Experiment — A/B testing for prompt packs.
 * Defines experiments that assign prompt packs to autopilot runs.
 */
const mongoose = require("mongoose");

const PromptPackEntrySchema = new mongoose.Schema(
  {
    promptPackId: { type: String, required: true, trim: true },
    promptPackVersion: { type: String, required: true, trim: true },
    weight: { type: Number, default: 1, min: 0 },
  },
  { _id: false }
);

const AutopilotPromptExperimentSchema = new mongoose.Schema(
  {
    experimentId: { type: String, required: true, trim: true, unique: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    specKey: { type: String, default: null, trim: true },
    topicKey: { type: String, default: null, trim: true },
    promptPacks: {
      type: [PromptPackEntrySchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length >= 2,
        message: "At least 2 prompt packs required",
      },
    },
    assignmentMode: {
      type: String,
      enum: ["round_robin", "weighted_random"],
      default: "round_robin",
    },
    status: {
      type: String,
      enum: ["active", "paused", "archived"],
      default: "active",
      index: true,
    },
    /** Round-robin counter (incremented per assignment). */
    _roundRobinIndex: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

AutopilotPromptExperimentSchema.index({ specKey: 1, status: 1 });
AutopilotPromptExperimentSchema.index({ topicKey: 1, status: 1 });
AutopilotPromptExperimentSchema.index({ status: 1 });

module.exports = mongoose.model("AutopilotPromptExperiment", AutopilotPromptExperimentSchema);
