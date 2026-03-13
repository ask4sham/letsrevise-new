const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Factors that affect diffusion";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Factors that affect diffusion";

const MCQS = [
  { question: "Which would increase the rate of diffusion?", options: ["Decreasing temperature", "Increasing temperature", "Increasing distance", "Decreasing surface area"], correctIndex: 1, marks: 1 },
  { question: "A steeper concentration gradient means:", options: ["Slower diffusion", "Faster diffusion", "No diffusion", "Diffusion backwards"], correctIndex: 1, marks: 1 },
  { question: "Why does a larger surface area increase diffusion rate?", options: ["More energy", "More area for particles to cross", "Fewer particles", "Cooler"], correctIndex: 1, marks: 1 },
  { question: "Thicker exchange surfaces mean:", options: ["Faster diffusion", "Slower diffusion", "No change", "No diffusion"], correctIndex: 1, marks: 1 },
  { question: "Which surface is adapted for rapid gas exchange in the lungs?", options: ["Smooth wall", "Alveoli with large surface area", "Thick walls", "Dry surface"], correctIndex: 1, marks: 1 },
  { question: "How does temperature affect diffusion?", options: ["Higher temperature slows it", "Higher temperature speeds it (more kinetic energy)", "No effect", "Only in plants"], correctIndex: 1, marks: 1 },
  { question: "Villi in the small intestine increase:", options: ["Volume", "Surface area for absorption", "Length only", "Weight"], correctIndex: 1, marks: 1 },
  { question: "At equilibrium, diffusion:", options: ["Stops completely", "Continues but no net movement", "Reverses", "Speeds up"], correctIndex: 1, marks: 1 },
  { question: "Which factor does NOT increase diffusion rate?", options: ["Higher concentration gradient", "Larger surface area", "Longer diffusion distance", "Higher temperature"], correctIndex: 2, marks: 1 },
  { question: "Root hair cells are adapted for absorption by having:", options: ["Small surface area", "Long extensions increasing surface area", "No cell membrane", "Thick walls"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "State three factors that affect the rate of diffusion.", marks: 3, markScheme: ["Concentration gradient; temperature; surface area; diffusion distance. Any three."] },
  { question: "Explain why higher temperature increases diffusion rate.", marks: 2, markScheme: ["Particles have more kinetic energy; move faster; more collisions."] },
  { question: "How are alveoli adapted for gas exchange?", marks: 2, markScheme: ["Large surface area; thin walls; good blood supply; moist. Any two."] },
  { question: "What is meant by concentration gradient?", marks: 1, markScheme: ["Difference in concentration between two areas."] },
  { question: "Why do villi increase the rate of absorption in the intestine?", marks: 1, markScheme: ["Increase surface area."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
