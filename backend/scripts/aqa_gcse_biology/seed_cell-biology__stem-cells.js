const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Stem cells";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Stem cells";

const MCQS = [
  { question: "What is a stem cell?", options: ["A mature specialised cell", "A cell that can divide and differentiate", "A type of nerve cell", "A dead cell"], correctIndex: 1, marks: 1 },
  { question: "Where are stem cells found in human embryos?", options: ["Only in the brain", "In the early embryo", "Only in blood", "Nowhere"], correctIndex: 1, marks: 1 },
  { question: "Adult stem cells can only become:", options: ["Any cell type", "Limited range of cell types", "No cell types", "Only blood cells"], correctIndex: 1, marks: 1 },
  { question: "Which type of stem cell can differentiate into any cell type?", options: ["Adult stem cells", "Embryonic stem cells", "Bone marrow stem cells", "No stem cells"], correctIndex: 1, marks: 1 },
  { question: "Stem cells in bone marrow can form:", options: ["Only nerve cells", "Blood cells", "Only muscle cells", "Only skin cells"], correctIndex: 1, marks: 1 },
  { question: "Why might embryonic stem cells be used in medicine?", options: ["They are cheaper", "They can become any cell type", "They are easier to find", "They last longer"], correctIndex: 1, marks: 1 },
  { question: "What is one ethical issue with using embryonic stem cells?", options: ["They are too old", "Embryo is destroyed", "They don't work", "They are too expensive"], correctIndex: 1, marks: 1 },
  { question: "Where are stem cells found in plants?", options: ["Only in roots", "Meristems", "Only in leaves", "Nowhere"], correctIndex: 1, marks: 1 },
  { question: "Therapeutic cloning could provide:", options: ["Genetically different cells", "Genetically identical stem cells for a patient", "Only plant cells", "No benefit"], correctIndex: 1, marks: 1 },
  { question: "Stem cell research may help treat:", options: ["Only infections", "Conditions like paralysis and diabetes", "Only colds", "No conditions"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is a stem cell?", marks: 1, markScheme: ["Cell that can divide and differentiate into other cell types."] },
  { question: "Give one difference between embryonic and adult stem cells.", marks: 2, markScheme: ["Embryonic can become any cell type; adult only limited types. Or: source / ethics."] },
  { question: "Give one use of stem cells in medicine.", marks: 1, markScheme: ["Replace damaged cells; treat disease; grow new tissue; e.g. paralysis, diabetes."] },
  { question: "State one ethical concern about embryonic stem cells.", marks: 1, markScheme: ["Embryo destroyed; potential life; consent."] },
  { question: "Where in a plant are stem cells found?", marks: 1, markScheme: ["Meristems / root tips / shoot tips."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
