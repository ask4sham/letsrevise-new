const mongoose = require("mongoose");

const stripeWebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true },
    status: {
      type: String,
      enum: ["processing", "processed", "failed"],
      default: "processing",
    },
    processedAt: { type: Date, default: null },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StripeWebhookEvent", stripeWebhookEventSchema);
