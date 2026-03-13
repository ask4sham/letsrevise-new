const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Infection and Response";
const TOPIC_NAME = "Antibiotics and painkillers";
const UNIT_KEY = "infection-and-response";
const TOPIC_LABEL = "Antibiotics and painkillers";

const MCQS = [
  { question: "Antibiotics kill:", options: ["Viruses", "Bacteria", "Both viruses and bacteria", "Fungi only"], correctIndex: 1, marks: 1 },
  { question: "Painkillers:", options: ["Kill pathogens", "Relieve pain; do not cure disease", "Cure bacterial infection", "Replace antibiotics"], correctIndex: 1, marks: 1 },
  { question: "Why don't antibiotics work against viruses?", options: ["Viruses are too small", "Viruses reproduce inside cells; antibiotics target bacteria", "Viruses are immune", "Antibiotics are too weak"], correctIndex: 1, marks: 1 },
  { question: "Overuse of antibiotics can lead to:", options: ["Stronger antibiotics", "Antibiotic-resistant bacteria", "Fewer bacteria", "Cure for viruses"], correctIndex: 1, marks: 1 },
  { question: "Penicillin was discovered by:", options: ["Pasteur", "Fleming", "Jenner", "Koch"], correctIndex: 1, marks: 1 },
  { question: "To reduce antibiotic resistance, we should:", options: ["Use antibiotics for colds", "Only use when needed; complete full course", "Use as prevention only", "Double the dose"], correctIndex: 1, marks: 1 },
  { question: "Painkillers treat:", options: ["Cause of disease", "Symptoms such as pain", "Bacterial infection", "Viral infection"], correctIndex: 1, marks: 1 },
  { question: "Antibiotics may work by:", options: ["Killing viruses", "Damaging bacterial cell wall or protein synthesis", "Increasing pain", "Boosting immunity only"], correctIndex: 1, marks: 1 },
  { question: "MRSA is an example of:", options: ["A virus", "Antibiotic-resistant bacteria", "A painkiller", "A vaccine"], correctIndex: 1, marks: 1 },
  { question: "Which should be used for a viral infection?", options: ["Antibiotics", "Painkillers to relieve symptoms; rest; no antibiotic", "Double antibiotics", "Nothing"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is the difference between antibiotics and painkillers?", marks: 2, markScheme: ["Antibiotics kill bacteria; painkillers relieve symptoms (e.g. pain) but do not kill pathogens."] },
  { question: "Why do antibiotics not work against viral infections?", marks: 1, markScheme: ["Antibiotics target bacteria; viruses reproduce inside host cells; different structure."] },
  { question: "What is antibiotic resistance and how can it develop?", marks: 2, markScheme: ["Bacteria mutate; resistant strains survive when antibiotics used; overuse increases resistance."] },
  { question: "Give one way to reduce the development of antibiotic-resistant bacteria.", marks: 1, markScheme: ["Use only when needed; complete full course; avoid overuse."] },
  { question: "Name one antibiotic and who discovered it.", marks: 1, markScheme: ["Penicillin; discovered by Fleming."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
