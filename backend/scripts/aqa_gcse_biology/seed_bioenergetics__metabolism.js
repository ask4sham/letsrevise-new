const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Bioenergetics";
const TOPIC_NAME = "Metabolism";
const UNIT_KEY = "bioenergetics";
const TOPIC_LABEL = "Metabolism";

const MCQS = [
  { question: "Metabolism is:", options: ["Only digestion", "Sum of all chemical reactions in the body", "Only respiration", "Only photosynthesis"], correctIndex: 1, marks: 1 },
  { question: "Energy for metabolic reactions comes from:", options: ["Only food", "Respiration", "Only sunlight", "Only water"], correctIndex: 1, marks: 1 },
  { question: "Glucose can be converted to:", options: ["Only CO₂", "Starch; cellulose; used in respiration", "Only oxygen", "Only protein"], correctIndex: 1, marks: 1 },
  { question: "Lipids can be made from:", options: ["Only fatty acids", "Glycerol and fatty acids", "Only glucose", "Only protein"], correctIndex: 1, marks: 1 },
  { question: "Amino acids come from:", options: ["Only respiration", "Diet; breakdown of proteins", "Only starch", "Only lipids"], correctIndex: 1, marks: 1 },
  { question: "Excess protein can be converted to:", options: ["Starch", "Urea and excreted", "Glucose only", "Oxygen"], correctIndex: 1, marks: 1 },
  { question: "Respiration is a metabolic reaction that:", options: ["Uses energy", "Releases energy", "Only makes glucose", "Only in plants"], correctIndex: 1, marks: 1 },
  { question: "Enzymes in metabolism:", options: ["Stop reactions", "Catalyse (speed up) reactions", "Only digest food", "Only in liver"], correctIndex: 1, marks: 1 },
  { question: "Glycogen is:", options: ["A protein", "Storage carbohydrate in animals", "A lipid", "Only in plants"], correctIndex: 1, marks: 1 },
  { question: "The liver is involved in metabolism by:", options: ["Only making bile", "Breaking down toxins; converting excess amino acids to urea", "Only storing glucose", "Only making enzymes"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is metabolism?", marks: 1, markScheme: ["Sum of all chemical reactions in the body / cell."] },
  { question: "Give two examples of metabolic reactions.", marks: 2, markScheme: ["Respiration; photosynthesis; conversion of glucose to starch; protein synthesis; breakdown of excess protein to urea. Any two."] },
  { question: "Where does the energy for metabolic reactions come from?", marks: 1, markScheme: ["Respiration (releases energy from glucose)."] },
  { question: "What happens to excess amino acids?", marks: 2, markScheme: ["Broken down in liver; converted to urea; excreted in urine."] },
  { question: "Name one substance that can be synthesised from glucose.", marks: 1, markScheme: ["Starch; cellulose; (in plants). Glycogen (in animals)."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
