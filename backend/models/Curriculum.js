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

