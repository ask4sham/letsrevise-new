const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Transport summary and applications";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Transport summary and applications";

const MCQS = [
  { question: "Which process does NOT require energy from respiration?", options: ["Active transport", "Diffusion", "Pumping ions", "None of these"], correctIndex: 1, marks: 1 },
  { question: "Water is absorbed by plant roots mainly by:", options: ["Active transport only", "Osmosis", "Diffusion only", "Pumping"], correctIndex: 1, marks: 1 },
  { question: "Mineral ions from dilute soil are often absorbed by roots using:", options: ["Diffusion only", "Osmosis only", "Active transport", "No process"], correctIndex: 2, marks: 1 },
  { question: "Which process moves particles from high to low concentration?", options: ["Active transport", "Diffusion", "Both", "Neither"], correctIndex: 1, marks: 1 },
  { question: "Osmosis is the movement of:", options: ["Any solute", "Water across a partially permeable membrane", "Ions only", "Glucose only"], correctIndex: 1, marks: 1 },
  { question: "When would a cell use active transport?", options: ["To move oxygen in", "To move a substance from low to high concentration", "To move water by osmosis", "Never"], correctIndex: 1, marks: 1 },
  { question: "Which is a passive process?", options: ["Active transport", "Diffusion", "Ion pumping", "All need energy"], correctIndex: 1, marks: 1 },
  { question: "Application: why might athletes need more glucose absorbed in the gut?", options: ["They don't", "Energy for muscles; may need active transport when gut concentration is low", "To store only", "To lose weight"], correctIndex: 1, marks: 1 },
  { question: "In plants, sugar may be moved into cells by active transport when:", options: ["Concentration is equal", "External concentration is lower", "Only by diffusion", "Never"], correctIndex: 1, marks: 1 },
  { question: "Summary: which two processes are passive (no energy)?", options: ["Diffusion and active transport", "Diffusion and osmosis", "Osmosis and active transport only", "None"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Compare diffusion and active transport (direction and energy).", marks: 2, markScheme: ["Diffusion: high to low, no energy. Active transport: low to high / against gradient, needs energy."] },
  { question: "Give one real-world application where active transport is important.", marks: 2, markScheme: ["Root uptake of mineral ions; gut absorption of glucose/sugars; kidney reabsorption. Any one explained."] },
  { question: "Why might root hair cells have many mitochondria?", marks: 1, markScheme: ["Active transport of mineral ions requires energy from respiration."] },
  { question: "State the three main ways substances can move in and out of cells.", marks: 1, markScheme: ["Diffusion; osmosis; active transport."] },
  { question: "When would osmosis occur rather than diffusion?", marks: 1, markScheme: ["When water moves and there is a partially permeable membrane."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
