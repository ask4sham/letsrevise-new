const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Inheritance, Variation and Evolution";
const TOPIC_NAME = "Variation";
const UNIT_KEY = "inheritance-variation-evolution";
const TOPIC_LABEL = "Variation";

const MCQS = [
  { question: "Variation can be caused by:", options: ["Only genes", "Genes (inherited) and environment", "Only environment", "Only mutation"], correctIndex: 1, marks: 1 },
  { question: "Genetic variation comes from:", options: ["Only environment", "Mutation; meiosis; sexual reproduction", "Only diet", "Only exercise"], correctIndex: 1, marks: 1 },
  { question: "Environmental variation includes:", options: ["Only eye colour", "Scars; accent; diet; lifestyle", "Only blood type", "Only genes"], correctIndex: 1, marks: 1 },
  { question: "Discontinuous variation is when:", options: ["There is a range (e.g. height)", "Distinct categories (e.g. blood group)", "Only one option", "Only in plants"], correctIndex: 1, marks: 1 },
  { question: "Height is an example of:", options: ["Only discontinuous", "Continuous variation (range of values)", "Only genetic", "Only environmental"], correctIndex: 1, marks: 1 },
  { question: "Blood group is an example of:", options: ["Continuous variation", "Discontinuous variation (distinct types)", "Only environmental", "Only in males"], correctIndex: 1, marks: 1 },
  { question: "Mutations can cause variation when:", options: ["They never happen", "They change the DNA; may be inherited if in gametes", "Only in body cells", "Only reduce variation"], correctIndex: 1, marks: 1 },
  { question: "Identical twins have the same genes but may differ due to:", options: ["Only genes", "Environmental factors (e.g. diet, lifestyle)", "Only mutation", "Only meiosis"], correctIndex: 1, marks: 1 },
  { question: "Variation is important for evolution because:", options: ["All individuals are the same", "Some variants may be better suited; natural selection", "Only in fossils", "Only in plants"], correctIndex: 1, marks: 1 },
  { question: "Continuous variation is often caused by:", options: ["One gene only", "Many genes and/or environment", "Only mutation", "Only asexual reproduction"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is the difference between genetic and environmental variation?", marks: 2, markScheme: ["Genetic: inherited; due to genes/DNA. Environmental: due to surroundings, diet, lifestyle; not inherited."] },
  { question: "Give one example of continuous and one of discontinuous variation.", marks: 2, markScheme: ["Continuous: height, mass. Discontinuous: blood group, eye colour (often), tongue rolling."] },
  { question: "How does mutation contribute to variation?", marks: 1, markScheme: ["Changes in DNA; can create new alleles; if in gametes can be passed on."] },
  { question: "Why might two people with the same genes (e.g. identical twins) look or behave differently?", marks: 1, markScheme: ["Environmental factors: diet, lifestyle, experiences."] },
  { question: "Why is variation important for a species?", marks: 1, markScheme: ["Enables natural selection; some better suited to environment; survival and evolution."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
