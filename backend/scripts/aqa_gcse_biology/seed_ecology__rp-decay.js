const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Ecology";
const TOPIC_NAME = "Required Practical: Decay";
const UNIT_KEY = "ecology";
const TOPIC_LABEL = "Required Practical: Decay";

const MCQS = [
  { question: "In the decay practical, we might measure decay by:", options: ["Only temperature", "Change in mass; or time for indicator to change", "Only pH", "Only light"], correctIndex: 1, marks: 1 },
  { question: "Milk or lipase can be used to model decay because:", options: ["They don't change", "They show breakdown; pH change as products form", "Only in cold", "Only in light"], correctIndex: 1, marks: 1 },
  { question: "Decay is faster at higher temperature because:", options: ["Enzymes work slower", "Enzymes in decomposers work faster", "Only in water", "Only in soil"], correctIndex: 1, marks: 1 },
  { question: "To test the effect of temperature you would:", options: ["Only use one temperature", "Use water baths at different temperatures; same volume, same time", "Only change pH", "Only change volume"], correctIndex: 1, marks: 1 },
  { question: "A control might be:", options: ["Same setup with no enzyme/organism", "To show change is due to decay not something else", "Only the coldest", "Only the hottest"], correctIndex: 1, marks: 1 },
  { question: "pH indicator (e.g. phenolphthalein) can show:", options: ["Only temperature", "Acid produced during decay (pH drops)", "Only oxygen", "Only mass"], correctIndex: 1, marks: 1 },
  { question: "Why keep other variables constant?", options: ["To save time", "So only one variable (e.g. temperature) is tested; fair comparison", "Only for safety", "Only for cost"], correctIndex: 1, marks: 1 },
  { question: "Decay releases:", options: ["Only oxygen", "CO₂; nutrients; may change pH", "Only nitrogen", "Only water"], correctIndex: 1, marks: 1 },
  { question: "To make results more reliable you should:", options: ["Only do one test", "Repeat; use same volumes and concentrations", "Only change one thing", "Only use one temperature"], correctIndex: 1, marks: 1 },
  { question: "This practical demonstrates that decay rate depends on:", options: ["Only light", "Temperature (and can test pH, oxygen)", "Only mass", "Only colour"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How could you investigate the effect of temperature on rate of decay?", marks: 2, markScheme: ["Use same material (e.g. milk + lipase or bread); place in water baths at different temperatures; measure time for pH/colour change or mass loss; control other variables."] },
  { question: "Why does decay happen faster at higher temperature?", marks: 1, markScheme: ["Enzymes in decomposers work faster; more kinetic energy."] },
  { question: "What might you use as a control in this practical?", marks: 1, markScheme: ["Same setup without decomposer/enzyme; or boiled to kill organisms; shows change is due to decay."] },
  { question: "Give one way to measure the rate of decay.", marks: 1, markScheme: ["Change in mass over time; time for pH indicator to change; CO₂ produced."] },
  { question: "Why repeat the experiment?", marks: 1, markScheme: ["More reliable; identify anomalies; calculate mean."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
