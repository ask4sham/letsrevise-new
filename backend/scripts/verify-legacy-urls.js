/**
 * Verification script: count documents with legacy relative image URLs.
 * Run before and after migration to confirm cleanup.
 *
 * Usage: node scripts/verify-legacy-urls.js
 */
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
}
const mongoose = require("mongoose");

async function run() {
  const uri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  if (!uri) {
    console.error("ERROR: MONGO_URI or MONGODB_URI required.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const lessons = db.collection("lessons");
  const templates = db.collection("templates");

  // Legacy relative paths: /uploads/, /visuals/, /content/ (and variants without leading slash)
  const lessonQueries = [
    { content: { $regex: /\]\(\s*\/?(uploads|visuals|content)\// } },
    { uploadedImages: { $regex: /^\/(uploads|visuals|content)\// } },
    { "pages.blocks.content": { $regex: /\]\(\s*\/?(uploads|visuals|content)\// } },
    { "pages.blocks.imageUrl": { $regex: /^\/(uploads|visuals|content)\// } },
    { "pages.hero.src": { $regex: /^\/(uploads|visuals|content)\// } },
  ];

  const lessonCount = await lessons.countDocuments({ $or: lessonQueries });
  const templateCount = await templates.countDocuments({
    "pages.blocks.content": { $regex: /\]\(\s*\/?(uploads|visuals|content)\// },
  });

  console.log("=== Legacy URL Verification ===");
  console.log("Lessons with legacy URLs:", lessonCount);
  console.log("Templates with legacy URLs:", templateCount);
  console.log("Total documents with legacy URLs:", lessonCount + templateCount);

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
