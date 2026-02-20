const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Diffusion";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Diffusion";

const MCQS = [
  { question: "What is diffusion?", options: ["Movement of water only", "Net movement of particles from high to low concentration", "Movement requiring energy", "Movement against concentration gradient"], correctIndex: 1, marks: 1 },
  { question: "Diffusion is a process that:", options: ["Requires energy from respiration", "Does not require energy", "Only happens in plants", "Only happens in liquids"], correctIndex: 1, marks: 1 },
  { question: "Where does gas exchange by diffusion occur in the lungs?", options: ["In the trachea", "In the alveoli", "In the bronchi", "In the diaphragm"], correctIndex: 1, marks: 1 },
  { question: "Particles move in diffusion from:", options: ["Low to high concentration", "High to low concentration", "Equal concentration only", "No movement"], correctIndex: 1, marks: 1 },
  { question: "Which factor increases the rate of diffusion?", options: ["Smaller surface area", "Higher temperature", "Larger distance", "Lower concentration gradient"], correctIndex: 1, marks: 1 },
  { question: "Oxygen enters cells by diffusion. Why?", options: ["Cells make oxygen", "Concentration is higher outside", "Cells use energy to pull it in", "Oxygen is pumped in"], correctIndex: 1, marks: 1 },
  { question: "What type of membrane allows diffusion?", options: ["Fully impermeable", "Partially permeable", "Only thick membranes", "No membrane"], correctIndex: 1, marks: 1 },
  { question: "Carbon dioxide leaves respiring cells by diffusion because:", options: ["Concentration is higher inside the cell", "It is pumped out", "Concentration is lower inside", "Cells block it"], correctIndex: 0, marks: 1 },
  { question: "Diffusion eventually results in:", options: ["No particles left", "Equal concentration everywhere (equilibrium)", "All particles on one side", "Particles only outside"], correctIndex: 1, marks: 1 },
  { question: "Which substance can diffuse into leaves through stomata?", options: ["Sucrose only", "Carbon dioxide", "Starch only", "Protein only"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is diffusion?", marks: 1, markScheme: ["Net movement of particles from high to low concentration."] },
  { question: "State two factors that increase the rate of diffusion.", marks: 2, markScheme: ["Higher temperature; steeper concentration gradient; larger surface area; shorter distance. Any two."] },
  { question: "Why does diffusion not require energy?", marks: 1, markScheme: ["Particles move down concentration gradient / passive process."] },
  { question: "Where does diffusion of oxygen and carbon dioxide occur in the human gas exchange system?", marks: 1, markScheme: ["Alveoli / alveolus."] },
  { question: "What is meant by equilibrium in diffusion?", marks: 1, markScheme: ["Concentration equal on both sides / no net movement."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
