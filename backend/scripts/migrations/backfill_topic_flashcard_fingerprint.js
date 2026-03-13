/**
 * PR-FLOW-4: Backfill fingerprint for existing TopicFlashcard docs.
 * Run once: node backend/scripts/migrations/backfill_topic_flashcard_fingerprint.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const TopicFlashcard = require("../../models/TopicFlashcard");
const { fingerprint } = require("../../utils/flashcardDedupe");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/letsrevise");
  const cursor = TopicFlashcard.find({ $or: [{ fingerprint: { $exists: false } }, { fingerprint: "" }] }).cursor();
  let updated = 0;
  for await (const doc of cursor) {
    const fp = fingerprint(doc.front, doc.back);
    await TopicFlashcard.updateOne({ _id: doc._id }, { $set: { fingerprint: fp } });
    updated += 1;
    if (updated % 100 === 0) process.stdout.write(`.`);
  }
  console.log(`\nBackfilled fingerprint for ${updated} documents.`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
