const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Mitosis and the cell cycle";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Mitosis and the cell cycle";

const MCQS = [
  { question: "What is mitosis?", options: ["Cell death", "Division producing two identical daughter cells", "Production of gametes", "Growth of one cell"], correctIndex: 1, marks: 1 },
  { question: "Why is mitosis important for growth?", options: ["It produces gametes", "It produces genetically identical cells", "It produces different cells", "It stops growth"], correctIndex: 1, marks: 1 },
  { question: "How many daughter cells are produced in mitosis?", options: ["One", "Two", "Four", "None"], correctIndex: 1, marks: 1 },
  { question: "Before mitosis, what happens to the chromosomes?", options: ["They disappear", "They duplicate", "They leave the nucleus", "They fuse"], correctIndex: 1, marks: 1 },
  { question: "Which phase comes after interphase in the cell cycle?", options: ["Cytokinesis", "Mitosis", "Growth only", "Death"], correctIndex: 1, marks: 1 },
  { question: "What is the cell cycle?", options: ["Only mitosis", "Interphase, mitosis and cytokinesis", "Only interphase", "Only cytokinesis"], correctIndex: 1, marks: 1 },
  { question: "During interphase the cell:", options: ["Divides", "Grows and DNA replicates", "Dies", "Stops all activity"], correctIndex: 1, marks: 1 },
  { question: "Cytokinesis is:", options: ["Division of the nucleus", "Division of the cytoplasm", "DNA replication", "Chromosome condensation"], correctIndex: 1, marks: 1 },
  { question: "Daughter cells produced by mitosis have:", options: ["Half the chromosomes", "Same number of chromosomes as parent", "Double the chromosomes", "No chromosomes"], correctIndex: 1, marks: 1 },
  { question: "Mitosis is used for:", options: ["Making gametes only", "Growth, repair and asexual reproduction", "Respiration only", "Photosynthesis only"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is mitosis?", marks: 1, markScheme: ["Division of a cell to produce two genetically identical daughter cells."] },
  { question: "State two reasons why mitosis is important.", marks: 2, markScheme: ["Growth; repair; asexual reproduction. Any two."] },
  { question: "Describe what happens to chromosomes during the cell cycle before division.", marks: 2, markScheme: ["Duplicate / replicate during interphase; then separate in mitosis."] },
  { question: "What is cytokinesis?", marks: 1, markScheme: ["Division of the cytoplasm / splitting of the cell into two."] },
  { question: "Why do the two daughter cells have identical genetic information?", marks: 1, markScheme: ["Chromosomes were duplicated then divided equally."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
