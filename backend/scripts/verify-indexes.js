/**
 * PR-HARD-3: Standalone index verification script.
 * Run: node backend/scripts/verify-indexes.js
 * Or: npm run verify:indexes (if added to package.json)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { verifyIndexes } = require("../utils/verifyIndexes");

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/letsrevise";

async function run() {
  await mongoose.connect(uri);
  const result = await verifyIndexes();
  await mongoose.disconnect();
  process.exit(result.ok ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
