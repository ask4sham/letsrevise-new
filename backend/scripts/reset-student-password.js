// backend/scripts/reset-student-password.js
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/database");
const User = require("../models/User");

(async () => {
  try {
    await connectDB();

    const email = "rajiv@example.com";
    const newPassword = "Rajiv@123456";

    const user = await User.findOne({ email: new RegExp(`^${email}$`, "i") });
    if (!user) {
      console.error("User not found:", email);
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    console.log("✅ Password reset OK");
    console.log("email:", user.email);
    console.log("newPassword:", newPassword);

    process.exit(0);
  } catch (err) {
    console.error("❌ Password reset failed:", err);
    process.exit(1);
  } finally {
    try {
      await mongoose.connection.close();
    } catch {}
  }
})();
