const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Inheritance, Variation and Evolution";
const TOPIC_NAME = "DNA and the genome";
const UNIT_KEY = "inheritance-variation-evolution";
const TOPIC_LABEL = "DNA and the genome";

const MCQS = [
  { question: "DNA is found in:", options: ["Only the cytoplasm", "The nucleus (and mitochondria, chloroplasts)", "Only the cell membrane", "Only the ribosomes"], correctIndex: 1, marks: 1 },
  { question: "A gene is:", options: ["A whole chromosome", "A section of DNA that codes for a protein", "Only in bacteria", "Only in gametes"], correctIndex: 1, marks: 1 },
  { question: "The genome is:", options: ["One gene", "All the genetic material of an organism", "Only the mitochondria", "Only the proteins"], correctIndex: 1, marks: 1 },
  { question: "DNA is a polymer made of:", options: ["Only sugars", "Nucleotides (sugar, phosphate, base)", "Only proteins", "Only lipids"], correctIndex: 1, marks: 1 },
  { question: "The four bases in DNA are:", options: ["A, B, C, D", "A, T, C, G (adenine, thymine, cytosine, guanine)", "Only A and T", "Only in RNA"], correctIndex: 1, marks: 1 },
  { question: "A pairs with T and C pairs with G because of:", options: ["Random chance", "Complementary base pairing", "Only in RNA", "Only in proteins"], correctIndex: 1, marks: 1 },
  { question: "Knowing the genome helps scientists to:", options: ["Only clone", "Understand inherited diseases; develop treatments; study evolution", "Only breed plants", "Only sequence one gene"], correctIndex: 1, marks: 1 },
  { question: "Chromosomes are made of:", options: ["Only protein", "DNA wound around proteins", "Only RNA", "Only genes"], correctIndex: 1, marks: 1 },
  { question: "Different genes code for:", options: ["The same protein", "Different proteins", "Only enzymes", "Only structural proteins"], correctIndex: 1, marks: 1 },
  { question: "The shape of DNA is:", options: ["A straight line", "Double helix", "A circle only", "A single strand"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is a gene?", marks: 1, markScheme: ["Section of DNA that codes for a protein (or characteristic)."] },
  { question: "What is the genome and why is it useful to know?", marks: 2, markScheme: ["All the genetic material/DNA of an organism. Useful for understanding disease, evolution, developing treatments."] },
  { question: "Describe the structure of DNA.", marks: 2, markScheme: ["Double helix; polymer of nucleotides; each nucleotide has sugar, phosphate, base; bases A-T, C-G complementary."] },
  { question: "Where is DNA found in the cell?", marks: 1, markScheme: ["Nucleus; also mitochondria and chloroplasts."] },
  { question: "What are the four bases in DNA and how do they pair?", marks: 1, markScheme: ["A, T, C, G. A with T, C with G."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
