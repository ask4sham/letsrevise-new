const mongoose = require("mongoose");

const TemplateBlockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["text", "keyIdea", "examTip", "commonMistake", "stretch"],
      required: true,
    },
    content: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const TemplatePageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    pageType: {
      type: String,
      default: "",
    },
    blocks: {
      type: [TemplateBlockSchema],
      default: [],
    },
  },
  { _id: false }
);

const TemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    subject: {
      type: String,
      required: true,
    },

    level: {
      type: String,
      required: true,
    },

    board: {
      type: String,
      default: "",
    },

    tier: {
      type: String,
      enum: ["foundation", "higher", "both"],
      default: "both",
    },

    status: {
      type: String,
      enum: ["draft", "active", "retired"],
      default: "draft",
    },

    version: {
      type: Number,
      default: 1,
    },

    pages: {
      type: [TemplatePageSchema],
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // admin
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Template", TemplateSchema);
