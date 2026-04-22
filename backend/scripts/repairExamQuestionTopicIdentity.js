/**
 * Safe legacy repair: ExamQuestion.topicKey → canonical namespaced spec:slug (metadata only).
 * Does not change question text, marks, mark scheme, or status.
 *
 * Dry-run (default): node backend/scripts/repairExamQuestionTopicIdentity.js
 * Apply:          node backend/scripts/repairExamQuestionTopicIdentity.js --apply
 */
require("dotenv").config();
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const { refreshSpecTopicRegistryCache } = require("../utils/specTopicRegistry");
const {
  proposeExamQuestionTopicKeyRepair,
  classifyExamQuestionRow,
} = require("../utils/examQuestionTopicIdentityRepair");

const SAMPLE = 10;

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  await mongoose.connect(uri);
  try {
    await refreshSpecTopicRegistryCache();

    const rows = await ExamQuestion.find({})
      .select("_id topicKey topic subject level status")
      .lean();

    const repaired = [];
    const skippedAmbiguous = [];
    const skippedInvalid = [];

    for (const row of rows) {
      const before = row.topicKey != null ? String(row.topicKey).trim() : "";
      const proposal = proposeExamQuestionTopicKeyRepair(row);
      const topicLabel = row.topic != null ? String(row.topic).trim() : "";

      if (proposal && proposal.nextTopicKey !== before) {
        if (dryRun) {
          repaired.push({
            id: String(row._id),
            before,
            after: proposal.nextTopicKey,
            rule: proposal.rule,
            status: row.status,
          });
        } else {
          await ExamQuestion.updateOne({ _id: row._id }, { $set: { topicKey: proposal.nextTopicKey } });
          repaired.push({
            id: String(row._id),
            before,
            after: proposal.nextTopicKey,
            rule: proposal.rule,
            status: row.status,
          });
        }
        continue;
      }

      const cat = classifyExamQuestionRow(row);
      if (!before && !topicLabel) {
        skippedInvalid.push({ id: String(row._id), category: cat });
      } else if (cat !== "ok_or_unknown") {
        skippedAmbiguous.push({
          id: String(row._id),
          category: cat,
          topicKey: before || "(empty)",
          topic: topicLabel || "(empty)",
        });
      }
    }

    console.log("=== repairExamQuestionTopicIdentity ===");
    console.log(dryRun ? "Mode: DRY-RUN (no writes). Use --apply to persist." : "Mode: APPLY (writes enabled)");
    console.log("Total ExamQuestion rows:", rows.length);
    console.log("Repaired" + (dryRun ? " (would repair)" : "") + ":", repaired.length);
    console.log("Skipped ambiguous (no safe auto-repair):", skippedAmbiguous.length);
    console.log("Skipped invalid (missing topicKey and no topic label):", skippedInvalid.length);
    console.log("\nSample repaired ids:", repaired.slice(0, SAMPLE).map((r) => r.id));
    console.log("Sample ambiguous ids:", skippedAmbiguous.slice(0, SAMPLE).map((x) => x.id));
    console.log("Sample invalid ids:", skippedInvalid.slice(0, SAMPLE).map((x) => x.id));
    if (repaired.length && dryRun) {
      console.log("\nSample repairs (first 5):");
      console.log(JSON.stringify(repaired.slice(0, 5), null, 2));
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
