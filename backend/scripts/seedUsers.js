import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const MONGO_URI = process.env.MONGO_URI;

async function upsertUser({ email, password, userType }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    // Ensure role is correct + password is known (only if you want to reset)
    existing.userType = userType;
    existing.password = await bcrypt.hash(password, 12);
    await existing.save();
    console.log(`Updated: ${normalizedEmail} (${userType})`);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  await User.create({ email: normalizedEmail, password: hashed, userType });
  console.log(`Created: ${normalizedEmail} (${userType})`);
}

(async () => {
  await mongoose.connect(MONGO_URI);

  await upsertUser({ email: "admin@example.com", password: "Password123", userType: "admin" });
  await upsertUser({ email: "parent@example.com", password: "Password123", userType: "parent" });

  await mongoose.disconnect();
  process.exit(0);
})();
