/**
 * PR-CHEM-3: Optional migration — prefix legacy topicKey (no ':') with aqa-gcse-biology:
 * Log-only by default; use --apply to perform updates.
 * Run from project root: node backend/scripts/migrate-topicKeys-to-namespaced.js [--apply]
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");

const DEFAULT_SPEC_LEGACY = "aqa-gcse-biology";

function hasColon(val) {
  return val != null && String(val).trim().indexOf(":") !== -1;
}

async function run() {
  const apply = process.argv.includes("--apply");
  if (apply) {
    console.log("Running with --apply: legacy topicKeys will be updated.");
  } else {
    console.log("Dry run (log only). Use --apply to update documents.");
  }

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/letsrevise";
  await mongoose.connect(uri);

  const collections = [
    { name: "topicflashcards", model: require("../models/TopicFlashcard") },
    { name: "topicquizquestions", model: require("../models/TopicQuizQuestion") },
    { name: "topicpastpapers", model: require("../models/TopicPastPaper") },
    { name: "examquestions", model: require("../models/ExamQuestion") },
  ];

  let totalWouldUpdate = 0;
  let totalUpdated = 0;

  for (const { name, model } of collections) {
    const legacy = await model.find({ topicKey: { $exists: true, $regex: /^[^:]*$/, $ne: "" } }).lean();
    const count = legacy.length;
    totalWouldUpdate += count;
    if (count === 0) {
      console.log(`[${name}] No legacy topicKeys.`);
      continue;
    }
    console.log(`[${name}] ${count} document(s) with legacy topicKey.`);
    if (count > 0 && count <= 3) {
      legacy.forEach((d) => console.log(`  - _id=${d._id} topicKey=${d.topicKey}`));
    } else if (count > 3) {
      legacy.slice(0, 2).forEach((d) => console.log(`  - _id=${d._id} topicKey=${d.topicKey}`));
      console.log(`  ... and ${count - 2} more`);
    }

    if (apply && count > 0) {
      let updated = 0;
      for (const doc of legacy) {
        const current = doc.topicKey;
        if (!current || hasColon(current)) continue;
        const newKey = `${DEFAULT_SPEC_LEGACY}:${current.trim()}`;
        const result = await model.updateOne({ _id: doc._id }, { $set: { topicKey: newKey } });
        if (result.modifiedCount > 0) updated += 1;
      }
      totalUpdated += updated;
      console.log(`[${name}] Updated ${updated} document(s).`);
    }
  }

  console.log("");
  if (!apply) {
    console.log(`Total documents that would be updated: ${totalWouldUpdate}. Run with --apply to update.`);
  } else {
    console.log(`Total documents updated: ${totalUpdated}.`);
  }

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
