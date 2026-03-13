const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Inheritance, Variation and Evolution";
const TOPIC_NAME = "Speciation";
const UNIT_KEY = "inheritance-variation-evolution";
const TOPIC_LABEL = "Speciation";

const MCQS = [
  { question: "Speciation is the formation of:", options: ["New individuals", "New species", "Only new varieties", "Only new populations"], correctIndex: 1, marks: 1 },
  { question: "Speciation can occur when populations are:", options: ["Always together", "Separated (isolated); evolve differently", "Only in same habitat", "Only in one country"], correctIndex: 1, marks: 1 },
  { question: "Geographic isolation means:", options: ["Same place", "Populations separated by barrier (e.g. sea, mountain)", "Only in labs", "Only in fossils"], correctIndex: 1, marks: 1 },
  { question: "If two populations are separated and don't interbreed:", options: ["They stay identical", "They may evolve differently; become different species", "Only one evolves", "Only in plants"], correctIndex: 1, marks: 1 },
  { question: "For speciation, the separated populations must:", options: ["Stay the same", "Accumulate different mutations; natural selection; become unable to interbreed", "Only mix again", "Only have same genes"], correctIndex: 1, marks: 1 },
  { question: "Reproductive isolation means:", options: ["They always breed", "They can no longer produce fertile offspring together", "Only in same species", "Only in animals"], correctIndex: 1, marks: 1 },
  { question: "Darwin's finches are an example of:", options: ["Only one species", "Speciation; different islands, different selection pressures", "Only same beak", "Only in captivity"], correctIndex: 1, marks: 1 },
  { question: "New species arise when:", options: ["Only mutation", "Populations diverge so much they can't interbreed to produce fertile offspring", "Only in one generation", "Only in labs"], correctIndex: 1, marks: 1 },
  { question: "Isolation can be:", options: ["Only geographic", "Geographic; behavioural; temporal", "Only genetic", "Only in fossils"], correctIndex: 1, marks: 1 },
  { question: "The definition of a species often includes:", options: ["Only look similar", "Can interbreed to produce fertile offspring", "Only same habitat", "Only same size"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is speciation?", marks: 1, markScheme: ["Formation of a new species."] },
  { question: "Describe how geographic isolation can lead to speciation.", marks: 2, markScheme: ["Population split by barrier; no gene flow; different mutations and selection in each; populations diverge; eventually can't interbreed = new species."] },
  { question: "What is reproductive isolation?", marks: 1, markScheme: ["When two populations can no longer interbreed to produce fertile offspring."] },
  { question: "Why might two populations that were once one species become two different species?", marks: 2, markScheme: ["Separated; different environments; natural selection acts differently; genetic differences accumulate; eventually cannot interbreed."] },
  { question: "Give one example of speciation.", marks: 1, markScheme: ["Darwin's finches on Galápagos; different islands, different food, different beak shapes evolved."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
