const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Bioenergetics";
const TOPIC_NAME = "Respiration";
const UNIT_KEY = "bioenergetics";
const TOPIC_LABEL = "Respiration";

const MCQS = [
  { question: "Respiration is:", options: ["Only in plants", "Exothermic reaction in all living cells; releases energy", "Only in lungs", "Only at night"], correctIndex: 1, marks: 1 },
  { question: "Aerobic respiration uses:", options: ["Only glucose", "Glucose + oxygen", "Only oxygen", "Only water"], correctIndex: 1, marks: 1 },
  { question: "The products of aerobic respiration are:", options: ["Glucose and oxygen", "Carbon dioxide and water", "Only lactic acid", "Only ethanol"], correctIndex: 1, marks: 1 },
  { question: "Energy from respiration is used for:", options: ["Only movement", "Movement; growth; warmth; chemical reactions", "Only digestion", "Only photosynthesis"], correctIndex: 1, marks: 1 },
  { question: "Anaerobic respiration in muscles produces:", options: ["Carbon dioxide and water", "Lactic acid", "Ethanol", "Oxygen"], correctIndex: 1, marks: 1 },
  { question: "Anaerobic respiration in yeast produces:", options: ["Lactic acid", "Ethanol and carbon dioxide", "Only water", "Only oxygen"], correctIndex: 1, marks: 1 },
  { question: "Anaerobic respiration releases:", options: ["More energy than aerobic", "Less energy than aerobic", "Same energy", "No energy"], correctIndex: 1, marks: 1 },
  { question: "Oxygen debt after exercise is when:", options: ["You breathe less", "Lactic acid must be broken down; need extra oxygen", "No lactic acid", "Respiration stops"], correctIndex: 1, marks: 1 },
  { question: "Where does respiration take place?", options: ["Only in lungs", "In mitochondria (and cytoplasm for anaerobic)", "Only in chloroplasts", "Only in nucleus"], correctIndex: 1, marks: 1 },
  { question: "Fermentation in yeast is:", options: ["Aerobic only", "Anaerobic; produces ethanol and CO₂", "Same as muscle anaerobic", "Produces lactic acid"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Write the word equation for aerobic respiration.", marks: 1, markScheme: ["Glucose + oxygen → carbon dioxide + water."] },
  { question: "Why do organisms need to respire?", marks: 2, markScheme: ["To release energy for movement; growth; warmth; chemical reactions."] },
  { question: "What is the difference between aerobic and anaerobic respiration?", marks: 2, markScheme: ["Aerobic uses oxygen; produces CO₂ and water; more energy. Anaerobic no oxygen; less energy; lactic acid (muscles) or ethanol + CO₂ (yeast)."] },
  { question: "What is oxygen debt?", marks: 1, markScheme: ["Extra oxygen needed after exercise to break down lactic acid."] },
  { question: "What does anaerobic respiration in yeast produce?", marks: 1, markScheme: ["Ethanol and carbon dioxide."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
