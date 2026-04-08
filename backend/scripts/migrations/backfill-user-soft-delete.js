/**
 * One-time: set isDeleted=false on users where the field is missing (legacy documents).
 * Safe to run multiple times.
 *
 *   cd backend && node scripts/migrations/backfill-user-soft-delete.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const User = require("../../models/User");

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const res = await User.updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } });
  console.log("Matched:", res.matchedCount, "Modified:", res.modifiedCount);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
