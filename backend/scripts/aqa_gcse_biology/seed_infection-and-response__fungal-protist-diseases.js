const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Infection and Response";
const TOPIC_NAME = "Fungal and protist diseases";
const UNIT_KEY = "infection-and-response";
const TOPIC_LABEL = "Fungal and protist diseases";

const MCQS = [
  { question: "Rose black spot is caused by:", options: ["Bacterium", "Virus", "Fungus", "Protist"], correctIndex: 2, marks: 1 },
  { question: "Malaria is caused by:", options: ["Fungus", "Protist", "Virus", "Bacterium"], correctIndex: 1, marks: 1 },
  { question: "Malaria is spread by:", options: ["Direct contact", "Mosquito vector", "Water", "Food"], correctIndex: 1, marks: 1 },
  { question: "Rose black spot spreads by:", options: ["Vectors only", "Water or wind", "Soil only", "Seeds only"], correctIndex: 1, marks: 1 },
  { question: "How can rose black spot be treated?", options: ["Antibiotics", "Fungicide; remove affected leaves", "Vaccination", "No treatment"], correctIndex: 1, marks: 1 },
  { question: "Malaria prevention can include:", options: ["Fungicide", "Mosquito nets; antimalarial drugs; reduce breeding sites", "Vaccination only", "Antibiotics only"], correctIndex: 1, marks: 1 },
  { question: "Protists are:", options: ["Only parasites", "Eukaryotic; some cause disease", "Always beneficial", "Same as bacteria"], correctIndex: 1, marks: 1 },
  { question: "Rose black spot affects:", options: ["Roots only", "Leaves; reduces photosynthesis", "Flowers only", "Stem only"], correctIndex: 1, marks: 1 },
  { question: "The malaria parasite reproduces in:", options: ["Mosquito only", "Human and mosquito", "Water only", "Soil only"], correctIndex: 1, marks: 1 },
  { question: "Fungal diseases in plants often show:", options: ["No symptoms", "Spots, mould, discolouration", "Only wilting", "Only root damage"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Name one fungal disease and one protist disease.", marks: 2, markScheme: ["Fungal: e.g. rose black spot. Protist: e.g. malaria."] },
  { question: "How is malaria spread?", marks: 1, markScheme: ["By mosquito vector; protist in mosquito saliva."] },
  { question: "Describe the effect of rose black spot on a plant.", marks: 2, markScheme: ["Purple/black spots on leaves; leaves turn yellow and drop; less photosynthesis."] },
  { question: "Give one way to reduce the spread of rose black spot.", marks: 1, markScheme: ["Remove and destroy affected leaves; use fungicide."] },
  { question: "Why is controlling mosquitoes important in preventing malaria?", marks: 1, markScheme: ["Mosquito is the vector that transmits the malaria protist."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
