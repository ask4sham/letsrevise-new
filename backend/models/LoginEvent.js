// backend/models/LoginEvent.js
// Immutable server-only record of successful authentications (append-only).
const mongoose = require("mongoose");

const LoginEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    loggedInAt: { type: Date, required: true },
    emailSnapshot: { type: String, required: true },
    firstNameSnapshot: { type: String, required: true },
    lastNameSnapshot: { type: String, default: "" },
    userTypeSnapshot: { type: String, required: true },
  },
  { timestamps: true }
);

LoginEventSchema.index({ loggedInAt: -1 });

module.exports =
  mongoose.models.LoginEvent || mongoose.model("LoginEvent", LoginEventSchema);
