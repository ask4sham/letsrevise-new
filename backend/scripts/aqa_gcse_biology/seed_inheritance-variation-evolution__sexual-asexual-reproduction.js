const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Inheritance, Variation and Evolution";
const TOPIC_NAME = "Sexual and asexual reproduction";
const UNIT_KEY = "inheritance-variation-evolution";
const TOPIC_LABEL = "Sexual and asexual reproduction";

const MCQS = [
  { question: "Sexual reproduction involves:", options: ["One parent", "Two parents; fusion of gametes", "No gametes", "Only mitosis"], correctIndex: 1, marks: 1 },
  { question: "Asexual reproduction produces offspring that are:", options: ["Genetically different", "Genetically identical (clones)", "Always male", "Always female"], correctIndex: 1, marks: 1 },
  { question: "Gametes are:", options: ["Body cells", "Sex cells (sperm and egg); haploid", "Only in plants", "Only produced by mitosis"], correctIndex: 1, marks: 1 },
  { question: "Fertilisation is when:", options: ["Cells divide", "Nucleus of sperm fuses with nucleus of egg", "Only mitosis occurs", "Only one gamete is needed"], correctIndex: 1, marks: 1 },
  { question: "Which type of reproduction produces variation?", options: ["Asexual only", "Sexual (due to mixing of genetic information)", "Neither", "Both equally"], correctIndex: 1, marks: 1 },
  { question: "Strawberries can reproduce asexually by:", options: ["Only seeds", "Runners", "Only flowers", "Only roots"], correctIndex: 1, marks: 1 },
  { question: "In sexual reproduction the offspring inherit:", options: ["DNA from one parent only", "A mix of genes from both parents", "No genes", "Only from the mother"], correctIndex: 1, marks: 1 },
  { question: "Bacteria reproduce by:", options: ["Sexual reproduction only", "Binary fission (asexual)", "Only meiosis", "Only fertilisation"], correctIndex: 1, marks: 1 },
  { question: "Advantage of asexual reproduction:", options: ["Always produces variation", "Rapid; only one parent; good in stable environment", "Only in animals", "Produces many different offspring"], correctIndex: 1, marks: 1 },
  { question: "Advantage of sexual reproduction:", options: ["Always faster", "Variation; adaptation to changing environment", "Only one parent needed", "Always produces clones"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is the difference between sexual and asexual reproduction?", marks: 2, markScheme: ["Sexual: two parents, gametes fuse, variation. Asexual: one parent, no gametes, offspring are clones."] },
  { question: "Why does sexual reproduction produce variation?", marks: 1, markScheme: ["Two parents; mixing of genes; meiosis produces different gametes."] },
  { question: "What is a gamete?", marks: 1, markScheme: ["Sex cell (sperm or egg); haploid; fuses at fertilisation."] },
  { question: "Give one example of asexual reproduction in plants.", marks: 1, markScheme: ["Runners (strawberry); bulbs; tubers; cuttings."] },
  { question: "What is fertilisation?", marks: 1, markScheme: ["Fusion of nucleus of sperm with nucleus of egg; forms zygote."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
