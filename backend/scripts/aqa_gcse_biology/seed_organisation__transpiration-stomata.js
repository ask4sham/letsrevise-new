const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Organisation";
const TOPIC_NAME = "Transpiration and stomata";
const UNIT_KEY = "organisation";
const TOPIC_LABEL = "Transpiration and stomata";

const MCQS = [
  { question: "What is transpiration?", options: ["Absorption of water", "Loss of water vapour from leaves (mainly through stomata)", "Movement of sugar", "Uptake of minerals"], correctIndex: 1, marks: 1 },
  { question: "Through which structure does most water leave the leaf?", options: ["Root", "Stomata", "Xylem only", "Phloem"], correctIndex: 1, marks: 1 },
  { question: "What opens and closes the stomata?", options: ["Xylem", "Guard cells", "Phloem", "Epidermis"], correctIndex: 1, marks: 1 },
  { question: "When do stomata usually close?", options: ["In bright light", "When water is scarce or at night", "When temperature is high only", "Never"], correctIndex: 1, marks: 1 },
  { question: "Transpiration rate increases with:", options: ["Low light", "High temperature, wind, low humidity", "Closed stomata", "Cool only"], correctIndex: 1, marks: 1 },
  { question: "Why might a plant close its stomata?", options: ["To increase photosynthesis", "To reduce water loss in dry conditions", "To absorb more CO2", "To grow faster"], correctIndex: 1, marks: 1 },
  { question: "What is the transpiration stream?", options: ["Movement of sugar", "Continuous flow of water from roots to leaves and out", "Only in phloem", "Only at night"], correctIndex: 1, marks: 1 },
  { question: "Guard cells control stomata by:", options: ["Stopping photosynthesis", "Changing shape (swell to open, shrink to close)", "Producing sugar only", "Blocking xylem"], correctIndex: 1, marks: 1 },
  { question: "Which factor would decrease transpiration rate?", options: ["High temperature", "High humidity", "Wind", "Bright light"], correctIndex: 1, marks: 1 },
  { question: "Water vapour is lost from leaves because:", options: ["Roots push it out", "Stomata allow diffusion of water vapour out", "Phloem leaks", "Xylem absorbs it"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is transpiration?", marks: 2, markScheme: ["Loss of water vapour from plant; mainly through stomata; evaporation from mesophyll."] },
  { question: "How do guard cells control the stomata?", marks: 2, markScheme: ["Take in water → swell → stomata open. Lose water → shrink → stomata close."] },
  { question: "State two factors that increase transpiration rate.", marks: 2, markScheme: ["Temperature; light; wind; low humidity. Any two."] },
  { question: "Why might stomata close in dry conditions?", marks: 1, markScheme: ["Reduce water loss; prevent wilting."] },
  { question: "What is the role of the transpiration stream?", marks: 1, markScheme: ["Moves water and minerals up; cools plant; maintains turgor."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
