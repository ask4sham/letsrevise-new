const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Homeostasis";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Homeostasis";

const MCQS = [
  { question: "Homeostasis is:", options: ["Only temperature control", "Maintaining a stable internal environment", "Only blood sugar", "Only water balance"], correctIndex: 1, marks: 1 },
  { question: "What must be kept constant in the body?", options: ["Only pH", "Blood glucose; temperature; water; ion content", "Only oxygen", "Only carbon dioxide"], correctIndex: 1, marks: 1 },
  { question: "Why is homeostasis important?", options: ["To save energy", "Enzymes and cells work best in stable conditions", "To grow faster", "To digest food"], correctIndex: 1, marks: 1 },
  { question: "Which system helps control homeostasis?", options: ["Only digestive", "Nervous and endocrine (hormonal)", "Only circulatory", "Only respiratory"], correctIndex: 1, marks: 1 },
  { question: "Negative feedback:", options: ["Increases changes", "Reverses a change; brings level back to normal", "Stops all control", "Only in plants"], correctIndex: 1, marks: 1 },
  { question: "Receptors detect:", options: ["Only light", "Stimuli (e.g. temperature, glucose level)", "Only sound", "Only pressure"], correctIndex: 1, marks: 1 },
  { question: "Effectors carry out the response and include:", options: ["Only eyes", "Muscles and glands", "Only ears", "Only skin"], correctIndex: 1, marks: 1 },
  { question: "If blood glucose is too high the body:", options: ["Does nothing", "Releases insulin to lower it", "Releases glucagon only", "Stops breathing"], correctIndex: 1, marks: 1 },
  { question: "Body temperature is maintained around:", options: ["25 °C", "37 °C", "50 °C", "20 °C"], correctIndex: 1, marks: 1 },
  { question: "Coordination of homeostasis involves:", options: ["Only the brain", "Receptors; coordination centre; effectors", "Only the heart", "Only the liver"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is homeostasis?", marks: 1, markScheme: ["Maintaining a stable internal environment (e.g. temperature, blood glucose, water)."] },
  { question: "Why is maintaining constant body temperature important?", marks: 2, markScheme: ["Enzymes work best at optimum temperature; too high or low affects function."] },
  { question: "What is negative feedback?", marks: 1, markScheme: ["A change triggers a response that reverses the change; restores normal level."] },
  { question: "Name two things that must be controlled in the body.", marks: 2, markScheme: ["Blood glucose; body temperature; water content; ion content. Any two."] },
  { question: "What is the role of receptors in homeostasis?", marks: 1, markScheme: ["Detect stimuli / changes in the environment or body."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
