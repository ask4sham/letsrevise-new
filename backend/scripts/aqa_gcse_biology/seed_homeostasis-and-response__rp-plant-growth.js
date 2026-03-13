const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Homeostasis and Response";
const TOPIC_NAME = "Required Practical: Plant growth";
const UNIT_KEY = "homeostasis-and-response";
const TOPIC_LABEL = "Required Practical: Plant growth";

const MCQS = [
  { question: "In the plant growth practical, auxin is often applied to:", options: ["The roots only", "One side of the shoot or root", "The whole plant", "Only the leaves"], correctIndex: 1, marks: 1 },
  { question: "To investigate phototropism you could:", options: ["Use no light", "Grow seedlings with light from one side; observe bending", "Only measure height", "Only water from one side"], correctIndex: 1, marks: 1 },
  { question: "To investigate gravitropism you could:", options: ["Only use light", "Place seedlings horizontally; observe root and shoot growth", "Only measure leaves", "Only add fertiliser"], correctIndex: 1, marks: 1 },
  { question: "A control in this practical might be:", options: ["A plant with no water", "A plant with no hormone / normal conditions for comparison", "A plant in darkness only", "A dead plant"], correctIndex: 1, marks: 1 },
  { question: "Measuring the angle of growth or distance moved helps to:", options: ["Water the plant", "Quantify the response to light or gravity", "Only count leaves", "Only weigh the plant"], correctIndex: 1, marks: 1 },
  { question: "Seedlings are often used because:", options: ["They are old", "They grow and respond quickly; easy to see tropisms", "They don't need light", "They don't respond to auxin"], correctIndex: 1, marks: 1 },
  { question: "If the tip of a shoot is covered and light is from one side:", options: ["The shoot bends more", "The shoot may not bend (no auxin gradient if tip covered)", "Nothing happens", "Only roots bend"], correctIndex: 1, marks: 1 },
  { question: "Auxin can be applied in:", options: ["Only solid form", "Agar block or solution", "Only gas", "Only in soil"], correctIndex: 1, marks: 1 },
  { question: "To make results more reliable you should:", options: ["Use one seedling", "Repeat with many seedlings; control variables", "Only change light", "Only measure once"], correctIndex: 1, marks: 1 },
  { question: "This practical demonstrates:", options: ["Only photosynthesis", "Tropisms; effect of auxin on growth", "Only respiration", "Only germination"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "How could you investigate phototropism in seedlings?", marks: 2, markScheme: ["Grow seedlings with light from one side; measure angle of bend or growth direction; compare with control (e.g. light from above)."] },
  { question: "Why use a control in the plant growth practical?", marks: 1, markScheme: ["To compare; show that the response is due to the variable (e.g. light direction or auxin)."] },
  { question: "How could you investigate gravitropism in roots?", marks: 2, markScheme: ["Place seedling horizontally; observe over time; roots bend down, shoots bend up."] },
  { question: "Give one way to make the results more reliable.", marks: 1, markScheme: ["Repeat with many seedlings; control other variables (water, temperature); measure consistently."] },
  { question: "What does this practical show about auxin?", marks: 1, markScheme: ["Auxin is produced in tip; causes uneven growth; involved in tropisms."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
