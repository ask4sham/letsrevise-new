// Cell Biology → Cell structure (15 questions, topic-level idempotent)
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Cell structure";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Cell structure";

const MCQS = [
  { question: "Which structure controls the activities of a eukaryotic cell?", options: ["Ribosome", "Cell membrane", "Nucleus", "Cytoplasm"], correctIndex: 2, marks: 1 },
  { question: "Which structure is found in plant cells but NOT animal cells?", options: ["Cell membrane", "Nucleus", "Chloroplast", "Ribosome"], correctIndex: 2, marks: 1 },
  { question: "What is the function of the mitochondria?", options: ["Protein synthesis", "Aerobic respiration", "Photosynthesis", "Cell division"], correctIndex: 1, marks: 1 },
  { question: "Which structure controls the movement of substances into and out of the cell?", options: ["Cell wall", "Cytoplasm", "Cell membrane", "Nucleus"], correctIndex: 2, marks: 1 },
  { question: "Ribosomes are the site of:", options: ["Respiration", "Protein synthesis", "Photosynthesis", "Cell division"], correctIndex: 1, marks: 1 },
  { question: "Which structure is present in both prokaryotic and eukaryotic cells?", options: ["Nucleus", "Mitochondria", "Ribosome", "Chloroplast"], correctIndex: 2, marks: 1 },
  { question: "What is the function of the cell wall in plant cells?", options: ["Controls entry and exit", "Strengthens the cell", "Site of respiration", "Contains DNA"], correctIndex: 1, marks: 1 },
  { question: "Which structure contains genetic material in eukaryotic cells?", options: ["Ribosome", "Cytoplasm", "Nucleus", "Cell membrane"], correctIndex: 2, marks: 1 },
  { question: "Which organelle is responsible for photosynthesis?", options: ["Mitochondrion", "Ribosome", "Chloroplast", "Vacuole"], correctIndex: 2, marks: 1 },
  { question: "What is the role of the vacuole in plant cells?", options: ["Protein synthesis", "Stores cell sap and maintains turgor", "Aerobic respiration", "Controls the cell"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "State two structures found in animal cells.", marks: 2, markScheme: ["Nucleus", "Cytoplasm", "Cell membrane", "Ribosomes", "Mitochondria", "Any two of these"] },
  { question: "Describe the function of the nucleus.", marks: 2, markScheme: ["Controls the activities of the cell", "Contains genetic material", "Contains DNA"] },
  { question: "Explain why plant cells need chloroplasts but animal cells do not.", marks: 3, markScheme: ["Plants make their own food by photosynthesis", "Chloroplasts contain chlorophyll", "Animals get food by eating other organisms"] },
  { question: "State the function of the mitochondria.", marks: 1, markScheme: ["Aerobic respiration", "Release energy", "Site of respiration"] },
  { question: "Name the structure where protein synthesis occurs.", marks: 1, markScheme: ["Ribosome", "Ribosomes"] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, {
    unitName: UNIT_NAME,
    topicName: TOPIC_NAME,
    unitKey: UNIT_KEY,
    topicLabel: TOPIC_LABEL,
    mcqs: MCQS,
    shortAnswer: SHORT_ANSWER,
  });
}

if (require.main === module) {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }
  mongoose.connect(MONGO_URI).then(async () => {
    await run(mongoose);
    await mongoose.disconnect();
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run, MCQS, SHORT_ANSWER };
