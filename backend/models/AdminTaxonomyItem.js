/**
 * Admin taxonomy additions — units (main topics) and sub-topics.
 * Merged with static config when serving taxonomy to Create Lesson, banks, etc.
 */
const mongoose = require("mongoose");

const AdminTaxonomyItemSchema = new mongoose.Schema(
  {
    specKey: { type: String, required: true, trim: true, index: true },
    type: { type: String, required: true, enum: ["unit", "subTopic"], index: true },
    /** Main topic (unit) display name e.g. "Cell Biology" */
    unit: { type: String, required: true, trim: true },
    /** Main topic slug e.g. "cell-biology" */
    unitKey: { type: String, required: true, trim: true, index: true },
    /** Sub-topic display name (type=subTopic only) e.g. "Scale and size of cells" */
    topic: { type: String, trim: true, default: "" },
    /** Sub-topic slug (type=subTopic only) e.g. "scale-and-size-of-cells" */
    key: { type: String, trim: true, default: "" },
    /** Full topicKey (type=subTopic only) e.g. "aqa-gcse-biology:scale-and-size-of-cells" */
    topicKey: { type: String, trim: true, default: "", index: true },
    tier: { type: [String], default: ["foundation", "higher"] },
    requiredPractical: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AdminTaxonomyItemSchema.index({ specKey: 1, type: 1, unitKey: 1 });
AdminTaxonomyItemSchema.index({ specKey: 1, unitKey: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("AdminTaxonomyItem", AdminTaxonomyItemSchema);
