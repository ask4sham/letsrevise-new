const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Adaptations";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Adaptations";

const MCQS = [
  { question: "An adaptation is:", options: ["A random change", "A feature that helps an organism survive in its environment", "Only in animals", "Only in plants"], correctIndex: 1, marks: 1 },
  { question: "Structural adaptations are:", options: ["Only behaviour", "Physical features (e.g. shape, colour)", "Only in desert", "Only in water"], correctIndex: 1, marks: 1 },
  { question: "Camouflage is an adaptation that:", options: ["Makes organism stand out", "Helps organism blend in; avoid predators or catch prey", "Only in plants", "Only in day"], correctIndex: 1, marks: 1 },
  { question: "Extremophiles are organisms that:", options: ["Live in normal conditions", "Live in extreme conditions (e.g. high temp, pH)", "Only in water", "Only on land"], correctIndex: 1, marks: 1 },
  { question: "Cacti are adapted to dry conditions by:", options: ["Large leaves", "Small leaves/spines; thick stem; shallow roots; store water", "Only deep roots", "Only no stem"], correctIndex: 1, marks: 1 },
  { question: "Behavioural adaptations include:", options: ["Only body shape", "Migration; hibernation; hunting in groups", "Only colour", "Only size"], correctIndex: 1, marks: 1 },
  { question: "Fish are adapted to water with:", options: ["Lungs only", "Gills; streamlined body; fins", "Only legs", "Only fur"], correctIndex: 1, marks: 1 },
  { question: "Arctic animals may have:", options: ["Dark fur", "White fur (camouflage); thick fur; fat layer", "Only thin fur", "Only no fur"], correctIndex: 1, marks: 1 },
  { question: "Plants in shade may have:", options: ["Only small leaves", "Large leaves to capture light", "Only no leaves", "Only thick cuticle"], correctIndex: 1, marks: 1 },
  { question: "Adaptations are the result of:", options: ["Only chance", "Evolution by natural selection over time", "Only one generation", "Only humans"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is an adaptation?", marks: 1, markScheme: ["A feature that helps an organism survive and reproduce in its environment."] },
  { question: "Give two adaptations of a cactus for desert life.", marks: 2, markScheme: ["Spines (reduce water loss); thick stem stores water; shallow roots absorb rain quickly; reduced leaf surface."] },
  { question: "What is the difference between structural and behavioural adaptation?", marks: 2, markScheme: ["Structural: physical feature (e.g. shape, colour). Behavioural: what organism does (e.g. migration, hibernation)."] },
  { question: "What are extremophiles?", marks: 1, markScheme: ["Organisms that live in extreme conditions (e.g. high temperature, pH, salinity)."] },
  { question: "Give one adaptation of a predator for catching prey.", marks: 1, markScheme: ["Sharp teeth/claws; camouflage; speed; good eyesight; hunting in packs."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
