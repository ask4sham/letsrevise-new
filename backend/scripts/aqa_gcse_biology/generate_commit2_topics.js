/**
 * One-off generator for Commit 2 topic scripts. Run: node scripts/aqa_gcse_biology/generate_commit2_topics.js
 * Reads taxonomy and creates seed_<unitKey>__<topicKey>.js for each topic in Organisation (already done),
 * Infection and Response, Bioenergetics, Homeostasis, Inheritance, Ecology.
 * Each file has 10 MCQ + 5 short with placeholder content (replace with real questions later if needed).
 */
const path = require("path");
const fs = require("fs");

const taxonomyPath = path.resolve(__dirname, "..", "..", "config", "aqa_gcse_biology_topics.json");
const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));

function slug(s) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function topicTemplate(unitName, topicName, unitKey, topicKey) {
  return `const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = ${JSON.stringify(unitName)};
const TOPIC_NAME = ${JSON.stringify(topicName)};
const UNIT_KEY = ${JSON.stringify(unitKey)};
const TOPIC_LABEL = ${JSON.stringify(topicName)};

const MCQS = [
  { question: "Placeholder Q1 for ${topicName}?", options: ["A", "B", "C", "D"], correctIndex: 0, marks: 1 },
  { question: "Placeholder Q2?", options: ["A", "B", "C", "D"], correctIndex: 1, marks: 1 },
  { question: "Placeholder Q3?", options: ["A", "B", "C", "D"], correctIndex: 2, marks: 1 },
  { question: "Placeholder Q4?", options: ["A", "B", "C", "D"], correctIndex: 3, marks: 1 },
  { question: "Placeholder Q5?", options: ["A", "B", "C", "D"], correctIndex: 0, marks: 1 },
  { question: "Placeholder Q6?", options: ["A", "B", "C", "D"], correctIndex: 1, marks: 1 },
  { question: "Placeholder Q7?", options: ["A", "B", "C", "D"], correctIndex: 2, marks: 1 },
  { question: "Placeholder Q8?", options: ["A", "B", "C", "D"], correctIndex: 3, marks: 1 },
  { question: "Placeholder Q9?", options: ["A", "B", "C", "D"], correctIndex: 0, marks: 1 },
  { question: "Placeholder Q10?", options: ["A", "B", "C", "D"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Placeholder short 1?", marks: 1, markScheme: ["Accept any reasonable answer."] },
  { question: "Placeholder short 2?", marks: 2, markScheme: ["Point 1.", "Point 2."] },
  { question: "Placeholder short 3?", marks: 2, markScheme: ["Point 1.", "Point 2."] },
  { question: "Placeholder short 4?", marks: 1, markScheme: ["Accept any reasonable answer."] },
  { question: "Placeholder short 5?", marks: 2, markScheme: ["Point 1.", "Point 2."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, {
    unitName: UNIT_NAME,
    topicName: TOPIC_NAME,
    unitKey: UNIT_KEY,
    topicLabel: TOPIC_LABEL,
    mcqs: MCQS,
    shortAnswer: SHORT_ANSWER,
  });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
`;
}

// Skip Cell Biology and Organisation (already have real content). Generate for: Infection, Bioenergetics, Homeostasis, Inheritance, Ecology.
const SKIP_UNITS = ["Cell Biology", "Organisation"];
let generated = 0;
for (const unit of taxonomy.units) {
  if (SKIP_UNITS.includes(unit.unit)) continue;
  const unitKey = slug(unit.unit);
  for (const topic of unit.topics) {
    const topicKey = topic.key;
    const fileName = `seed_${unitKey}__${topicKey}.js`;
    const filePath = path.join(__dirname, fileName);
    if (fs.existsSync(filePath)) continue;
    fs.writeFileSync(filePath, topicTemplate(unit.unit, topic.topic, unitKey, topicKey), "utf8");
    generated++;
    console.log("Created", fileName);
  }
}
console.log("Generated", generated, "topic scripts.");
