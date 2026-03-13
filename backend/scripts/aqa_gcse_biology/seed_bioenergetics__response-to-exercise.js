const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Bioenergetics";
const TOPIC_NAME = "Response to exercise";
const UNIT_KEY = "bioenergetics";
const TOPIC_LABEL = "Response to exercise";

const MCQS = [
  { question: "During exercise the heart rate increases to:", options: ["Slow down", "Supply more oxygen and glucose to muscles", "Reduce breathing", "Store energy"], correctIndex: 1, marks: 1 },
  { question: "Breathing rate increases during exercise because:", options: ["Lungs shrink", "More oxygen needed; more CO₂ to remove", "To cool down only", "To digest food"], correctIndex: 1, marks: 1 },
  { question: "Muscles need more energy during exercise for:", options: ["Resting", "Contraction", "Only repair", "Only growth"], correctIndex: 1, marks: 1 },
  { question: "If muscles cannot get enough oxygen they may respire:", options: ["Aerobically only", "Anaerobically; produce lactic acid", "Not at all", "Only in mitochondria"], correctIndex: 1, marks: 1 },
  { question: "Lactic acid buildup can cause:", options: ["Strength", "Muscle fatigue / cramp", "More oxygen", "Less CO₂"], correctIndex: 1, marks: 1 },
  { question: "After exercise, breathing rate stays high to:", options: ["Cool down only", "Repay oxygen debt; break down lactic acid", "Stop respiration", "Store glucose"], correctIndex: 1, marks: 1 },
  { question: "Glycogen stores in muscles are used for:", options: ["Structure", "Respiration during exercise", "Only insulation", "Only transport"], correctIndex: 1, marks: 1 },
  { question: "Stroke volume is:", options: ["Number of heart beats", "Volume of blood pumped per beat", "Breathing rate", "Lung capacity"], correctIndex: 1, marks: 1 },
  { question: "Fitness can be measured by:", options: ["Height only", "Resting heart rate; recovery time; peak flow", "Weight only", "Age only"], correctIndex: 1, marks: 1 },
  { question: "Why does heart rate increase when you start exercising?", options: ["To save energy", "To deliver more oxygen and glucose to muscles", "To reduce blood flow", "To store lactic acid"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Why do heart rate and breathing rate increase during exercise?", marks: 2, markScheme: ["Muscles need more oxygen and glucose for respiration; need to remove more CO₂; heart pumps more blood; lungs take in more air."] },
  { question: "What is oxygen debt?", marks: 1, markScheme: ["Extra oxygen needed after exercise to break down lactic acid."] },
  { question: "Why might lactic acid build up in muscles?", marks: 2, markScheme: ["During vigorous exercise muscles may not get enough oxygen; anaerobic respiration produces lactic acid."] },
  { question: "Give one way fitness can be measured.", marks: 1, markScheme: ["Resting heart rate; recovery time after exercise; peak flow."] },
  { question: "What happens to breathing rate after exercise and why?", marks: 1, markScheme: ["Stays high then gradually falls; to repay oxygen debt / break down lactic acid."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
