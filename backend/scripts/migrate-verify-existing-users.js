#!/usr/bin/env node
/**
 * One-off migration: Mark existing users (no emailVerificationToken) as verified.
 * Users who signed up before email verification was added will have verificationStatus: "pending"
 * but no token. This script sets them to "verified" so they can continue using the app.
 *
 * Run: node backend/scripts/migrate-verify-existing-users.js
 * Dry run: node backend/scripts/migrate-verify-existing-users.js --dry-run
 * Apply:   node backend/scripts/migrate-verify-existing-users.js --apply
 *
 * Env: MONGO_URI or MONGODB_URI
 */
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
}
const mongoose = require("mongoose");
const User = require("../models/User");

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI or MONGODB_URI required");
    process.exit(1);
  }

  const apply = process.argv.includes("--apply");

  await mongoose.connect(uri);

  const users = await User.find({
    $or: [
      { emailVerificationToken: { $exists: false } },
      { emailVerificationToken: null },
    ],
    verificationStatus: "pending",
  }).lean();

  console.log(`Found ${users.length} existing user(s) with pending verification (no token).`);
  if (users.length === 0) {
    await mongoose.disconnect();
    process.exit(0);
  }

  if (apply) {
    const result = await User.updateMany(
      {
        _id: { $in: users.map((u) => u._id) },
      },
      { $set: { verificationStatus: "verified" } }
    );
    console.log(`Updated ${result.modifiedCount} user(s) to verified.`);
  } else {
    console.log("Dry run. Add --apply to update.");
    users.slice(0, 5).forEach((u) => console.log(`  - ${u.email}`));
    if (users.length > 5) console.log(`  ... and ${users.length - 5} more`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
