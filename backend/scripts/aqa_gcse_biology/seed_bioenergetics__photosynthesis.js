const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Bioenergetics";
const TOPIC_NAME = "Photosynthesis";
const UNIT_KEY = "bioenergetics";
const TOPIC_LABEL = "Photosynthesis";

const MCQS = [
  { question: "The word equation for photosynthesis is:", options: ["Glucose + oxygen → carbon dioxide + water", "Carbon dioxide + water → glucose + oxygen (light)", "Oxygen + water → glucose", "Glucose → carbon dioxide"], correctIndex: 1, marks: 1 },
  { question: "Photosynthesis happens in:", options: ["Roots", "Chloroplasts (mainly in leaves)", "Flowers", "Stems only"], correctIndex: 1, marks: 1 },
  { question: "Which gas is absorbed during photosynthesis?", options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], correctIndex: 1, marks: 1 },
  { question: "Light energy is absorbed by:", options: ["Roots", "Chlorophyll", "Xylem", "Phloem"], correctIndex: 1, marks: 1 },
  { question: "Limiting factors for photosynthesis include:", options: ["Only light", "Light intensity; CO₂ concentration; temperature", "Only water", "Only soil"], correctIndex: 1, marks: 1 },
  { question: "At night photosynthesis:", options: ["Increases", "Stops (no light)", "Only in roots", "Produces more glucose"], correctIndex: 1, marks: 1 },
  { question: "Glucose from photosynthesis can be used for:", options: ["Only respiration", "Respiration; stored as starch; make cellulose; make proteins", "Only growth", "Only flowers"], correctIndex: 1, marks: 1 },
  { question: "Leaves are adapted for photosynthesis by having:", options: ["No chlorophyll", "Large surface area; thin; chlorophyll; veins", "No stomata", "No air spaces"], correctIndex: 1, marks: 1 },
  { question: "The rate of photosynthesis can be measured by:", options: ["Only counting leaves", "Oxygen produced; or rate of uptake of CO₂", "Only weighing roots", "Only measuring height"], correctIndex: 1, marks: 1 },
  { question: "When light intensity increases (up to a point), the rate of photosynthesis:", options: ["Decreases", "Increases", "Stays zero", "Only in water plants"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Write the word equation for photosynthesis.", marks: 1, markScheme: ["Carbon dioxide + water → glucose + oxygen (in presence of light and chlorophyll)."] },
  { question: "Where does photosynthesis take place and what absorbs the light?", marks: 2, markScheme: ["Chloroplasts (in leaves); chlorophyll absorbs light."] },
  { question: "Name two limiting factors for photosynthesis.", marks: 2, markScheme: ["Light intensity; carbon dioxide concentration; temperature. Any two."] },
  { question: "How might a leaf be adapted for photosynthesis?", marks: 2, markScheme: ["Large surface area; thin; contains chlorophyll; stomata for gas exchange; veins for transport."] },
  { question: "Give one use of glucose produced in photosynthesis.", marks: 1, markScheme: ["Respiration; stored as starch; make cellulose; make proteins."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
