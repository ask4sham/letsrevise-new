const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Principles of organisation";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Principles of organisation";

const MCQS = [
  { question: "What is the correct order of organisation in a multicellular organism?", options: ["Organ → tissue → cell → organ system", "Cell → tissue → organ → organ system", "Organ system → organ → tissue → cell", "Tissue → cell → organ"], correctIndex: 1, marks: 1 },
  { question: "What is a tissue?", options: ["A single cell", "A group of similar cells working together", "An organ", "A whole organism"], correctIndex: 1, marks: 1 },
  { question: "Which is an example of an organ?", options: ["Muscle cell", "Stomach", "Blood", "Nervous system"], correctIndex: 1, marks: 1 },
  { question: "What is an organ system?", options: ["A single organ", "A group of organs working together", "A type of tissue", "One cell"], correctIndex: 1, marks: 1 },
  { question: "Which level contains the smallest unit of life?", options: ["Organ system", "Organ", "Tissue", "Cell"], correctIndex: 3, marks: 1 },
  { question: "The digestive system is an example of:", options: ["A tissue", "An organ", "An organ system", "A cell"], correctIndex: 2, marks: 1 },
  { question: "Epithelial tissue is found:", options: ["Only in the brain", "Lining organs and surfaces", "Only in muscles", "In bones only"], correctIndex: 1, marks: 1 },
  { question: "Which describes the hierarchy from simple to complex?", options: ["Organ system → organ → tissue → cell", "Cell → tissue → organ → organ system", "Tissue → organ system → cell", "Organ → cell → tissue"], correctIndex: 1, marks: 1 },
  { question: "Muscle tissue is specialised for:", options: ["Contraction and movement", "Carrying oxygen", "Photosynthesis", "Support only"], correctIndex: 0, marks: 1 },
  { question: "What makes up an organ?", options: ["Only one type of tissue", "Different tissues working together", "Only cells", "Only organ systems"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "State the order of organisation from cell to organ system.", marks: 1, markScheme: ["Cell → tissue → organ → organ system."] },
  { question: "What is meant by a tissue?", marks: 2, markScheme: ["Group of similar cells; working together to perform a function."] },
  { question: "Give one example of an organ and one of an organ system.", marks: 2, markScheme: ["Organ: heart, stomach, liver, etc. System: circulatory, digestive, etc."] },
  { question: "Why is the cell the basic unit of life?", marks: 1, markScheme: ["All life processes occur in cells; building block of tissues/organs."] },
  { question: "Describe how tissues form an organ.", marks: 1, markScheme: ["Different tissues work together; e.g. stomach has muscle, epithelial, glandular."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
