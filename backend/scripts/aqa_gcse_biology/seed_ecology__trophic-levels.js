const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Trophic levels";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Trophic levels";

const MCQS = [
  { question: "Trophic level 1 is always:", options: ["Herbivores", "Producers (plants)", "Carnivores", "Decomposers"], correctIndex: 1, marks: 1 },
  { question: "Primary consumers are:", options: ["Plants", "Herbivores (eat producers)", "Carnivores", "Decomposers"], correctIndex: 1, marks: 1 },
  { question: "Secondary consumers eat:", options: ["Only plants", "Primary consumers (herbivores)", "Only decomposers", "Only producers"], correctIndex: 1, marks: 1 },
  { question: "Tertiary consumers are usually:", options: ["Herbivores", "Top carnivores (eat secondary consumers)", "Producers", "Decomposers"], correctIndex: 1, marks: 1 },
  { question: "Decomposers:", options: ["Are trophic level 1", "Break down dead matter; recycle nutrients", "Only eat plants", "Only eat live animals"], correctIndex: 1, marks: 1 },
  { question: "Energy at each trophic level:", options: ["Increases", "Decreases (only ~10% passed on)", "Stays same", "Only in producers"], correctIndex: 1, marks: 1 },
  { question: "Most energy is lost as:", options: ["Light", "Heat (respiration); movement; in waste", "Only in plants", "Only at top"], correctIndex: 1, marks: 1 },
  { question: "A food chain has the order:", options: ["Consumer, producer, consumer", "Producer → primary consumer → secondary consumer", "Only producer", "Only consumer"], correctIndex: 1, marks: 1 },
  { question: "Why are food chains usually short?", options: ["No reason", "Energy lost at each level; not enough energy left after few levels", "Only in water", "Only in desert"], correctIndex: 1, marks: 1 },
  { question: "Biomass at each trophic level generally:", options: ["Increases", "Decreases (less energy = less biomass)", "Stays same", "Only in producers"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What are the trophic levels in a food chain?", marks: 2, markScheme: ["Level 1: producers. Level 2: primary consumers (herbivores). Level 3: secondary consumers. Level 4: tertiary consumers. Decomposers break down all levels."] },
  { question: "Why is energy lost at each trophic level?", marks: 2, markScheme: ["Respiration; movement; heat; excretion; not all parts eaten or absorbed."] },
  { question: "What is a primary consumer?", marks: 1, markScheme: ["Herbivore; eats producers (plants)."] },
  { question: "Why are there rarely more than four or five trophic levels?", marks: 1, markScheme: ["So much energy lost at each level; not enough energy to support more levels."] },
  { question: "What is the role of decomposers in trophic levels?", marks: 1, markScheme: ["Break down dead organisms at all levels; recycle nutrients."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
