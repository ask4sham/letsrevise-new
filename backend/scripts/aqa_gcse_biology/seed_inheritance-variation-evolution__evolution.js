const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Inheritance, Variation and Evolution";
const TOPIC_NAME = "Evolution";
const UNIT_KEY = "inheritance-variation-evolution";
const TOPIC_LABEL = "Evolution";

const MCQS = [
  { question: "Evolution is:", options: ["Quick change in one generation", "Change in inherited characteristics over time", "Only in fossils", "Only in plants"], correctIndex: 1, marks: 1 },
  { question: "Natural selection means:", options: ["Humans choose", "Individuals with advantageous characteristics survive and reproduce more", "All survive", "Only the strongest always survive"], correctIndex: 1, marks: 1 },
  { question: "Variation in a population is important because:", options: ["Everyone is the same", "Some variants may be better suited; survive and reproduce", "Only mutations matter", "Only environment matters"], correctIndex: 1, marks: 1 },
  { question: "Evolution can be driven by:", options: ["Only one factor", "Natural selection; mutation; environmental change", "Only humans", "Only fossils"], correctIndex: 1, marks: 1 },
  { question: "Charles Darwin proposed:", options: ["Only inheritance", "Theory of evolution by natural selection", "Only creation", "Only fossils"], correctIndex: 1, marks: 1 },
  { question: "Resistant bacteria evolve because:", options: ["All bacteria die", "Mutations; antibiotics kill non-resistant; resistant survive and reproduce", "Only one bacterium", "Only in hospitals"], correctIndex: 1, marks: 1 },
  { question: "Over many generations, advantageous characteristics:", options: ["Disappear", "Become more common in the population", "Stay the same", "Only in one individual"], correctIndex: 1, marks: 1 },
  { question: "Evolution is supported by:", options: ["Only one piece of evidence", "Fossils; comparative anatomy; DNA; antibiotic resistance", "Only religion", "Only theory"], correctIndex: 1, marks: 1 },
  { question: "Species can change over time because:", options: ["They choose to", "Mutation and natural selection; environment changes", "Only humans change them", "Only in labs"], correctIndex: 1, marks: 1 },
  { question: "Survival of the fittest means:", options: ["Only the strongest", "Those best suited to the environment survive and reproduce", "Only the biggest", "Only the fastest"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is natural selection?", marks: 2, markScheme: ["Variation exists; some better suited to environment; these survive and reproduce more; advantageous characteristics become more common."] },
  { question: "How does evolution occur over time?", marks: 2, markScheme: ["Mutation produces variation; natural selection; individuals with advantageous traits survive and reproduce; frequency of alleles changes."] },
  { question: "Why did Darwin's theory cause controversy?", marks: 1, markScheme: ["Challenged religious beliefs; lack of evidence at first; mechanism (inheritance) not fully understood."] },
  { question: "Give one example of evolution in action.", marks: 1, markScheme: ["Antibiotic-resistant bacteria; peppered moth; Darwin's finches."] },
  { question: "What is meant by 'survival of the fittest'?", marks: 1, markScheme: ["Organisms best suited to environment survive and reproduce; pass on genes."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
