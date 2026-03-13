/**
 * PR-HARD-3: Sync Mongoose schema indexes to MongoDB (creates missing indexes).
 * Idempotent — safe to run multiple times.
 * Run: node backend/scripts/sync-indexes.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const TopicPastPaper = require("../models/TopicPastPaper");

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/letsrevise";

async function run() {
  await mongoose.connect(uri);
  await TopicFlashcard.syncIndexes();
  console.log("TopicFlashcard indexes synced.");
  await TopicQuizQuestion.syncIndexes();
  console.log("TopicQuizQuestion indexes synced.");
  await TopicPastPaper.syncIndexes();
  console.log("TopicPastPaper indexes synced.");
  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
