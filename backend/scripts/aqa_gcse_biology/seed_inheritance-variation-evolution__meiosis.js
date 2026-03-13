const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Inheritance, Variation and Evolution";
const TOPIC_NAME = "Meiosis";
const UNIT_KEY = "inheritance-variation-evolution";
const TOPIC_LABEL = "Meiosis";

const MCQS = [
  { question: "Meiosis produces:", options: ["Body cells", "Gametes (sperm and egg)", "Only identical cells", "Only one cell"], correctIndex: 1, marks: 1 },
  { question: "Cells produced by meiosis have:", options: ["Same number of chromosomes as parent", "Half the number of chromosomes (haploid)", "Double the chromosomes", "No chromosomes"], correctIndex: 1, marks: 1 },
  { question: "Meiosis involves:", options: ["One division", "Two divisions", "No divisions", "Only mitosis"], correctIndex: 1, marks: 1 },
  { question: "Why is meiosis important for sexual reproduction?", options: ["It produces body cells", "It produces haploid gametes; fertilisation restores diploid", "It only happens in plants", "It produces clones"], correctIndex: 1, marks: 1 },
  { question: "Meiosis leads to variation because:", options: ["All cells are identical", "Crossing over; random assortment of chromosomes", "It only happens once", "No fertilisation"], correctIndex: 1, marks: 1 },
  { question: "Human gametes have:", options: ["46 chromosomes", "23 chromosomes", "92 chromosomes", "No chromosomes"], correctIndex: 1, marks: 1 },
  { question: "Where does meiosis occur?", options: ["In all body cells", "In reproductive organs (ovaries, testes)", "Only in the skin", "Only in the liver"], correctIndex: 1, marks: 1 },
  { question: "After fertilisation the zygote has:", options: ["23 chromosomes", "46 chromosomes (diploid); from two gametes", "92 chromosomes", "No chromosomes"], correctIndex: 1, marks: 1 },
  { question: "Crossing over in meiosis:", options: ["Prevents variation", "Exchanges bits of chromosomes; increases variation", "Only in mitosis", "Only in bacteria"], correctIndex: 1, marks: 1 },
  { question: "Mitosis produces cells for:", options: ["Gametes only", "Growth and repair; identical cells", "Only meiosis", "Only fertilisation"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What does meiosis produce and why is the chromosome number halved?", marks: 2, markScheme: ["Produces gametes. Halved so that when two gametes fuse at fertilisation, diploid number is restored."] },
  { question: "How does meiosis lead to genetic variation?", marks: 2, markScheme: ["Crossing over; random assortment of chromosomes; each gamete gets different combination."] },
  { question: "How many divisions occur in meiosis?", marks: 1, markScheme: ["Two divisions (meiosis I and II)."] },
  { question: "Where does meiosis take place in humans?", marks: 1, markScheme: ["Ovaries (eggs); testes (sperm)."] },
  { question: "What is the chromosome number in a human gamete?", marks: 1, markScheme: ["23 (haploid)."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
