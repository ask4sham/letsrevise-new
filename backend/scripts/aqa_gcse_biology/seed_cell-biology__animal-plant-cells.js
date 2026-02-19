const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Animal and plant cells";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Animal and plant cells";

const MCQS = [
  { question: "Which structure is found in plant cells but not in animal cells?", options: ["Mitochondria", "Chloroplast", "Ribosome", "Cell membrane"], correctIndex: 1, marks: 1 },
  { question: "What is the function of the permanent vacuole in plant cells?", options: ["Protein synthesis", "Store cell sap and maintain turgor", "Respiration", "Contain DNA"], correctIndex: 1, marks: 1 },
  { question: "Which cell type has a cell wall made of cellulose?", options: ["Animal", "Plant", "Bacterial", "Fungal"], correctIndex: 1, marks: 1 },
  { question: "Where is chlorophyll found?", options: ["Nucleus", "Chloroplast", "Mitochondrion", "Ribosome"], correctIndex: 1, marks: 1 },
  { question: "Which of these is found in both animal and plant cells?", options: ["Chloroplast", "Cell wall", "Nucleus", "Permanent vacuole"], correctIndex: 2, marks: 1 },
  { question: "What does the cell wall provide for a plant cell?", options: ["Selective permeability", "Strength and support", "Energy", "Genetic material"], correctIndex: 1, marks: 1 },
  { question: "Which organelle is absent in animal cells?", options: ["Nucleus", "Chloroplast", "Ribosome", "Cell membrane"], correctIndex: 1, marks: 1 },
  { question: "Plant cells have a large central vacuole. What is its main role?", options: ["Respiration", "Storage and turgor pressure", "Protein synthesis", "Cell division"], correctIndex: 1, marks: 1 },
  { question: "Which structure is present in plant cells but not animal cells?", options: ["Cytoplasm", "Cell membrane", "Cell wall", "Ribosome"], correctIndex: 2, marks: 1 },
  { question: "Animal and plant cells are both:", options: ["Prokaryotic", "Eukaryotic", "Bacterial", "Without a nucleus"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "State two structures found in plant cells but not in animal cells.", marks: 2, markScheme: ["Chloroplast; cell wall; permanent vacuole. Any two."] },
  { question: "Give the function of the chloroplast.", marks: 1, markScheme: ["Photosynthesis / absorb light to make glucose."] },
  { question: "Why do plant cells have a cell wall?", marks: 2, markScheme: ["Strength; support; maintain shape; prevent bursting (turgor)."] },
  { question: "Name the substance that makes up the cell wall in plant cells.", marks: 1, markScheme: ["Cellulose."] },
  { question: "Describe the role of the vacuole in a plant cell.", marks: 2, markScheme: ["Stores cell sap; maintains turgor pressure; pushes cytoplasm against cell wall."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
