const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Active transport";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Active transport";

const MCQS = [
  { question: "What is active transport?", options: ["Movement down concentration gradient", "Movement against concentration gradient using energy", "Movement of water only", "Same as diffusion"], correctIndex: 1, marks: 1 },
  { question: "Active transport requires energy from:", options: ["Light", "Respiration", "Diffusion", "Osmosis"], correctIndex: 1, marks: 1 },
  { question: "Where might root hair cells use active transport?", options: ["To absorb water only", "To absorb mineral ions from dilute soil solution", "To absorb sugar only", "To lose ions"], correctIndex: 1, marks: 1 },
  { question: "How does active transport differ from diffusion?", options: ["It doesn't", "It moves against gradient and needs energy", "It is faster only", "It only happens in plants"], correctIndex: 1, marks: 1 },
  { question: "Which process can move ions from a dilute solution into a cell?", options: ["Diffusion only", "Osmosis only", "Active transport", "None"], correctIndex: 2, marks: 1 },
  { question: "Why do gut cells use active transport to absorb some nutrients?", options: ["They don't", "To absorb from lower concentration in gut into higher in blood", "To save energy", "To slow absorption"], correctIndex: 1, marks: 1 },
  { question: "Mitochondria are important in cells that carry out lots of active transport because:", options: ["They make protein", "They release energy in respiration", "They make glucose", "They store water"], correctIndex: 1, marks: 1 },
  { question: "Active transport can move substances:", options: ["Only from high to low concentration", "Against the concentration gradient", "Only in one direction forever", "Only in plants"], correctIndex: 1, marks: 1 },
  { question: "Which is an example of active transport?", options: ["Oxygen into blood in lungs", "Glucose absorption in gut when concentration in gut is lower", "Water into roots by osmosis", "Carbon dioxide out of cells"], correctIndex: 1, marks: 1 },
  { question: "What happens if a cell is deprived of oxygen for active transport?", options: ["It speeds up", "Less respiration, less ATP, active transport may slow or stop", "Nothing", "Only diffusion affected"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is active transport?", marks: 2, markScheme: ["Movement of substances against concentration gradient; requires energy (from respiration)."] },
  { question: "Give one example where active transport is used in plants.", marks: 1, markScheme: ["Root hair cells absorbing mineral ions from dilute soil solution."] },
  { question: "Why does active transport require energy?", marks: 1, markScheme: ["Moving against concentration gradient / needs ATP from respiration."] },
  { question: "Give one example of active transport in humans.", marks: 1, markScheme: ["Absorption of glucose/sugars or ions in gut when concentration in gut is lower than in blood."] },
  { question: "How is active transport different from diffusion?", marks: 2, markScheme: ["Active transport: against gradient, needs energy. Diffusion: down gradient, no energy."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
