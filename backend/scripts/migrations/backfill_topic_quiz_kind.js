/**
 * PR-A1: Backfill kind and recompute fingerprint for existing TopicQuizQuestion docs.
 * Fingerprint now includes kind: "${kind}||${normQ}||${normChoices}||${correctIndex}"
 * Run once: node backend/scripts/migrations/backfill_topic_quiz_kind.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const TopicQuizQuestion = require("../../models/TopicQuizQuestion");
const { fingerprint } = require("../../utils/quizDedupe");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/letsrevise");
  const cursor = TopicQuizQuestion.find({}).cursor();
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for await (const doc of cursor) {
    try {
      const k = doc.kind && ["quiz", "assessment"].includes(String(doc.kind).toLowerCase())
        ? String(doc.kind).toLowerCase()
        : "quiz";
      const newFp = fingerprint(
        doc.questionText || "",
        doc.choices || [],
        doc.correctIndex ?? 0,
        k
      );
      const needsUpdate = !doc.kind || doc.fingerprint !== newFp;
      if (!needsUpdate) {
        skipped += 1;
        continue;
      }
      const update = { kind: k, fingerprint: newFp };
      const result = await TopicQuizQuestion.updateOne(
        { _id: doc._id },
        { $set: update }
      );
      if (result.modifiedCount > 0) updated += 1;
      if (updated % 100 === 0) process.stdout.write(".");
    } catch (e) {
      if (e.code === 11000) {
        console.warn(`\nDuplicate fingerprint for ${doc._id}, skipping`);
        skipped += 1;
      } else {
        errors += 1;
        console.error(`\nError updating ${doc._id}:`, e.message);
      }
    }
  }

  console.log(`\nBackfill complete. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
