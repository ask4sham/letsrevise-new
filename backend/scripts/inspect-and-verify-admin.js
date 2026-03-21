#!/usr/bin/env node
/**
 * Inspect admin user(s) and optionally mark as verified.
 * Admin login is blocked when verificationStatus !== "verified".
 * This script does NOT weaken verification for public users.
 *
 * Run:
 *   node backend/scripts/inspect-and-verify-admin.js          # inspect only
 *   node backend/scripts/inspect-and-verify-admin.js --apply  # mark admin(s) verified
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

  const admins = await User.find({ userType: "admin" })
    .select("email userType verificationStatus emailVerificationToken emailVerificationExpires createdAt")
    .lean();

  if (admins.length === 0) {
    console.log("No admin user(s) found in DB.");
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`\nFound ${admins.length} admin user(s):\n`);
  admins.forEach((u, i) => {
    console.log(`--- Admin ${i + 1} ---`);
    console.log("  email:", u.email);
    console.log("  userType:", u.userType);
    console.log("  verificationStatus:", u.verificationStatus ?? "(not set, defaults to pending)");
    console.log("  emailVerificationToken:", u.emailVerificationToken ?? "(null)");
    console.log("  emailVerificationExpires:", u.emailVerificationExpires ?? "(null)");
    console.log("  createdAt:", u.createdAt);
    console.log("");
  });

  const needFix = admins.filter((u) => (u.verificationStatus || "pending") !== "verified");
  if (needFix.length === 0) {
    console.log("All admin(s) already verified. No change needed.");
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`${needFix.length} admin(s) need verificationStatus=verified.\n`);

  if (apply) {
    const result = await User.updateMany(
      { userType: "admin", verificationStatus: { $ne: "verified" } },
      { $set: { verificationStatus: "verified", emailVerificationToken: null, emailVerificationExpires: null } }
    );
    console.log(`Updated ${result.modifiedCount} admin user(s) to verified.`);
  } else {
    console.log("Dry run. Add --apply to update.");
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
