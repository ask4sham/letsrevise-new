/**
 * Placement override for static topics — moves a topic under a section.
 * Only applies when topic exists in static config; topicKey identity is preserved.
 */
const mongoose = require("mongoose");

const AdminTopicPlacementSchema = new mongoose.Schema(
  {
    specKey: { type: String, required: true, trim: true, index: true },
    /** Topic slug (e.g. "chromosomes"). Must match static topic key. */
    topicSlug: { type: String, required: true, trim: true, index: true },
    /** Section _id (AdminTaxonomyItem type=section). */
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminTaxonomyItem", required: true, index: true },
  },
  { timestamps: true }
);

AdminTopicPlacementSchema.index({ specKey: 1, topicSlug: 1 }, { unique: true });

module.exports = mongoose.model("AdminTopicPlacement", AdminTopicPlacementSchema);
