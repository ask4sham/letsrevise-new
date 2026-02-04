const mongoose = require("mongoose");

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const CurriculumLessonSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    lessonId: {
      type: ObjectId,
      ref: "Lesson",
      default: null,
    },
  },
  { _id: false }
);

const CurriculumUnitSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    lessons: { type: [CurriculumLessonSchema], default: [] },
  },
  { _id: false }
);

const CurriculumSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true }, // e.g. "Math"
    level: { type: String, required: true, trim: true }, // e.g. "Grade 7"
    board: { type: String, default: "" }, // e.g. "UK GCSE"

    status: {
      type: String,
      enum: ["draft", "generating", "ready"],
      default: "draft",
    },

    createdBy: {
      type: ObjectId,
      ref: "User",
      default: null,
    },

    units: {
      type: [CurriculumUnitSchema],
      default: [],
    },

    generation: {
      status: {
        type: String,
        enum: ["pending", "generated", "approved", "rejected"],
        default: "pending",
      },
      lastJobId: {
        type: String,
        default: null,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Curriculum", CurriculumSchema);

