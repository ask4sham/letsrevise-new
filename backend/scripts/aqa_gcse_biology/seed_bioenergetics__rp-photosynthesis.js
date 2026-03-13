const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Bioenergetics";
const TOPIC_NAME = "Required Practical: Photosynthesis";
const UNIT_KEY = "bioenergetics";
const TOPIC_LABEL = "Required Practical: Photosynthesis";

const MCQS = [
  { question: "In the photosynthesis practical, pondweed is used to:", options: ["Measure roots", "Observe oxygen bubbles produced", "Measure glucose", "Observe leaves only"], correctIndex: 1, marks: 1 },
  { question: "The rate of photosynthesis can be measured by:", options: ["Counting leaves", "Counting bubbles of oxygen per minute", "Weighing the plant", "Measuring water only"], correctIndex: 1, marks: 1 },
  { question: "To test the effect of light intensity you might:", options: ["Change temperature only", "Change distance of light source from plant", "Add more water only", "Add more CO₂ only"], correctIndex: 1, marks: 1 },
  { question: "When the lamp is moved further away, light intensity:", options: ["Increases", "Decreases", "Stays same", "Doubles"], correctIndex: 1, marks: 1 },
  { question: "Sodium hydrogen carbonate may be added to the water to:", options: ["Cool the plant", "Supply carbon dioxide", "Supply oxygen", "Change pH only"], correctIndex: 1, marks: 1 },
  { question: "Why might the plant be left to acclimatise?", options: ["To save time", "So rate is steady before measuring", "To stop photosynthesis", "To dry the plant"], correctIndex: 1, marks: 1 },
  { question: "What could be a source of error in this practical?", options: ["Oxygen is produced", "Bubble size varies; counting inaccuracy", "Plant is green", "Water is used"], correctIndex: 1, marks: 1 },
  { question: "To test effect of temperature you would:", options: ["Only change light", "Use a water bath at different temperatures", "Only add more water", "Only change distance"], correctIndex: 1, marks: 1 },
  { question: "More bubbles per minute usually means:", options: ["Slower photosynthesis", "Faster rate of photosynthesis", "No photosynthesis", "Only respiration"], correctIndex: 1, marks: 1 },
  { question: "Why use a consistent light source?", options: ["To save electricity", "So only one variable (e.g. distance) changes", "To warm the plant", "To colour the water"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How can you measure the rate of photosynthesis in pondweed?", marks: 2, markScheme: ["Count bubbles of oxygen per minute; or volume of oxygen collected in a set time."] },
  { question: "How could you investigate the effect of light intensity on rate of photosynthesis?", marks: 2, markScheme: ["Change distance of lamp from plant; measure bubbles per minute at each distance; light intensity decreases as distance increases."] },
  { question: "Why might sodium hydrogen carbonate be added to the water?", marks: 1, markScheme: ["To supply carbon dioxide; so CO₂ is not a limiting factor."] },
  { question: "Give one source of error in this practical.", marks: 1, markScheme: ["Bubble size varies; counting errors; temperature change; plant not acclimatised."] },
  { question: "What would you expect to happen to bubble rate if the lamp is moved closer?", marks: 1, markScheme: ["More light; rate of photosynthesis increases; more bubbles (up to a point)."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
