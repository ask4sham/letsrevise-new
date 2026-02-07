// Phase E foundation model. Intentionally minimal and inert.
// Do not add behaviour, relationships, or logic until Phase F.

const mongoose = require("mongoose");

const { Schema } = mongoose;

const CurriculumSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Curriculum", CurriculumSchema);

