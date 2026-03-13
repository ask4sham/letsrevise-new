const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Biodiversity";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Biodiversity";

const MCQS = [
  { question: "Biodiversity is:", options: ["Only number of animals", "Variety of living organisms; species; genetic diversity; habitats", "Only plants", "Only in one place"], correctIndex: 1, marks: 1 },
  { question: "High biodiversity is important because:", options: ["Only for beauty", "Ecosystems more stable; resources; potential medicines", "Only in zoos", "Only in labs"], correctIndex: 1, marks: 1 },
  { question: "Human activities that reduce biodiversity include:", options: ["Only conservation", "Deforestation; pollution; climate change; overfishing", "Only planting trees", "Only recycling"], correctIndex: 1, marks: 1 },
  { question: "Loss of biodiversity can lead to:", options: ["More species", "Ecosystem less stable; loss of resources; extinction", "Only more plants", "Only in one country"], correctIndex: 1, marks: 1 },
  { question: "Biodiversity can be measured by:", options: ["Only counting one species", "Number of species; species richness; evenness", "Only weight", "Only area"], correctIndex: 1, marks: 1 },
  { question: "Conservation helps to:", options: ["Reduce biodiversity", "Maintain or increase biodiversity; protect species and habitats", "Only in zoos", "Only in one place"], correctIndex: 1, marks: 1 },
  { question: "Endemic species are:", options: ["Found everywhere", "Found only in one place (e.g. one island)", "Only in zoos", "Only extinct"], correctIndex: 1, marks: 1 },
  { question: "Genetic diversity within a species:", options: ["Does not matter", "Helps species adapt; resist disease", "Only in plants", "Only in animals"], correctIndex: 1, marks: 1 },
  { question: "Which is a way to protect biodiversity?", options: ["Only deforestation", "Protected areas; breeding programmes; reducing pollution", "Only hunting", "Only farming"], correctIndex: 1, marks: 1 },
  { question: "Ecosystems with high biodiversity tend to be:", options: ["Less stable", "More stable; more resilient to change", "Only in water", "Only in one country"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is biodiversity?", marks: 1, markScheme: ["Variety of living organisms; includes number of species, genetic diversity, variety of habitats."] },
  { question: "Give two human activities that can reduce biodiversity.", marks: 2, markScheme: ["Deforestation; pollution; climate change; overfishing; habitat destruction; introduced species."] },
  { question: "Why is maintaining biodiversity important?", marks: 2, markScheme: ["Ecosystem stability; resources (food, medicine); ethical; resilience to change."] },
  { question: "Give one way to conserve biodiversity.", marks: 1, markScheme: ["Protected areas; breeding programmes; habitat restoration; reduce pollution; legal protection."] },
  { question: "What is an endemic species?", marks: 1, markScheme: ["Species found only in one specific place (e.g. one island or country)."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
