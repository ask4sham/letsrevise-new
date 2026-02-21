const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const { seedTopic } = require("../_seedHelpers/aqaBioSeedUtils");

const UNIT_NAME = "Cell Biology";
const TOPIC_NAME = "Transport in Cells";
const UNIT_KEY = "cell-biology";
const TOPIC_LABEL = "Transport in Cells";

const MCQS = [
  { question: "Which process does not require energy from the cell?", options: ["Active transport", "Diffusion", "Pumping ions", "Uptake of minerals against gradient"], correctIndex: 1, marks: 1 },
  { question: "Water moves across membranes by:", options: ["Active transport only", "Osmosis", "Only diffusion of solutes", "Only through pumps"], correctIndex: 1, marks: 1 },
  { question: "A partially permeable membrane allows:", options: ["Only water", "Some substances through but not others", "Everything through", "Nothing through"], correctIndex: 1, marks: 1 },
  { question: "Substances can enter cells by:", options: ["Diffusion only", "Diffusion, osmosis and active transport", "Only active transport", "Only osmosis"], correctIndex: 1, marks: 1 },
  { question: "Osmosis is the movement of:", options: ["Any solute", "Water from dilute to more concentrated solution", "Water only out of cells", "Ions only"], correctIndex: 1, marks: 1 },
  { question: "Active transport is used when:", options: ["Particles are in high concentration inside", "Particles need to move against the concentration gradient", "No membrane is present", "Only water is moving"], correctIndex: 1, marks: 1 },
  { question: "Root hair cells take in mineral ions by active transport because:", options: ["Ions are in higher concentration in the soil", "Ions are in lower concentration in the soil than in the cell", "Diffusion is faster", "Ions are not needed"], correctIndex: 1, marks: 1 },
  { question: "Which factor does not increase the rate of diffusion?", options: ["Higher temperature", "Steeper concentration gradient", "Larger surface area", "Thicker membrane / longer distance"], correctIndex: 3, marks: 1 },
  { question: "Gas exchange in leaves and lungs relies on:", options: ["Active transport only", "Diffusion", "Osmosis only", "Pumps only"], correctIndex: 1, marks: 1 },
  { question: "Transport in cells is important for:", options: ["Structure only", "Obtaining nutrients, removing waste, and keeping conditions stable", "Only reproduction", "Only growth"], correctIndex: 1, marks: 1 },
];

const SHORT_ANSWER = [
  { question: "Name three ways substances can move in and out of cells.", marks: 2, markScheme: ["Diffusion; osmosis; active transport. Any three or two for 1 mark."] },
  { question: "What is a partially permeable membrane?", marks: 1, markScheme: ["A membrane that allows some substances through but not others."] },
  { question: "Why might a cell use active transport instead of diffusion?", marks: 1, markScheme: ["To move substances against the concentration gradient / from low to high concentration."] },
  { question: "Give one example of where osmosis is important in organisms.", marks: 1, markScheme: ["Water uptake in roots; water balance in cells; absorption in gut; any valid example."] },
  { question: "How does surface area affect the rate of diffusion?", marks: 1, markScheme: ["Larger surface area increases the rate of diffusion."] },
];

async function run(mongooseConn) {
  return seedTopic(mongooseConn, { unitName: UNIT_NAME, topicName: TOPIC_NAME, unitKey: UNIT_KEY, topicLabel: TOPIC_LABEL, mcqs: MCQS, shortAnswer: SHORT_ANSWER });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }
  mongoose.connect(process.env.MONGO_URI).then(async () => { await run(mongoose); await mongoose.disconnect(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, MCQS, SHORT_ANSWER };
