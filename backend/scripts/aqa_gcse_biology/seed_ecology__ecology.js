const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Ecology";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Ecology";

const MCQS = [
  { question: "Ecology is the study of:", options: ["Only plants", "Organisms and their environment; interactions", "Only animals", "Only cells"], correctIndex: 1, marks: 1 },
  { question: "A producer in a food chain is:", options: ["An animal", "Usually a plant; makes food by photosynthesis", "A decomposer", "A predator"], correctIndex: 1, marks: 1 },
  { question: "A consumer is:", options: ["A plant", "An organism that eats other organisms", "Only a herbivore", "Only a carnivore"], correctIndex: 1, marks: 1 },
  { question: "Decomposers:", options: ["Only make food", "Break down dead matter; release nutrients", "Only eat plants", "Only eat animals"], correctIndex: 1, marks: 1 },
  { question: "A food chain shows:", options: ["Only one organism", "Transfer of energy from one organism to the next", "Only plants", "Only predators"], correctIndex: 1, marks: 1 },
  { question: "Energy is lost between trophic levels because:", options: ["No energy is lost", "Respiration; heat; excretion; not all eaten", "Only in plants", "Only in top predators"], correctIndex: 1, marks: 1 },
  { question: "A food web is:", options: ["One food chain", "Many interconnected food chains", "Only producers", "Only consumers"], correctIndex: 1, marks: 1 },
  { question: "The sun is the source of energy for:", options: ["Only animals", "Most ecosystems (plants capture it)", "Only decomposers", "Only water cycle"], correctIndex: 1, marks: 1 },
  { question: "Biomass is:", options: ["Only weight", "Mass of living material; stored energy", "Only in plants", "Only in animals"], correctIndex: 1, marks: 1 },
  { question: "Ecosystems require:", options: ["Only producers", "Energy flow (e.g. from sun) and cycling of materials", "Only consumers", "Only decomposers"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is ecology?", marks: 1, markScheme: ["Study of organisms and their environment; how they interact with each other and non-living factors."] },
  { question: "What is the role of decomposers in an ecosystem?", marks: 2, markScheme: ["Break down dead organisms and waste; release nutrients back to soil; allow recycling."] },
  { question: "Why is energy lost between trophic levels?", marks: 2, markScheme: ["Respiration; movement; heat; excretion; not all parts eaten or absorbed."] },
  { question: "What is the difference between a food chain and a food web?", marks: 1, markScheme: ["Food chain: single line of feeding. Food web: many chains interconnected."] },
  { question: "Where does the energy in most food chains originally come from?", marks: 1, markScheme: ["The sun; captured by plants in photosynthesis."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
