/**
 * READ-ONLY diagnostic — why an exam question is/ isn't found by the lesson-block selector.
 *
 * Usage (PowerShell):
 *   $env:MONGO_URI="<uri>"; node backend/scripts/diagnoseExamQuestionSelector.js "sperm"
 *
 * Arg is a case-insensitive regex matched against question text OR topic.
 * Prints stored fields for matches and a comparison row that DOES have a topicKey.
 * Does not modify any data.
 */
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");

const SELECTOR_FIELDS = [
  "_id",
  "status",
  "subject",
  "examBoard",
  "level",
  "topic",
  "topicKey",
  "type",
  "marks",
  "imageUrl",
];

function pick(q) {
  const out = {};
  for (const f of SELECTOR_FIELDS) out[f] = q[f];
  out.assetsCount = Array.isArray(q.assets) ? q.assets.length : 0;
  out.hasImage = Boolean(q.imageUrl || out.assetsCount > 0);
  out.metadataSource = q.metadata && q.metadata.source ? q.metadata.source : null;
  return out;
}

async function run() {
  const uri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  if (!uri) {
    console.error("ERROR: set MONGO_URI (or MONGODB_URI) first.");
    process.exit(1);
  }
  const term = (process.argv[2] || "reproductive").trim();
  await mongoose.connect(uri);

  const rx = new RegExp(term, "i");
  const matches = await ExamQuestion.find({
    $or: [{ question: rx }, { topic: rx }],
  })
    .sort({ updatedAt: -1 })
    .lean();

  console.log(`\n=== Questions matching /${term}/i (${matches.length}) ===`);
  for (const q of matches) {
    console.log(JSON.stringify(pick(q), null, 2));
  }

  // Comparison: an Edexcel question that HAS a namespaced topicKey (would pass the selector topicKey filter).
  const working = await ExamQuestion.findOne({
    examBoard: /edexcel/i,
    topicKey: { $regex: /:/ },
  })
    .sort({ updatedAt: -1 })
    .lean();
  console.log("\n=== Example Edexcel question WITH namespaced topicKey (appears in selector) ===");
  console.log(working ? JSON.stringify(pick(working), null, 2) : "(none found)");

  // Distinct topicKeys for the matched topic — reveals null/empty vs canonical.
  console.log("\n=== topicKey values across matched questions ===");
  const keys = matches.map((q) => q.topicKey);
  console.log(JSON.stringify([...new Set(keys)], null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
