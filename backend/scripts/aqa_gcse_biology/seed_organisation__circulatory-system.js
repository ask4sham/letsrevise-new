const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Circulatory system";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Circulatory system";

const MCQS = [
  { question: "What is the function of the circulatory system?", options: ["Digestion", "Transport oxygen, nutrients and waste", "Breathing only", "Support"], correctIndex: 1, marks: 1 },
  { question: "Which vessel carries blood away from the heart?", options: ["Vein", "Artery", "Capillary", "Bronchus"], correctIndex: 1, marks: 1 },
  { question: "Which vessel has the thinnest walls?", options: ["Artery", "Vein", "Capillary", "Aorta"], correctIndex: 2, marks: 1 },
  { question: "Arteries carry blood:", options: ["At low pressure", "Away from the heart (usually oxygenated)", "Only to the lungs", "At zero pressure"], correctIndex: 1, marks: 1 },
  { question: "Veins have valves to:", options: ["Stop blood flowing", "Prevent backflow", "Increase pressure", "Warm blood"], correctIndex: 1, marks: 1 },
  { question: "Where does gas exchange occur between blood and tissues?", options: ["Arteries", "Veins", "Capillaries", "Heart"], correctIndex: 2, marks: 1 },
  { question: "What is the double circulatory system?", options: ["Blood passes through heart once per circuit", "Blood passes through heart twice per circuit", "Two hearts", "Blood in two vessels only"], correctIndex: 1, marks: 1 },
  { question: "Which side of the heart pumps blood to the lungs?", options: ["Left", "Right", "Both", "Neither"], correctIndex: 1, marks: 1 },
  { question: "Oxygenated blood returns from the lungs to the:", options: ["Right atrium", "Left atrium", "Right ventricle", "Vena cava"], correctIndex: 1, marks: 1 },
  { question: "The aorta carries blood from:", options: ["Lungs", "Left ventricle to body", "Right ventricle", "Right atrium"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "State the function of the circulatory system.", marks: 1, markScheme: ["Transport oxygen, nutrients, hormones, waste; defend against disease."] },
  { question: "Give one way arteries are adapted for their function.", marks: 2, markScheme: ["Thick muscular/elastic walls; withstand high pressure; carry blood away from heart."] },
  { question: "Why do capillaries have thin walls?", marks: 1, markScheme: ["Short diffusion distance for exchange with tissues."] },
  { question: "What is double circulation?", marks: 2, markScheme: ["Blood passes through heart twice per circuit; pulmonary and systemic."] },
  { question: "Why do veins have valves?", marks: 1, markScheme: ["Prevent backflow; low pressure."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
