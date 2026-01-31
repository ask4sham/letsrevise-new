/**
 * Inspect the Lesson schema requirements/enums so our Gold Template seed matches exactly.
 *
 * Run:
 *   node backend/scripts/inspectLessonSchema.js
 */

const mongoose = require("mongoose");
const path = require("path");

// Load backend/.env explicitly so MONGO_URI is available
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const Lesson = require("../models/Lesson");

function safeEnum(pathObj) {
  try {
    return pathObj?.enumValues || [];
  } catch {
    return [];
  }
}

function listRequiredPaths(schema) {
  const required = [];
  for (const [key, p] of Object.entries(schema.paths)) {
    if (key.startsWith("__")) continue;

    const opt = p?.options || {};
    const isReq =
      opt.required === true ||
      (Array.isArray(opt.required) && opt.required[0] === true);

    if (isReq) required.push(key);
  }
  return required.sort();
}

function describeSubSchema(title, schema) {
  console.log(`\n=== ${title} ===`);
  console.log("Required paths:", listRequiredPaths(schema));
  console.log("All paths:", Object.keys(schema.paths).sort());
}

async function main() {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URL ||
    "";

  if (!uri || !uri.startsWith("mongodb")) {
    console.error("❌ Could not find Mongo URI in env (MONGO_URI/MONGODB_URI).");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("✅ Connected to MongoDB.");

  // Top-level
  describeSubSchema("Lesson (top-level)", Lesson.schema);

  // status enum
  const statusPath = Lesson.schema.path("status");
  if (statusPath) {
    console.log("\nstatus enumValues:", safeEnum(statusPath));
  }

  // pages[]
  const pagesPath = Lesson.schema.path("pages");
  if (pagesPath?.schema) {
    describeSubSchema("Lesson.pages[] (subdocument schema)", pagesPath.schema);

    const blocksPath = pagesPath.schema.path("blocks");
    if (blocksPath?.schema) {
      describeSubSchema(
        "Lesson.pages[].blocks[] (subdocument schema)",
        blocksPath.schema
      );

      const blockTypePath = blocksPath.schema.path("type");
      if (blockTypePath) {
        console.log("\nblocks[].type enumValues:", safeEnum(blockTypePath));
      }
    }
  } else {
    console.log("\nNo sub-schema detected for `pages` (may be Mixed).");
  }

  await mongoose.disconnect();
  console.log("\n✅ Done.");
}

main().catch((e) => {
  console.error("❌ Script crashed:", e);
  process.exit(1);
});
