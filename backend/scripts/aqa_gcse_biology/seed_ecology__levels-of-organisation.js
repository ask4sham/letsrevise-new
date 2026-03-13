const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Levels of organisation";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Levels of organisation";

const MCQS = [
  { question: "An individual is:", options: ["A group of species", "One organism", "A community", "An ecosystem"], correctIndex: 1, marks: 1 },
  { question: "A population is:", options: ["One species in one area", "All the organisms of one species in a habitat", "All species in an area", "Only plants"], correctIndex: 1, marks: 1 },
  { question: "A community is:", options: ["Only one species", "All the populations of different species in a habitat", "Only animals", "Only the environment"], correctIndex: 1, marks: 1 },
  { question: "An ecosystem includes:", options: ["Only living things", "Community plus abiotic (non-living) factors", "Only abiotic factors", "Only one population"], correctIndex: 1, marks: 1 },
  { question: "A habitat is:", options: ["The same as a niche", "The place where an organism lives", "Only for plants", "Only the climate"], correctIndex: 1, marks: 1 },
  { question: "Abiotic factors include:", options: ["Predators", "Temperature; light; water; soil pH", "Prey", "Competitors"], correctIndex: 1, marks: 1 },
  { question: "Biotic factors include:", options: ["Temperature", "Food; predators; disease; competition", "Light", "pH"], correctIndex: 1, marks: 1 },
  { question: "The order from smallest to largest is:", options: ["Ecosystem, community, population", "Individual, population, community, ecosystem", "Community, individual, ecosystem", "Population, individual, community"], correctIndex: 1, marks: 1 },
  { question: "Which level includes both living and non-living components?", options: ["Population", "Community", "Ecosystem", "Individual"], correctIndex: 2, marks: 1 },
  { question: "Competition is a:", options: ["Abiotic factor", "Biotic factor", "Only in plants", "Only for food"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is the difference between a community and an ecosystem?", marks: 2, markScheme: ["Community: all populations (living) in a habitat. Ecosystem: community plus abiotic factors (environment)."] },
  { question: "What is a population?", marks: 1, markScheme: ["All the organisms of one species in a habitat at one time."] },
  { question: "Give two abiotic factors that could affect organisms.", marks: 2, markScheme: ["Temperature; light; water; soil pH; oxygen; mineral ions. Any two."] },
  { question: "What is a habitat?", marks: 1, markScheme: ["The place where an organism lives; where it is found."] },
  { question: "Give one biotic factor.", marks: 1, markScheme: ["Food; predators; pathogens; competitors."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
