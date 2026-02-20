const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Diffusion in multicellular organisms";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Diffusion in multicellular organisms";

const MCQS = [
  { question: "Why do multicellular organisms need exchange surfaces?", options: ["To eat", "Many cells are deep inside; diffusion alone is too slow", "To move", "To reproduce"], correctIndex: 1, marks: 1 },
  { question: "Which feature makes a good exchange surface?", options: ["Thick walls", "Large surface area", "Small surface area", "Dry surface"], correctIndex: 1, marks: 1 },
  { question: "The lungs have many alveoli. This provides:", options: ["Less surface area", "Large surface area for gas exchange", "Less blood supply", "Thicker walls"], correctIndex: 1, marks: 1 },
  { question: "Villi in the small intestine:", options: ["Reduce absorption", "Increase surface area for absorption", "Block diffusion", "Store food"], correctIndex: 1, marks: 1 },
  { question: "Why must exchange surfaces be thin?", options: ["To be strong", "Short diffusion distance", "To save space", "To keep warm"], correctIndex: 1, marks: 1 },
  { question: "Gills in fish are adapted for gas exchange by having:", options: ["No blood supply", "Many filaments and lamellae (large surface area)", "Thick walls", "No moisture"], correctIndex: 1, marks: 1 },
  { question: "What is the benefit of a good blood supply at an exchange surface?", options: ["To slow diffusion", "Maintain concentration gradient / carry substances away", "To heat the surface", "To block movement"], correctIndex: 1, marks: 1 },
  { question: "In multicellular organisms, diffusion from the outside alone is not enough because:", options: ["Cells are too small", "Too many cells; inner cells are far from the environment", "Cells don't need oxygen", "Diffusion is too fast"], correctIndex: 1, marks: 1 },
  { question: "Leaves have a flat shape and air spaces. This helps:", options: ["Reduce surface area", "Increase surface area and gas exchange", "Block sunlight", "Store water only"], correctIndex: 1, marks: 1 },
  { question: "Which is an exchange surface in humans?", options: ["Bone", "Skin only", "Alveoli in lungs, villi in intestine", "Hair"], correctIndex: 2, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Why do multicellular organisms need specialised exchange surfaces?", marks: 2, markScheme: ["Many cells; inner cells not in contact with environment; diffusion alone too slow; need large surface area."] },
  { question: "State two features of an effective exchange surface.", marks: 2, markScheme: ["Large surface area; thin/short diffusion distance; good blood supply; moist. Any two."] },
  { question: "How are alveoli adapted for gas exchange?", marks: 2, markScheme: ["Large surface area; thin walls; good blood supply; moist. Any two."] },
  { question: "What is the role of villi in the small intestine?", marks: 1, markScheme: ["Increase surface area for absorption of digested food."] },
  { question: "Why is a short diffusion distance important at exchange surfaces?", marks: 1, markScheme: ["Faster diffusion / quicker exchange."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
