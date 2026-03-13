const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Blood vessels and blood";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Blood vessels and blood";

const MCQS = [
  { question: "Which component of blood carries oxygen?", options: ["Plasma", "Red blood cells", "White blood cells", "Platelets"], correctIndex: 1, marks: 1 },
  { question: "Why do red blood cells have no nucleus?", options: ["To fight disease", "More space for haemoglobin", "To clot blood", "To carry hormones"], correctIndex: 1, marks: 1 },
  { question: "What is the function of platelets?", options: ["Carry oxygen", "Clotting (clot blood)", "Defence", "Transport nutrients"], correctIndex: 1, marks: 1 },
  { question: "Plasma carries:", options: ["Only oxygen", "Carbon dioxide, nutrients, hormones, waste", "Only red cells", "Only platelets"], correctIndex: 1, marks: 1 },
  { question: "White blood cells are involved in:", options: ["Oxygen transport", "Defence against pathogens", "Clotting only", "Carrying glucose only"], correctIndex: 1, marks: 1 },
  { question: "Which gas does haemoglobin bind to?", options: ["Carbon dioxide", "Oxygen", "Nitrogen", "Water vapour"], correctIndex: 1, marks: 1 },
  { question: "Red blood cells are biconcave to:", options: ["Fight infection", "Increase surface area for gas exchange", "Clot blood", "Produce antibodies"], correctIndex: 1, marks: 1 },
  { question: "Which vessel has the thickest muscular wall?", options: ["Vein", "Capillary", "Artery", "Lymph vessel"], correctIndex: 2, marks: 1 },
  { question: "Capillaries are narrow to:", options: ["Increase pressure", "Slow blood flow; allow exchange", "Carry more blood", "Reduce surface area"], correctIndex: 1, marks: 1 },
  { question: "Antibodies are produced by:", options: ["Red blood cells", "Some white blood cells (lymphocytes)", "Platelets", "Plasma only"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "State the four main components of blood and one function of each.", marks: 4, markScheme: ["Red blood cells: carry oxygen. White blood cells: defence. Platelets: clotting. Plasma: transport."] },
  { question: "How are red blood cells adapted to carry oxygen?", marks: 2, markScheme: ["No nucleus; more haemoglobin; biconcave shape; large surface area."] },
  { question: "What is the role of plasma?", marks: 1, markScheme: ["Transport CO2, nutrients, hormones, waste; carries blood cells."] },
  { question: "Why do arteries have thick elastic walls?", marks: 1, markScheme: ["Withstand high pressure; blood from heart."] },
  { question: "What is the function of platelets?", marks: 1, markScheme: ["Clot blood; prevent excessive bleeding."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
