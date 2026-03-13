const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Plant hormones";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Plant hormones";

const MCQS = [
  { question: "Auxins control:", options: ["Only photosynthesis", "Growth; phototropism; gravitropism", "Only flowering", "Only root colour"], correctIndex: 1, marks: 1 },
  { question: "Phototropism is growth in response to:", options: ["Gravity", "Light", "Water", "Touch"], correctIndex: 1, marks: 1 },
  { question: "Shoots grow towards light because:", options: ["Light pushes them", "Auxin accumulates on shaded side; shaded side grows more", "Roots push them", "Gravity pulls them"], correctIndex: 1, marks: 1 },
  { question: "Gravitropism (geotropism) is growth in response to:", options: ["Light", "Gravity", "Water only", "Sound"], correctIndex: 1, marks: 1 },
  { question: "Roots grow towards gravity so that:", options: ["They find light", "They grow into soil for anchorage and water", "They avoid water", "They find air"], correctIndex: 1, marks: 1 },
  { question: "Auxin is produced in the:", options: ["Roots only", "Tip of shoots and roots", "Leaves only", "Flowers only"], correctIndex: 1, marks: 1 },
  { question: "If the tip of a shoot is removed:", options: ["It grows faster", "It may not respond to light (no auxin source)", "It produces more auxin in the roots", "It flowers"], correctIndex: 1, marks: 1 },
  { question: "Gibberellins are involved in:", options: ["Only tropisms", "Germination; stem elongation", "Only root growth", "Only leaf fall"], correctIndex: 1, marks: 1 },
  { question: "Ethene (ethylene) is involved in:", options: ["Only growth", "Fruit ripening", "Only phototropism", "Only germination"], correctIndex: 1, marks: 1 },
  { question: "Positive phototropism means:", options: ["Growth away from light", "Growth towards light", "No growth", "Growth downwards"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "What is phototropism and how do auxins cause it in shoots?", marks: 2, markScheme: ["Growth in response to light. Auxin moves to shaded side; shaded side grows more; shoot bends towards light."] },
  { question: "What is gravitropism and why is it important for roots?", marks: 2, markScheme: ["Growth in response to gravity. Roots grow down into soil for anchorage and water/minerals."] },
  { question: "Where is auxin produced?", marks: 1, markScheme: ["Tip of shoots and roots."] },
  { question: "Give one role of gibberellins in plants.", marks: 1, markScheme: ["Stem elongation; germination."] },
  { question: "What is the role of ethene in plants?", marks: 1, markScheme: ["Fruit ripening."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
