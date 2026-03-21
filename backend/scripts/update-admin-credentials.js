#!/usr/bin/env node
/**
 * Safely update admin email and/or password.
 * Keeps userType=admin, verificationStatus=verified. Password is bcrypt-hashed.
 *
 * Run:
 *   node backend/scripts/update-admin-credentials.js --email NEW_EMAIL
 *   node backend/scripts/update-admin-credentials.js --password NEW_PASSWORD
 *   node backend/scripts/update-admin-credentials.js --email NEW --password NEW
 *   node backend/scripts/update-admin-credentials.js --target-email admin@example.com --password NEW
 *
 * Options:
 *   --target-email  Which admin to update (required if multiple admins)
 *   --email        New email address
 *   --password     New password (min 6 chars, will be bcrypt-hashed)
 *
 * Env: MONGO_URI or MONGODB_URI
 */
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
}
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { targetEmail: null, email: null, password: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--target-email" && args[i + 1]) out.targetEmail = args[++i];
    else if (args[i] === "--email" && args[i + 1]) out.email = args[++i];
    else if (args[i] === "--password" && args[i + 1]) out.password = args[++i];
  }
  return out;
}

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI or MONGODB_URI required");
    process.exit(1);
  }

  const { targetEmail, email, password } = parseArgs();

  if (!email && !password) {
    console.error("Provide at least --email or --password");
    process.exit(1);
  }

  if (password && password.length < 6) {
    console.error("Password must be at least 6 characters");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const query = { userType: "admin" };
  if (targetEmail) query.email = targetEmail.trim().toLowerCase();

  const admin = await User.findOne(query);
  if (!admin) {
    console.error(
      targetEmail
        ? `No admin found with email: ${targetEmail}`
        : "No admin user found. Specify --target-email if you have multiple admins."
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  if (!email && !password) {
    console.error("Provide at least --email or --password");
    await mongoose.disconnect();
    process.exit(1);
  }

  if (email) {
    const normalized = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalized, _id: { $ne: admin._id } });
    if (existing) {
      console.error(`Email ${normalized} is already used by another user`);
      await mongoose.disconnect();
      process.exit(1);
    }
    admin.email = normalized;
  }

  if (password) {
    admin.password = await bcrypt.hash(password, 12);
  }

  admin.verificationStatus = "verified";
  admin.userType = "admin";
  admin.emailVerificationToken = undefined;
  admin.emailVerificationExpires = undefined;

  await admin.save();

  console.log("Updated admin successfully:");
  console.log("  email:", admin.email);
  console.log("  userType:", admin.userType);
  console.log("  verificationStatus:", admin.verificationStatus);
  if (password) console.log("  password: (bcrypt-hashed)");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
