/**
 * Admin taxonomy additions — units (main topics), sections, and topics.
 * 4-level hierarchy: Main Topic → Section → Topic (leaf, content-linked).
 * Merged with static config when serving taxonomy to Create Lesson, banks, etc.
 */
const mongoose = require("mongoose");

const AdminTaxonomyItemSchema = new mongoose.Schema(
  {
    specKey: { type: String, required: true, trim: true, index: true },
    type: { type: String, required: true, enum: ["unit", "section", "subTopic"], index: true },
    /** Main topic (unit) display name. Required for type=unit. */
    unit: { type: String, trim: true, default: "" },
    /** Main topic slug. Required for type=unit. */
    unitKey: { type: String, trim: true, default: "", index: true },
    /** Section title (type=section only). */
    title: { type: String, trim: true, default: "" },
    /** Section slug (type=section only). */
    slug: { type: String, trim: true, default: "", index: true },
    /** Parent unit slug (type=section only). Used when parent is a static unit (no _id). */
    parentUnitKey: { type: String, trim: true, default: "", index: true },
    /** Parent node _id. null for unit; unit _id for section; unit or section _id for subTopic. Section prefers parentUnitKey for static units. */
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminTaxonomyItem", default: null, index: true },
    /** Topic display name (type=subTopic only). */
    topic: { type: String, trim: true, default: "" },
    /** Topic slug (type=subTopic only). */
    key: { type: String, trim: true, default: "" },
    /** Full topicKey (type=subTopic only) e.g. "aqa-gcse-biology:chromosomes" */
    topicKey: { type: String, trim: true, default: "", index: true },
    tier: { type: [String], default: ["foundation", "higher"] },
    requiredPractical: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    /** Pattern B: active sub-topics validate; archived are not valid for new lessons/banks. */
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    /** Optional namespaced key of canonical topic (e.g. aqa-gcse-biology:digestive-system). */
    mapsToCanonicalKey: { type: String, trim: true, default: "" },
    inheritQuestionBankFrom: { type: String, trim: true, default: "" },
    inheritAnalyticsFrom: { type: String, trim: true, default: "" },
    /** Unit slug parent for admin tree (same as unitKey for subTopic). */
    parentKey: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

AdminTaxonomyItemSchema.index({ specKey: 1, type: 1, unitKey: 1 });
AdminTaxonomyItemSchema.index({ specKey: 1, unitKey: 1, key: 1 }, { unique: true, sparse: true });
AdminTaxonomyItemSchema.index({ specKey: 1, parentId: 1, slug: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("AdminTaxonomyItem", AdminTaxonomyItemSchema);
