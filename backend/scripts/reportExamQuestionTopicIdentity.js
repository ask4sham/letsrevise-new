/**
 * Dry-run report: ExamQuestion topic identity (topicKey / canonical spec:slug).
 * Does not modify data.
 *
 * Run: node backend/scripts/reportExamQuestionTopicIdentity.js
 *
 * Categories align with repairExamQuestionTopicIdentity.js (safe auto-repair only for unambiguous rows).
 */
require("dotenv").config();
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const { refreshSpecTopicRegistryCache } = require("../utils/specTopicRegistry");
const {
  classifyExamQuestionRow,
  proposeExamQuestionTopicKeyRepair,
} = require("../utils/examQuestionTopicIdentityRepair");

const SAMPLE = 50;

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  await mongoose.connect(uri);
  try {
    await refreshSpecTopicRegistryCache();

    const all = await ExamQuestion.find({}).select("_id topicKey topic subject level status").lean();

    const byCategory = {};
    const samples = {};
    let repairable = 0;

    for (const row of all) {
      const cat = classifyExamQuestionRow(row);
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      if (!samples[cat]) samples[cat] = [];
      if (samples[cat].length < SAMPLE) {
        samples[cat].push({
          id: String(row._id),
          status: row.status,
          topicKey: row.topicKey || "",
          topic: row.topic || "",
          subject: row.subject || "",
        });
      }
      const p = proposeExamQuestionTopicKeyRepair(row);
      const before = row.topicKey != null ? String(row.topicKey).trim() : "";
      if (p && p.nextTopicKey !== before) repairable += 1;
    }

    console.log("=== Exam question topic identity report (dry-run) ===");
    console.log("Total rows:", all.length);
    console.log("Safe auto-repairable (unambiguous):", repairable);
    console.log("\nClassify breakdown:");
    for (const [k, v] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}: ${v}`);
    }
    console.log("\nLegacy categories (summary):");
    console.log("  • missing_topicKey / missing_topicKey_with_label — no or empty topicKey");
    console.log("  • slug_only_topicKey — topicKey has no spec: prefix");
    console.log("  • namespaced_wrong_spec_prefix_repairable — slug invalid for stored prefix but fixable");
    console.log("  • namespaced_invalid_slug_for_prefix — cannot map slug to prefix spec");
    console.log("  • namespaced_spec_subject_mismatch_repairable — subject vs prefix conflict (may need manual review if dual-valid)");
    console.log("  • ok_or_unknown — already namespaced and valid, or no legacy issue detected");

    for (const cat of Object.keys(samples).sort()) {
      if (!samples[cat].length) continue;
      console.log(`\nSample ids [${cat}] (up to ${SAMPLE}):`);
      console.log(JSON.stringify(samples[cat], null, 2));
    }

    console.log("\nNext: node backend/scripts/repairExamQuestionTopicIdentity.js (dry-run)");
    console.log("     node backend/scripts/repairExamQuestionTopicIdentity.js --apply");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
