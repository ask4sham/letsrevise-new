const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Cell differentiation";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Cell differentiation";

const MCQS = [
  { question: "What is cell differentiation?", options: ["Cell division", "Cell becomes specialised", "Cell dies", "Cell grows"], correctIndex: 1, marks: 1 },
  { question: "When does most cell differentiation occur in animals?", options: ["Throughout life", "Only in embryos", "Only in adults", "Never"], correctIndex: 0, marks: 1 },
  { question: "Which cells can differentiate throughout life in plants?", options: ["Only root cells", "Meristem cells", "Only leaf cells", "No plant cells"], correctIndex: 1, marks: 1 },
  { question: "Stem cells are able to:", options: ["Only divide", "Divide and differentiate", "Only differentiate", "Neither divide nor differentiate"], correctIndex: 1, marks: 1 },
  { question: "Where are meristems found in plants?", options: ["Only in roots", "Root tips and shoots", "Only in leaves", "In flowers only"], correctIndex: 1, marks: 1 },
  { question: "In adult animals, which cells can still differentiate?", options: ["All cells", "Only stem cells in some tissues", "No cells", "Only nerve cells"], correctIndex: 1, marks: 1 },
  { question: "What happens to a cell when it differentiates?", options: ["It loses its DNA", "It develops a specific structure for a function", "It divides", "It grows smaller"], correctIndex: 1, marks: 1 },
  { question: "Embryonic stem cells can become:", options: ["Only one cell type", "Any cell type in the body", "Only blood cells", "Only nerve cells"], correctIndex: 1, marks: 1 },
  { question: "Why do plants retain meristem tissue?", options: ["To store food", "To allow growth throughout life", "To absorb water", "To photosynthesise"], correctIndex: 1, marks: 1 },
  { question: "Differentiation in animals is mostly limited to:", options: ["Adulthood", "Early development", "Old age", "Middle age"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is cell differentiation?", marks: 1, markScheme: ["Process by which a cell becomes specialised for a function."] },
  { question: "Where are meristems found in a plant?", marks: 2, markScheme: ["Root tips; shoot tips; cambium. Any two."] },
  { question: "Give one way that differentiation in plants differs from that in animals.", marks: 2, markScheme: ["Plants can differentiate throughout life; meristems; animals mostly in embryo."] },
  { question: "What is a stem cell?", marks: 1, markScheme: ["Cell that can divide and differentiate into other cell types."] },
  { question: "Why might stem cells be used in medicine?", marks: 2, markScheme: ["Replace damaged cells; treat disease; grow new tissue."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
