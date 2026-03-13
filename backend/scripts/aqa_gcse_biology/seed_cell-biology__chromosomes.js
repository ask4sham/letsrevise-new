const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Chromosomes";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Chromosomes";

const MCQS = [
  { question: "What are chromosomes made of?", options: ["Protein only", "DNA and protein", "Carbohydrate", "Lipid"], correctIndex: 1, marks: 1 },
  { question: "Where are chromosomes found in a eukaryotic cell?", options: ["Cytoplasm", "Nucleus", "Mitochondria", "Ribosome"], correctIndex: 1, marks: 1 },
  { question: "How many chromosomes do human body cells have?", options: ["23", "46", "92", "22"], correctIndex: 1, marks: 1 },
  { question: "Human gametes (egg and sperm) contain how many chromosomes?", options: ["46", "23", "92", "12"], correctIndex: 1, marks: 1 },
  { question: "What is a gene?", options: ["A type of cell", "A section of DNA that codes for a protein", "A chromosome", "A type of tissue"], correctIndex: 1, marks: 1 },
  { question: "Before cell division, chromosomes:", options: ["Disappear", "Duplicate", "Leave the nucleus", "Fuse together"], correctIndex: 1, marks: 1 },
  { question: "Chromosomes are visible during cell division when they:", options: ["Condense", "Stretch", "Disappear", "Multiply"], correctIndex: 0, marks: 1 },
  { question: "What is the diploid number in humans?", options: ["23", "46", "92", "22"], correctIndex: 1, marks: 1 },
  { question: "What is the haploid number in humans?", options: ["46", "23", "92", "22"], correctIndex: 1, marks: 1 },
  { question: "Genes control:", options: ["Only eye colour", "Inherited characteristics", "Only height", "Only blood type"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What are chromosomes?", marks: 1, markScheme: ["Structures made of DNA and protein; carry genetic information."] },
  { question: "State the number of chromosomes in a human body cell and in a human gamete.", marks: 2, markScheme: ["Body cell: 46; gamete: 23."] },
  { question: "What is a gene?", marks: 1, markScheme: ["Section of DNA that codes for a protein / characteristic."] },
  { question: "Why do gametes have half the number of chromosomes?", marks: 2, markScheme: ["So fertilisation restores full number; one set from each parent."] },
  { question: "Where are chromosomes found in an animal cell?", marks: 1, markScheme: ["In the nucleus."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
