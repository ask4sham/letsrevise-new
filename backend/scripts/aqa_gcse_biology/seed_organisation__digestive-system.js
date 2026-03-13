const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Digestive system";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Digestive system";

const MCQS = [
  { question: "Where does digestion begin?", options: ["Stomach", "Mouth", "Small intestine", "Oesophagus"], correctIndex: 1, marks: 1 },
  { question: "What is the role of stomach acid?", options: ["Absorb nutrients", "Kill bacteria and provide optimum pH for protease", "Produce bile", "Absorb water"], correctIndex: 1, marks: 1 },
  { question: "Where are nutrients mainly absorbed into the blood?", options: ["Stomach", "Small intestine", "Large intestine", "Mouth"], correctIndex: 1, marks: 1 },
  { question: "Which organ produces bile?", options: ["Stomach", "Pancreas", "Liver", "Small intestine"], correctIndex: 2, marks: 1 },
  { question: "What is the function of bile?", options: ["Digest protein", "Emulsify fats and neutralise stomach acid", "Absorb glucose", "Produce enzymes"], correctIndex: 1, marks: 1 },
  { question: "Where is amylase produced?", options: ["Stomach only", "Salivary glands and pancreas", "Liver only", "Large intestine"], correctIndex: 1, marks: 1 },
  { question: "What does amylase break down?", options: ["Protein", "Lipids", "Starch", "Cellulose"], correctIndex: 2, marks: 1 },
  { question: "Protease enzymes break down:", options: ["Carbohydrates", "Proteins into amino acids", "Fats only", "Starch"], correctIndex: 1, marks: 1 },
  { question: "Lipase is produced by:", options: ["Stomach", "Pancreas and small intestine", "Mouth only", "Liver"], correctIndex: 1, marks: 1 },
  { question: "What is the main function of the large intestine?", options: ["Digest protein", "Absorb water", "Produce enzymes", "Emulsify fat"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Name the organs of the digestive system in order from mouth to anus.", marks: 2, markScheme: ["Mouth, oesophagus, stomach, small intestine, large intestine; liver/pancreas (release into gut)."] },
  { question: "What is the role of the small intestine?", marks: 2, markScheme: ["Digestion (enzymes); absorption of digested food into blood."] },
  { question: "Why is bile important in fat digestion?", marks: 1, markScheme: ["Emulsifies fats; increases surface area for lipase."] },
  { question: "Where is protease produced and what does it break down?", marks: 2, markScheme: ["Stomach, pancreas, small intestine; proteins into amino acids."] },
  { question: "What is absorption?", marks: 1, markScheme: ["Movement of digested food from intestine into blood."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
