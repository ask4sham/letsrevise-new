const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Inheritance, Variation and Evolution";
const TOPIC_NAME = "Inherited disorders";
const UNIT_KEY = "inheritance-variation-evolution";
const TOPIC_LABEL = "Inherited disorders";

const MCQS = [
  { question: "Polydactyly is caused by:", options: ["Only environment", "Dominant allele", "Only recessive allele", "Only infection"], correctIndex: 1, marks: 1 },
  { question: "Cystic fibrosis is caused by:", options: ["Dominant allele", "Recessive allele", "Only environment", "Only one parent"], correctIndex: 1, marks: 1 },
  { question: "A person with one copy of the cystic fibrosis allele is a:", options: ["Carrier; does not have the disorder", "Always has the disorder", "Cannot pass it on", "Only in males"], correctIndex: 0, marks: 1 },
  { question: "Embryonic screening can be used to:", options: ["Only treat disease", "Detect genetic disorders in embryos (e.g. before IVF)", "Only after birth", "Only for polydactyly"], correctIndex: 1, marks: 1 },
  { question: "Ethical issues with embryonic screening include:", options: ["Only cost", "Discarding embryos; designer babies; false results", "Only success rate", "Only science"], correctIndex: 1, marks: 1 },
  { question: "Polydactyly means:", options: ["Fewer fingers", "Extra fingers or toes", "Only toes", "Only in feet"], correctIndex: 1, marks: 1 },
  { question: "Cystic fibrosis affects:", options: ["Only the heart", "Lungs; digestive system; mucus", "Only the skin", "Only the brain"], correctIndex: 1, marks: 1 },
  { question: "To have cystic fibrosis a person must inherit:", options: ["One recessive allele", "Two recessive alleles", "One dominant allele", "Only from mother"], correctIndex: 1, marks: 1 },
  { question: "Genetic testing of adults can show:", options: ["Only phenotype", "If they are carriers of a recessive disorder", "Only dominant disorders", "Only in embryos"], correctIndex: 1, marks: 1 },
  { question: "Pre-implantation genetic diagnosis (PGD) is used:", options: ["Only after birth", "To select embryos without disorder before implantation (IVF)", "Only for polydactyly", "Only for carriers"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How is cystic fibrosis inherited?", marks: 2, markScheme: ["Recessive allele; need two copies (homozygous recessive); carriers have one copy."] },
  { question: "What is a carrier?", marks: 1, markScheme: ["Person who has one copy of recessive allele; does not have disorder; can pass it on."] },
  { question: "How is polydactyly inherited?", marks: 1, markScheme: ["Dominant allele; one copy needed to have the condition."] },
  { question: "Give one ethical issue with embryonic screening.", marks: 1, markScheme: ["Discarding embryos; designer babies; reliability; cost; who decides."] },
  { question: "What is PGD and what is it used for?", marks: 1, markScheme: ["Pre-implantation genetic diagnosis; test embryos before implantation; select those without disorder."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
