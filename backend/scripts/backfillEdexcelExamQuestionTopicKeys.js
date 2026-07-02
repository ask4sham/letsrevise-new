/**
 * Backfill canonical topicKey for legacy Edexcel exam questions.
 *
 * Some Edexcel IGCSE questions were created before the taxonomy dropdown fix and
 * have correct free-text `topic` but a missing/mismatched `topicKey`. The lesson
 * block selector filters by topicKey, so these never appear.
 *
 * DRY-RUN by default — reports what WOULD change. Apply with `--apply`.
 *
 * Usage (PowerShell):
 *   $env:MONGO_URI="<uri>"; node backend/scripts/backfillEdexcelExamQuestionTopicKeys.js
 *   $env:MONGO_URI="<uri>"; node backend/scripts/backfillEdexcelExamQuestionTopicKeys.js --apply
 */
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");
const { getEdexcelIgcseBiologyTopics } = require("../utils/topicTaxonomy");
const { normaliseTopicText } = require("../utils/examQuestionTopicSelectorMatch");

/** Flatten taxonomy leaves → Map<normalisedTitle, canonicalTopicKey>. */
function buildTitleToKeyMap() {
  const map = new Map();
  const taxonomy = getEdexcelIgcseBiologyTopics();
  for (const u of taxonomy.units || []) {
    const addLeaf = (t) => {
      if (!t || !t.topic || !t.topicKey) return;
      const norm = normaliseTopicText(t.topic);
      if (norm && !map.has(norm)) map.set(norm, t.topicKey);
    };
    (u.topics || []).forEach(addLeaf);
    (u.sections || []).forEach((sec) => (sec.topics || []).forEach(addLeaf));
  }
  return map;
}

async function run() {
  const uri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  if (!uri) {
    console.error("ERROR: set MONGO_URI (or MONGODB_URI) first.");
    process.exit(1);
  }
  const apply = process.argv.includes("--apply");
  await mongoose.connect(uri);

  const titleToKey = buildTitleToKeyMap();

  // Edexcel-flavoured questions: examBoard Edexcel OR already-namespaced Edexcel topicKey.
  const questions = await ExamQuestion.find({
    $or: [
      { examBoard: { $regex: /edexcel/i } },
      { topicKey: { $regex: /^edexcel-igcse-biology:/i } },
    ],
  })
    .select("_id topic topicKey examBoard level status")
    .lean();

  const changes = [];
  for (const q of questions) {
    const norm = normaliseTopicText(q.topic);
    if (!norm) continue;
    const canonical = titleToKey.get(norm);
    if (!canonical) continue; // topic text not a known Edexcel topic — skip (safe)
    const current = String(q.topicKey || "").trim();
    if (current === canonical) continue; // already correct
    changes.push({ _id: String(q._id), topic: q.topic, from: current || "(none)", to: canonical });
  }

  console.log(`\nEdexcel exam questions scanned: ${questions.length}`);
  console.log(`Questions needing topicKey backfill: ${changes.length}\n`);
  for (const c of changes) {
    console.log(`  ${c._id}  "${c.topic}"\n    ${c.from}  ->  ${c.to}`);
  }

  if (!apply) {
    console.log(`\nDRY-RUN only. Re-run with --apply to write ${changes.length} update(s).`);
    await mongoose.disconnect();
    process.exit(0);
  }

  let updated = 0;
  for (const c of changes) {
    await ExamQuestion.updateOne({ _id: c._id }, { $set: { topicKey: c.to } });
    updated += 1;
  }
  console.log(`\nApplied ${updated} update(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
