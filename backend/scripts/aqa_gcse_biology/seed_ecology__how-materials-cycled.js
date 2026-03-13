const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "How materials are cycled";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "How materials are cycled";

const MCQS = [
  { question: "The carbon cycle involves:", options: ["Only respiration", "Photosynthesis; respiration; feeding; decomposition; combustion", "Only plants", "Only animals"], correctIndex: 1, marks: 1 },
  { question: "Carbon is removed from the atmosphere by:", options: ["Only respiration", "Photosynthesis (plants take in CO₂)", "Only combustion", "Only decomposition"], correctIndex: 1, marks: 1 },
  { question: "Carbon is returned to the atmosphere by:", options: ["Only photosynthesis", "Respiration; combustion; decomposition", "Only feeding", "Only in water"], correctIndex: 1, marks: 1 },
  { question: "The water cycle involves:", options: ["Only rain", "Evaporation; condensation; precipitation; runoff", "Only oceans", "Only plants"], correctIndex: 1, marks: 1 },
  { question: "Decomposers in the carbon cycle:", options: ["Only take in CO₂", "Break down dead matter; release CO₂ in respiration", "Only in plants", "Only in air"], correctIndex: 1, marks: 1 },
  { question: "Nitrogen cycle involves:", options: ["Only plants", "Decomposition; nitrification; nitrogen fixation; denitrification", "Only animals", "Only bacteria"], correctIndex: 1, marks: 1 },
  { question: "Nitrogen-fixing bacteria:", options: ["Only break down nitrogen", "Convert N₂ from air into useful nitrogen compounds", "Only in plants", "Only in water"], correctIndex: 1, marks: 1 },
  { question: "Materials are recycled in ecosystems so that:", options: ["Nothing is reused", "Nutrients are returned; no need for constant input", "Only carbon is recycled", "Only in soil"], correctIndex: 1, marks: 1 },
  { question: "Combustion of fossil fuels releases:", options: ["Only oxygen", "CO₂ (and other gases) into atmosphere", "Only nitrogen", "Only water"], correctIndex: 1, marks: 1 },
  { question: "In the water cycle, transpiration is:", options: ["Only rain", "Water vapour lost from plants", "Only evaporation from sea", "Only runoff"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Describe how carbon is cycled between the atmosphere and living organisms.", marks: 2, markScheme: ["Plants take in CO₂ by photosynthesis; carbon in food chains; respiration returns CO₂; decomposition returns CO₂; combustion of fossil fuels."] },
  { question: "What is the role of decomposers in the carbon cycle?", marks: 1, markScheme: ["Break down dead matter; respire; release CO₂ back to atmosphere."] },
  { question: "Name two processes that add CO₂ to the atmosphere.", marks: 2, markScheme: ["Respiration; combustion; decomposition. Any two."] },
  { question: "What is nitrogen fixation?", marks: 1, markScheme: ["Bacteria convert N₂ from air into nitrogen compounds plants can use."] },
  { question: "Why is recycling of materials important in ecosystems?", marks: 1, markScheme: ["Nutrients (e.g. carbon, nitrogen) are finite; recycling means they can be reused; no constant new input needed."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
